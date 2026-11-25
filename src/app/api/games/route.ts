import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { createGameSchema } from "@/lib/validations";
import { validatePrizeDistribution } from "@/lib/game-engine";
import { handleApiError } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

type GameStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const q = (searchParams.get("q") || "").trim();

    const validStatuses: GameStatus[] = ["ACTIVE", "COMPLETED", "CANCELLED"];
    const status =
      statusParam && validStatuses.includes(statusParam as GameStatus)
        ? (statusParam as GameStatus)
        : undefined;

    const games = await prisma.game.findMany({
      where: {
        createdById: session.userId,
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                {
                  players: {
                    some: {
                      player: { name: { contains: q } },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        players: {
          include: { player: { select: { id: true, name: true, nickname: true } } },
          orderBy: { seatOrder: "asc" },
        },
        _count: { select: { rounds: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = games.map((g) => {
      const winner = g.players.find((p) => p.isWinner);
      return {
        id: g.id,
        title: g.title,
        status: g.status,
        targetScore: g.targetScore,
        betDescription: g.betDescription,
        betAmountPerPlayer: g.betAmountPerPlayer ? Number(g.betAmountPerPlayer) : null,
        totalPrizePool: Number(g.totalPrizePool),
        isBetFulfilled: g.isBetFulfilled,
        betFulfilledAt: g.betFulfilledAt,
        currency: g.currency,
        distributionMode: g.distributionMode,
        prizeDistribution: (() => {
          try {
            return JSON.parse(g.prizeDistribution);
          } catch {
            return [];
          }
        })(),
        currentRound: g.currentRound,
        roundCount: g._count.rounds,
        startedAt: g.startedAt,
        completedAt: g.completedAt,
        createdAt: g.createdAt,
        winner: winner
          ? {
              playerId: winner.player.id,
              name: winner.player.name,
              payoutAmount: Number(winner.payoutAmount),
            }
          : null,
        players: g.players.map((gp) => ({
          id: gp.id,
          playerId: gp.player.id,
          name: gp.player.name,
          totalScore: gp.totalScore,
          isEliminated: gp.isEliminated,
          eliminationOrder: gp.eliminationOrder,
          isWinner: gp.isWinner,
          prizePercentage: Number(gp.prizePercentage),
          payoutAmount: Number(gp.payoutAmount),
        })),
      };
    });

    return NextResponse.json({ games: formatted });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/games" });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = createGameSchema.parse(body);

    // Ensure no duplicate player names in the same game
    const seenNames = new Set<string>();
    for (const p of parsed.players) {
      const norm = p.name.trim().toLowerCase();
      if (seenNames.has(norm)) {
        return NextResponse.json(
          { error: `Duplicate player "${p.name}" cannot join the same game twice.` },
          { status: 400 }
        );
      }
      seenNames.add(norm);
    }

    // Validate prize distribution totals 100%
    const distCheck = validatePrizeDistribution(
      parsed.prizeDistribution,
      parsed.players.length,
      parsed.distributionMode
    );
    if (!distCheck.valid) {
      return NextResponse.json({ error: distCheck.error }, { status: 400 });
    }

    const createdGame = await prisma.$transaction(async (tx) => {
      // Resolve or create every participating player
      const resolvedPlayerIds: string[] = [];
      for (const p of parsed.players) {
        if (p.id) {
          const existingById = await tx.player.findFirst({
            where: { id: p.id, createdById: session.userId },
          });
          if (existingById) {
            if (!existingById.isActive) {
              await tx.player.update({
                where: { id: existingById.id },
                data: { isActive: true },
              });
            }
            resolvedPlayerIds.push(existingById.id);
            continue;
          }
        }

        const normalizedName = p.name.trim().toLowerCase();
        const player = await tx.player.upsert({
          where: {
            createdById_normalizedName: {
              createdById: session.userId,
              normalizedName,
            },
          },
          update: { isActive: true },
          create: {
            name: p.name.trim(),
            normalizedName,
            createdById: session.userId,
          },
        });
        resolvedPlayerIds.push(player.id);
      }

      const game = await tx.game.create({
        data: {
          title: parsed.title,
          targetScore: parsed.targetScore,
          betDescription: parsed.betDescription?.trim() || null,
          betAmountPerPlayer: parsed.betAmountPerPlayer ?? null,
          totalPrizePool: parsed.totalPrizePool ?? 0,
          isBetFulfilled: false,
          currency: parsed.currency,
          distributionMode: parsed.distributionMode,
          prizeDistribution: JSON.stringify(parsed.prizeDistribution),
          notes: parsed.notes || null,
          createdById: session.userId,
          players: {
            create: resolvedPlayerIds.map((playerId, idx) => ({
              playerId,
              seatOrder: idx + 1,
            })),
          },
        },
        include: {
          players: {
            include: { player: true },
            orderBy: { seatOrder: "asc" },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "GAME_CREATED",
          entityType: "Game",
          entityId: game.id,
          metadata: JSON.stringify({
            title: game.title,
            targetScore: game.targetScore,
            totalPrizePool: Number(game.totalPrizePool),
            playerCount: resolvedPlayerIds.length,
          }),
        },
      });

      return game;
    });

    logger.info("Game created", { gameId: createdGame.id, userId: session.userId });

    return NextResponse.json({ game: createdGame }, { status: 201 });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/games" });
  }
}

