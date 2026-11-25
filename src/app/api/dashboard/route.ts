import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.userId;

    const [
      totalGames,
      activeGamesCount,
      completedGamesCount,
      totalPlayers,
      prizePoolAgg,
      recentGames,
      playersWithGames,
    ] = await Promise.all([
      prisma.game.count({ where: { createdById: userId } }),
      prisma.game.count({ where: { createdById: userId, status: "ACTIVE" } }),
      prisma.game.count({ where: { createdById: userId, status: "COMPLETED" } }),
      prisma.player.count({ where: { createdById: userId, isActive: true } }),
      prisma.game.aggregate({
        where: { createdById: userId, status: "COMPLETED", isBetFulfilled: true },
        _sum: { totalPrizePool: true },
      }),
      prisma.game.findMany({
        where: { createdById: userId },
        include: {
          players: {
            include: { player: { select: { id: true, name: true } } },
            orderBy: { seatOrder: "asc" },
          },
          _count: { select: { rounds: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.player.findMany({
        where: { createdById: userId, isActive: true },
        include: {
          gamePlayers: {
            where: { game: { status: "COMPLETED" } },
            include: { game: { select: { distributionMode: true } } },
          },
        },
      }),
    ]);

    const leaderboard = playersWithGames
      .map((p) => {
        const wins = p.gamePlayers.filter((gp) => gp.isWinner).length;
        const gamesPlayed = p.gamePlayers.length;
        const totalWinnings = p.gamePlayers
          .filter((gp) => gp.isWinner || gp.game.distributionMode === "PRIZE_SPLIT")
          .reduce((sum, gp) => sum + Number(gp.payoutAmount), 0);
        return {
          id: p.id,
          name: p.name,
          nickname: p.nickname,
          gamesPlayed,
          wins,
          winRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0,
          totalWinnings,
        };
      })
      .filter((p) => p.gamesPlayed > 0)
      .sort((a, b) => b.wins - a.wins || b.totalWinnings - a.totalWinnings)
      .slice(0, 5);

    return NextResponse.json({
      stats: {
        totalGames,
        activeGames: activeGamesCount,
        completedGames: completedGamesCount,
        totalPlayers,
        totalPrizeDistributed: Number(prizePoolAgg._sum.totalPrizePool || 0),
      },
      recentGames: recentGames.map((g) => {
        const winner = g.players.find((p) => p.isWinner);
        return {
          id: g.id,
          title: g.title,
          status: g.status,
          targetScore: g.targetScore,
          betDescription: g.betDescription,
          totalPrizePool: Number(g.totalPrizePool),
          isBetFulfilled: g.isBetFulfilled,
          currency: g.currency,
          playerCount: g.players.length,
          activePlayerCount: g.players.filter((p) => !p.isEliminated).length,
          roundCount: g._count.rounds,
          winnerName: winner?.player.name || null,
          createdAt: g.createdAt,
        };
      }),
      leaderboard,
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/dashboard" });
  }
}

