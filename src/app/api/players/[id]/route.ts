import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { playerSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api-utils";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;

    const player = await prisma.player.findFirst({
      where: { id, createdById: session.userId },
      include: {
        gamePlayers: {
          include: {
            game: {
              include: {
                _count: { select: { players: true, rounds: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!player) {
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }

    const completed = player.gamePlayers.filter((gp) => gp.game.status === "COMPLETED");
    const fulfilled = completed.filter((gp) => gp.game.isBetFulfilled);
    const wins = completed.filter((gp) => gp.isWinner).length;
    const totalWinnings = fulfilled
      .filter((gp) => gp.isWinner || gp.game.distributionMode === "PRIZE_SPLIT")
      .reduce((sum, gp) => sum + Number(gp.payoutAmount), 0);
    const totalContributed = fulfilled
      .filter((gp) => !gp.isWinner && gp.game.distributionMode === "ELIMINATION_CONTRIBUTION")
      .reduce((sum, gp) => sum + Number(gp.payoutAmount), 0);
    const firstEliminations = completed.filter((gp) => gp.eliminationOrder === 1).length;
    const avgScore =
      completed.length > 0
        ? Math.round(completed.reduce((sum, gp) => sum + gp.totalScore, 0) / completed.length)
        : 0;

    return NextResponse.json({
      player: {
        id: player.id,
        name: player.name,
        nickname: player.nickname,
        phone: player.phone,
        notes: player.notes,
        isActive: player.isActive,
        createdAt: player.createdAt,
        stats: {
          gamesPlayed: player.gamePlayers.length,
          completedGames: completed.length,
          activeGames: player.gamePlayers.filter((gp) => gp.game.status === "ACTIVE").length,
          wins,
          winRate: completed.length > 0 ? Math.round((wins / completed.length) * 100) : 0,
          totalWinnings,
          totalContributed,
          netProfit: totalWinnings - totalContributed,
          avgScore,
          firstEliminations,
        },
        history: player.gamePlayers.map((gp) => ({
          gameId: gp.game.id,
          gameTitle: gp.game.title,
          status: gp.game.status,
          targetScore: gp.game.targetScore,
          betDescription: gp.game.betDescription,
          totalPrizePool: Number(gp.game.totalPrizePool),
          isBetFulfilled: gp.game.isBetFulfilled,
          currency: gp.game.currency,
          distributionMode: gp.game.distributionMode,
          playerCount: gp.game._count.players,
          roundCount: gp.game._count.rounds,
          totalScore: gp.totalScore,
          isEliminated: gp.isEliminated,
          eliminationOrder: gp.eliminationOrder,
          eliminatedInRound: gp.eliminatedInRound,
          isWinner: gp.isWinner,
          prizePercentage: Number(gp.prizePercentage),
          payoutAmount: Number(gp.payoutAmount),
          startedAt: gp.game.startedAt,
          completedAt: gp.game.completedAt,
        })),
      },
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/players/[id]" });
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
    const parsed = playerSchema.parse(body);

    const existing = await prisma.player.findFirst({
      where: { id, createdById: session.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }

    const normalizedName = parsed.name.trim().toLowerCase();
    const duplicate = await prisma.player.findFirst({
      where: {
        createdById: session.userId,
        normalizedName,
        NOT: { id },
      },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: `Another player named "${parsed.name}" already exists.` },
        { status: 409 }
      );
    }

    const updated = await prisma.player.update({
      where: { id },
      data: {
        name: parsed.name,
        normalizedName,
        nickname: parsed.nickname || null,
        phone: parsed.phone || null,
        notes: parsed.notes || null,
      },
    });

    return NextResponse.json({ player: updated });
  } catch (err) {
    return handleApiError(err, { route: "PATCH /api/players/[id]" });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;

    const existing = await prisma.player.findFirst({
      where: { id, createdById: session.userId },
      include: { _count: { select: { gamePlayers: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }

    if (existing._count.gamePlayers > 0) {
      // Soft-archive to preserve historical game records
      await prisma.player.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ archived: true });
    }

    await prisma.player.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleApiError(err, { route: "DELETE /api/players/[id]" });
  }
}

