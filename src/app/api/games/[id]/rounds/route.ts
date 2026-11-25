import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { submitRoundSchema } from "@/lib/validations";
import {
  evaluateRound,
  calculateFinalPayouts,
  type DistributionMode,
  type DistributionSlot,
  type PlayerRoundState,
} from "@/lib/game-engine";
import { handleApiError } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: gameId } = await context.params;
    const body = await request.json();
    const parsed = submitRoundSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Duplicate submission guard via idempotencyKey
      const existingRound = await tx.round.findUnique({
        where: { idempotencyKey: parsed.idempotencyKey },
      });
      if (existingRound) {
        return { duplicate: true as const, roundNumber: existingRound.roundNumber };
      }

      // 2. Fetch game with players
      const game = await tx.game.findFirst({
        where: { id: gameId, createdById: session.userId },
        include: {
          players: {
            include: { player: { select: { id: true, name: true } } },
            orderBy: { seatOrder: "asc" },
          },
        },
      });

      if (!game) {
        throw new Error("NOT_FOUND");
      }
      if (game.status !== "ACTIVE") {
        throw new Error("GAME_NOT_ACTIVE");
      }
      if (game.version !== parsed.expectedVersion) {
        throw new Error("VERSION_CONFLICT");
      }

      const nextRoundNumber = game.currentRound + 1;

      const playerStates: PlayerRoundState[] = game.players.map((gp) => ({
        gamePlayerId: gp.id,
        playerId: gp.playerId,
        name: gp.player.name,
        seatOrder: gp.seatOrder,
        totalScore: gp.totalScore,
        isEliminated: gp.isEliminated,
        eliminationOrder: gp.eliminationOrder,
        eliminatedInRound: gp.eliminatedInRound,
        isWinner: gp.isWinner,
      }));

      // 3. Evaluate announced scores (0-5) & eliminations via pure game engine
      const evaluation = evaluateRound(
        playerStates,
        parsed.scores,
        parsed.evaluatedGamePlayerId,
        game.targetScore,
        nextRoundNumber
      );

      // 4. Persist Round and RoundScores with full announcement audit
      const round = await tx.round.create({
        data: {
          gameId: game.id,
          roundNumber: nextRoundNumber,
          evaluatedGamePlayerId: evaluation.evaluatedGamePlayerId,
          outcome: evaluation.outcome,
          totalAnnounced: evaluation.totalAnnounced,
          resultSummary: evaluation.resultSummary,
          idempotencyKey: parsed.idempotencyKey,
          notes: parsed.notes || null,
          scores: {
            create: evaluation.roundScoreRecords.map((rec) => ({
              gamePlayerId: rec.gamePlayerId,
              announcedScore: rec.announcedScore,
              isEvaluated: rec.isEvaluated,
              isRoundWinner: rec.isRoundWinner,
              points: rec.points,
              cumulativeScore: rec.cumulativeScore,
              triggeredElimination: rec.triggeredElimination,
            })),
          },
        },
      });

      // 5. If game completed, calculate prize distribution payouts
      const payoutsMap = new Map<string, { prizePercentage: number; payoutAmount: number }>();
      if (evaluation.isGameCompleted) {
        let dist: DistributionSlot[] = [];
        try {
          dist = JSON.parse(game.prizeDistribution) as DistributionSlot[];
        } catch {
          dist = [];
        }
        const payouts = calculateFinalPayouts(
          evaluation.updatedPlayers,
          Number(game.totalPrizePool),
          dist,
          game.distributionMode as DistributionMode
        );
        for (const p of payouts) {
          payoutsMap.set(p.gamePlayerId, {
            prizePercentage: p.prizePercentage,
            payoutAmount: p.payoutAmount,
          });
        }
      }

      // 6. Update every GamePlayer atomically
      for (const p of evaluation.updatedPlayers) {
        const payout = payoutsMap.get(p.gamePlayerId);
        await tx.gamePlayer.update({
          where: { id: p.gamePlayerId },
          data: {
            totalScore: p.totalScore,
            isEliminated: p.isEliminated,
            eliminationOrder: p.eliminationOrder,
            eliminatedInRound: p.eliminatedInRound,
            isWinner: p.isWinner,
            ...(payout
              ? {
                  prizePercentage: payout.prizePercentage,
                  payoutAmount: payout.payoutAmount,
                }
              : {}),
          },
        });
      }

      // 7. Update Game metadata with optimistic concurrency increment
      const updatedGame = await tx.game.update({
        where: { id: game.id, version: parsed.expectedVersion },
        data: {
          currentRound: nextRoundNumber,
          version: { increment: 1 },
          ...(evaluation.isGameCompleted
            ? { status: "COMPLETED", completedAt: new Date() }
            : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: evaluation.isGameCompleted ? "GAME_COMPLETED" : "ROUND_RECORDED",
          entityType: "Game",
          entityId: game.id,
          metadata: JSON.stringify({
            roundNumber: nextRoundNumber,
            evaluatedGamePlayerId: evaluation.evaluatedGamePlayerId,
            outcome: evaluation.outcome,
            totalAnnounced: evaluation.totalAnnounced,
            resultSummary: evaluation.resultSummary,
            newlyEliminated: evaluation.newlyEliminated,
            winnerGamePlayerId: evaluation.winnerGamePlayerId,
          }),
        },
      });

      return {
        duplicate: false as const,
        roundId: round.id,
        roundNumber: nextRoundNumber,
        outcome: evaluation.outcome,
        totalAnnounced: evaluation.totalAnnounced,
        winnerNames: evaluation.winnerNames,
        resultSummary: evaluation.resultSummary,
        newlyEliminated: evaluation.newlyEliminated,
        isGameCompleted: evaluation.isGameCompleted,
        winnerGamePlayerId: evaluation.winnerGamePlayerId,
        version: updatedGame.version,
      };
    });

    if (result.duplicate) {
      return NextResponse.json({
        duplicate: true,
        message: "Round already submitted.",
        roundNumber: result.roundNumber,
      });
    }

    logger.info("Round recorded", {
      gameId,
      roundNumber: result.roundNumber,
      completed: result.isGameCompleted,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Game not found." }, { status: 404 });
      }
      if (err.message === "GAME_NOT_ACTIVE") {
        return NextResponse.json(
          { error: "This game is already completed or cancelled." },
          { status: 409 }
        );
      }
      if (err.message === "VERSION_CONFLICT") {
        return NextResponse.json(
          { error: "Game was updated in another tab. Refreshing latest state." },
          { status: 409 }
        );
      }
    }
    return handleApiError(err, { route: "POST /api/games/[id]/rounds" });
  }
}

