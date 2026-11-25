import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api-utils";
import { distributionSlotSchema } from "@/lib/validations";
import { validatePrizeDistribution, type DistributionMode } from "@/lib/game-engine";
import { recalculateGameInTransaction } from "@/lib/game-recalc";
import { z } from "zod";

const patchGameSchema = z.object({
  status: z.enum(["ACTIVE", "CANCELLED"]).optional(),
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(120).optional(),
  targetScore: z.number().int().min(10, "Target score must be at least 10").max(100000).optional(),
  betDescription: z.string().trim().max(200).nullable().optional(),
  betAmountPerPlayer: z.number().min(0).max(10000000).nullable().optional(),
  totalPrizePool: z.number().min(0).max(100000000).optional(),
  isBetFulfilled: z.boolean().optional(),
  currency: z.string().trim().min(1).max(10).optional(),
  distributionMode: z.enum(["ELIMINATION_CONTRIBUTION", "PRIZE_SPLIT"]).optional(),
  prizeDistribution: z.array(distributionSlotSchema).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;

    const game = await prisma.game.findFirst({
      where: { id, createdById: session.userId },
      include: {
        players: {
          include: {
            player: {
              select: { id: true, name: true, nickname: true },
            },
          },
          orderBy: { seatOrder: "asc" },
        },
        rounds: {
          include: {
            scores: true,
          },
          orderBy: { roundNumber: "asc" },
        },
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found." }, { status: 404 });
    }

    return NextResponse.json({
      game: {
        id: game.id,
        title: game.title,
        status: game.status,
        targetScore: game.targetScore,
        betDescription: game.betDescription,
        betAmountPerPlayer: game.betAmountPerPlayer ? Number(game.betAmountPerPlayer) : null,
        totalPrizePool: Number(game.totalPrizePool),
        isBetFulfilled: game.isBetFulfilled,
        betFulfilledAt: game.betFulfilledAt,
        currency: game.currency,
        distributionMode: game.distributionMode,
        prizeDistribution: (() => {
          try {
            return JSON.parse(game.prizeDistribution);
          } catch {
            return [];
          }
        })(),
        currentRound: game.currentRound,
        version: game.version,
        notes: game.notes,
        startedAt: game.startedAt,
        completedAt: game.completedAt,
        createdAt: game.createdAt,
        players: game.players.map((gp) => ({
          id: gp.id,
          playerId: gp.player.id,
          name: gp.player.name,
          nickname: gp.player.nickname,
          seatOrder: gp.seatOrder,
          totalScore: gp.totalScore,
          isEliminated: gp.isEliminated,
          eliminationOrder: gp.eliminationOrder,
          eliminatedInRound: gp.eliminatedInRound,
          isWinner: gp.isWinner,
          prizePercentage: Number(gp.prizePercentage),
          payoutAmount: Number(gp.payoutAmount),
        })),
        rounds: game.rounds.map((r) => ({
          id: r.id,
          roundNumber: r.roundNumber,
          evaluatedGamePlayerId: r.evaluatedGamePlayerId,
          outcome: r.outcome,
          totalAnnounced: r.totalAnnounced,
          resultSummary: r.resultSummary,
          notes: r.notes,
          createdAt: r.createdAt,
          scores: r.scores.map((s) => ({
            id: s.id,
            gamePlayerId: s.gamePlayerId,
            announcedScore: s.announcedScore,
            isEvaluated: s.isEvaluated,
            isRoundWinner: s.isRoundWinner,
            points: s.points,
            cumulativeScore: s.cumulativeScore,
            triggeredElimination: s.triggeredElimination,
          })),
        })),
      },
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/games/[id]" });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = patchGameSchema.parse(body);

    const existing = await prisma.game.findFirst({
      where: { id, createdById: session.userId },
      include: { _count: { select: { players: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Game not found." }, { status: 404 });
    }

    const nextMode = (parsed.distributionMode ?? existing.distributionMode) as DistributionMode;
    if (parsed.prizeDistribution) {
      const check = validatePrizeDistribution(
        parsed.prizeDistribution,
        existing._count.players,
        nextMode
      );
      if (!check.valid) {
        return NextResponse.json({ error: check.error }, { status: 400 });
      }
    }

    const needsRecalc =
      parsed.targetScore !== undefined ||
      parsed.totalPrizePool !== undefined ||
      parsed.isBetFulfilled !== undefined ||
      parsed.distributionMode !== undefined ||
      parsed.prizeDistribution !== undefined ||
      parsed.status === "ACTIVE";

    const updated = await prisma.$transaction(async (tx) => {
      const g = await tx.game.update({
        where: { id },
        data: {
          ...(parsed.status !== undefined ? { status: parsed.status } : {}),
          ...(parsed.title !== undefined ? { title: parsed.title } : {}),
          ...(parsed.targetScore !== undefined ? { targetScore: parsed.targetScore } : {}),
          ...(parsed.betDescription !== undefined
            ? { betDescription: parsed.betDescription || null }
            : {}),
          ...(parsed.betAmountPerPlayer !== undefined
            ? { betAmountPerPlayer: parsed.betAmountPerPlayer }
            : {}),
          ...(parsed.totalPrizePool !== undefined ? { totalPrizePool: parsed.totalPrizePool } : {}),
          ...(parsed.isBetFulfilled !== undefined
            ? {
                isBetFulfilled: parsed.isBetFulfilled,
                betFulfilledAt: parsed.isBetFulfilled ? new Date() : null,
              }
            : {}),
          ...(parsed.currency !== undefined ? { currency: parsed.currency } : {}),
          ...(parsed.distributionMode !== undefined
            ? { distributionMode: parsed.distributionMode }
            : {}),
          ...(parsed.prizeDistribution !== undefined
            ? { prizeDistribution: JSON.stringify(parsed.prizeDistribution) }
            : {}),
          ...(parsed.notes !== undefined ? { notes: parsed.notes || null } : {}),
        },
      });

      if (needsRecalc) {
        await recalculateGameInTransaction(tx, id);
      }

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "GAME_UPDATED",
          entityType: "Game",
          entityId: id,
          metadata: JSON.stringify(parsed),
        },
      });

      return tx.game.findUnique({ where: { id: g.id } });
    });

    return NextResponse.json({ game: updated });
  } catch (err) {
    return handleApiError(err, { route: "PATCH /api/games/[id]" });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;

    const existing = await prisma.game.findFirst({
      where: { id, createdById: session.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Game not found." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.game.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "GAME_DELETED",
          entityType: "Game",
          entityId: id,
          metadata: JSON.stringify({ title: existing.title }),
        },
      });
    });

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleApiError(err, { route: "DELETE /api/games/[id]" });
  }
}
