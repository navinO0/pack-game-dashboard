import type { Prisma } from "@prisma/client";
import {
  evaluateRound,
  calculateFinalPayouts,
  type DistributionMode,
  type DistributionSlot,
  type PlayerRoundState,
} from "./game-engine";

/**
 * Atomically replays all remaining rounds of a game inside a Prisma transaction
 * and recalculates every Round, RoundScore, GamePlayer total/elimination/winner/payout,
 * and Game status/currentRound/version.
 */
export async function recalculateGameInTransaction(
  tx: Prisma.TransactionClient,
  gameId: string
) {
  const game = await tx.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        include: { player: { select: { id: true, name: true } } },
        orderBy: { seatOrder: "asc" },
      },
      rounds: {
        include: { scores: true },
        orderBy: { roundNumber: "asc" },
      },
    },
  });

  if (!game) throw new Error("NOT_FOUND");

  let states: PlayerRoundState[] = game.players.map((gp) => ({
    gamePlayerId: gp.id,
    playerId: gp.playerId,
    name: gp.player.name,
    seatOrder: gp.seatOrder,
    totalScore: 0,
    isEliminated: false,
    eliminationOrder: null,
    eliminatedInRound: null,
    isWinner: false,
  }));

  let completed = false;
  let validRoundsCount = 0;

  // Temporarily shift round numbers to avoid unique (gameId, roundNumber) collisions during renumbering
  for (let i = 0; i < game.rounds.length; i++) {
    await tx.round.update({
      where: { id: game.rounds[i].id },
      data: { roundNumber: 100000 + i },
    });
  }

  for (const round of game.rounds) {
    if (completed) {
      // Game already reached a winner in an earlier round; remove trailing obsolete rounds
      await tx.round.delete({ where: { id: round.id } });
      continue;
    }

    const activePlayers = states.filter((p) => !p.isEliminated);
    if (activePlayers.length <= 1) {
      await tx.round.delete({ where: { id: round.id } });
      completed = true;
      continue;
    }

    validRoundsCount += 1;
    const existingScoreMap = new Map(round.scores.map((s) => [s.gamePlayerId, s.announcedScore]));

    const evaluatedId =
      round.evaluatedGamePlayerId &&
      activePlayers.some((p) => p.gamePlayerId === round.evaluatedGamePlayerId)
        ? round.evaluatedGamePlayerId
        : activePlayers[0].gamePlayerId;

    const roundInputs = activePlayers.map((p) => {
      let score = existingScoreMap.get(p.gamePlayerId) ?? 0;
      if (p.gamePlayerId === evaluatedId && score > 5) {
        score = 5;
      }
      return { gamePlayerId: p.gamePlayerId, announcedScore: score };
    });

    const evalRes = evaluateRound(
      states,
      roundInputs,
      evaluatedId,
      game.targetScore,
      validRoundsCount
    );

    await tx.roundScore.deleteMany({ where: { roundId: round.id } });

    await tx.round.update({
      where: { id: round.id },
      data: {
        roundNumber: validRoundsCount,
        evaluatedGamePlayerId: evalRes.evaluatedGamePlayerId,
        outcome: evalRes.outcome,
        totalAnnounced: evalRes.totalAnnounced,
        resultSummary: evalRes.resultSummary,
        scores: {
          create: evalRes.roundScoreRecords.map((rec) => ({
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

    states = evalRes.updatedPlayers;
    if (evalRes.isGameCompleted) {
      completed = true;
    }
  }

  // Compute payouts if completed
  const payoutsMap = new Map<string, { prizePercentage: number; payoutAmount: number }>();
  if (completed) {
    let dist: DistributionSlot[] = [];
    try {
      dist = JSON.parse(game.prizeDistribution) as DistributionSlot[];
    } catch {
      dist = [];
    }
    const payouts = calculateFinalPayouts(
      states,
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

  for (const p of states) {
    const payout = payoutsMap.get(p.gamePlayerId);
    await tx.gamePlayer.update({
      where: { id: p.gamePlayerId },
      data: {
        totalScore: p.totalScore,
        isEliminated: p.isEliminated,
        eliminationOrder: p.eliminationOrder,
        eliminatedInRound: p.eliminatedInRound,
        isWinner: p.isWinner,
        prizePercentage: payout ? payout.prizePercentage : 0,
        payoutAmount: payout ? payout.payoutAmount : 0,
      },
    });
  }

  const nextStatus =
    game.status === "CANCELLED" ? "CANCELLED" : completed ? "COMPLETED" : "ACTIVE";

  const updatedGame = await tx.game.update({
    where: { id: game.id },
    data: {
      currentRound: validRoundsCount,
      status: nextStatus,
      completedAt: nextStatus === "COMPLETED" ? game.completedAt ?? new Date() : null,
      version: { increment: 1 },
    },
  });

  return {
    gameId: updatedGame.id,
    status: updatedGame.status,
    currentRound: updatedGame.currentRound,
    version: updatedGame.version,
    isGameCompleted: completed,
  };
}