/**
 * Undo the most recently submitted round inside a DB transaction.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: gameId } = await context.params;

    const undone = await prisma.$transaction(async (tx) => {
      const game = await tx.game.findFirst({
        where: { id: gameId, createdById: session.userId },
        include: {
          players: true,
          rounds: {
            include: { scores: true },
            orderBy: { roundNumber: "desc" },
            take: 1,
          },
        },
      });

      if (!game) throw new Error("NOT_FOUND");
      if (game.rounds.length === 0) throw new Error("NO_ROUNDS");

      const lastRound = game.rounds[0];

      // Revert each player's score & elimination triggered in lastRound
      const scoreByGpId = new Map(lastRound.scores.map((s) => [s.gamePlayerId, s]));
      for (const gp of game.players) {
        const rs = scoreByGpId.get(gp.id);
        const revertedScore = rs ? Math.max(0, gp.totalScore - rs.points) : gp.totalScore;
        const wasEliminatedThisRound = gp.eliminatedInRound === lastRound.roundNumber;

        await tx.gamePlayer.update({
          where: { id: gp.id },
          data: {
            totalScore: revertedScore,
            isEliminated: wasEliminatedThisRound ? false : gp.isEliminated,
            eliminationOrder: wasEliminatedThisRound ? null : gp.eliminationOrder,
            eliminatedInRound: wasEliminatedThisRound ? null : gp.eliminatedInRound,
            isWinner: false,
            prizePercentage: 0,
            payoutAmount: 0,
          },
        });
      }

      await tx.round.delete({ where: { id: lastRound.id } });

      await tx.game.update({
        where: { id: game.id },
        data: {
          currentRound: Math.max(0, game.currentRound - 1),
          status: "ACTIVE",
          completedAt: null,
          version: { increment: 1 },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "ROUND_UNDONE",
          entityType: "Game",
          entityId: game.id,
          metadata: JSON.stringify({ undoneRoundNumber: lastRound.roundNumber }),
        },
      });

      return { undoneRoundNumber: lastRound.roundNumber };
    });

    return NextResponse.json({ success: true, ...undone });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Game not found." }, { status: 404 });
      }
      if (err.message === "NO_ROUNDS") {
        return NextResponse.json({ error: "No rounds to undo." }, { status: 400 });
      }
    }
    return handleApiError(err, { route: "DELETE /api/games/[id]/rounds" });
  }
}

