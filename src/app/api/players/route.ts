import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { playerSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim();
    const includeArchived = searchParams.get("includeArchived") === "true";

    const players = await prisma.player.findMany({
      where: {
        createdById: session.userId,
        ...(includeArchived ? {} : { isActive: true }),
        ...(query
          ? {
              OR: [
                { name: { contains: query } },
                { nickname: { contains: query } },
              ],
            }
          : {}),
      },
      include: {
        gamePlayers: {
          include: {
            game: {
              select: { status: true, distributionMode: true, isBetFulfilled: true, createdAt: true },
            },
          },
        },
      },
      orderBy: [{ name: "asc" }],
    });

    const formatted = players.map((p) => {
      const completedGames = p.gamePlayers.filter((gp) => gp.game.status === "COMPLETED");
      const fulfilledGames = completedGames.filter((gp) => gp.game.isBetFulfilled);
      const wins = completedGames.filter((gp) => gp.isWinner).length;
      const totalWinnings = fulfilledGames
        .filter((gp) => gp.isWinner || gp.game.distributionMode === "PRIZE_SPLIT")
        .reduce((sum, gp) => sum + Number(gp.payoutAmount), 0);
      const totalContributed = fulfilledGames
        .filter((gp) => !gp.isWinner && gp.game.distributionMode === "ELIMINATION_CONTRIBUTION")
        .reduce((sum, gp) => sum + Number(gp.payoutAmount), 0);
      const avgScore =
        completedGames.length > 0
          ? Math.round(
              completedGames.reduce((sum, gp) => sum + gp.totalScore, 0) / completedGames.length
            )
          : 0;

      return {
        id: p.id,
        name: p.name,
        nickname: p.nickname,
        phone: p.phone,
        notes: p.notes,
        isActive: p.isActive,
        createdAt: p.createdAt,
        stats: {
          gamesPlayed: p.gamePlayers.length,
          completedGames: completedGames.length,
          wins,
          winRate:
            completedGames.length > 0 ? Math.round((wins / completedGames.length) * 100) : 0,
          totalWinnings,
          totalContributed,
          netProfit: totalWinnings - totalContributed,
          avgScore,
        },
      };
    });

    return NextResponse.json({ players: formatted });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/players" });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = playerSchema.parse(body);

    const normalizedName = parsed.name.trim().toLowerCase();

    const existing = await prisma.player.findUnique({
      where: {
        createdById_normalizedName: {
          createdById: session.userId,
          normalizedName,
        },
      },
    });

    if (existing) {
      if (!existing.isActive) {
        const reactivated = await prisma.player.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            name: parsed.name,
            nickname: parsed.nickname || existing.nickname,
            phone: parsed.phone || existing.phone,
            notes: parsed.notes || existing.notes,
          },
        });
        return NextResponse.json({ player: reactivated }, { status: 200 });
      }
      return NextResponse.json(
        { error: `A player named "${parsed.name}" already exists.` },
        { status: 409 }
      );
    }

    const player = await prisma.player.create({
      data: {
        name: parsed.name,
        normalizedName,
        nickname: parsed.nickname || null,
        phone: parsed.phone || null,
        notes: parsed.notes || null,
        createdById: session.userId,
      },
    });

    return NextResponse.json({ player }, { status: 201 });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/players" });
  }
}

