import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api-utils";
import { recalculateGameInTransaction } from "@/lib/game-recalc";
import { z } from "zod";

const updateRoundSchema = z
  .object({
    evaluatedGamePlayerId: z.string().trim().min(1, "Select the announcer"),
    notes: z.string().trim().max(300).nullable().optional(),
    scores: z
      .array(
        z.object({
          gamePlayerId: z.string().min(1),
          announcedScore: z
            .number()
            .int("Score must be a whole number")
            .min(0, "Score cannot be negative")
            .max(100000),
        })
      )
      .min(2, "At least 2 players must have scores"),
  })
  .refine(
    (data) => {
      const announcer = data.scores.find(
        (s) => s.gamePlayerId === data.evaluatedGamePlayerId
      );
      return Boolean(announcer && announcer.announcedScore >= 0 && announcer.announcedScore <= 5);
    },
    {
      message: "Announcer's score must be between 0 and 5 points",
      path: ["scores"],
    }
  );

/**
 * Edit any specific round's announcer, scores, or notes and atomically recalculate the entire game.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; roundId: string }> }
) {
  try {
    const session = await requireSession();
    const { id: gameId, roundId } = await context.params;
    const body = await request.json();
    const parsed = updateRoundSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const game = await tx.game.findFirst({
        where: { id: gameId, createdById: session.userId },
      });
      if (!game) throw new Error("NOT_FOUND");

      const round = await tx.round.findFirst({
        where: { id: roundId, gameId },
      });
      if (!round) throw new Error("ROUND_NOT_FOUND");

      // Replace raw round scores with updated inputs, then run full deterministic replay
      await tx.roundScore.deleteMany({ where: { roundId } });
      await tx.round.update({
        where: { id: roundId },
        data: {
          evaluatedGamePlayerId: parsed.evaluatedGamePlayerId,
          notes: parsed.notes ?? null,
          scores: {
            create: parsed.scores.map((s) => ({
              gamePlayerId: s.gamePlayerId,
              announcedScore: s.announcedScore,
              points: 0,
              cumulativeScore: 0,
            })),
          },
        },
      });

      const recalc = await recalculateGameInTransaction(tx, gameId);

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "ROUND_UPDATED",
          entityType: "Round",
          entityId: roundId,
          metadata: JSON.stringify({
            gameId,
            roundNumber: round.roundNumber,
            evaluatedGamePlayerId: parsed.evaluatedGamePlayerId,
          }),
        },
      });

      return recalc;
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Game not found." }, { status: 404 });
      }
      if (err.message === "ROUND_NOT_FOUND") {
        return NextResponse.json({ error: "Round not found." }, { status: 404 });
      }
    }
    return handleApiError(err, { route: "PATCH /api/games/[id]/rounds/[roundId]" });
  }
}

/**
 * Delete any specific round, renumber remaining rounds, and atomically recalculate the entire game.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; roundId: string }> }
) {
  try {
    const session = await requireSession();
    const { id: gameId, roundId } = await context.params;

    const result = await prisma.$transaction(async (tx) => {
      const game = await tx.game.findFirst({
        where: { id: gameId, createdById: session.userId },
      });
      if (!game) throw new Error("NOT_FOUND");

      const round = await tx.round.findFirst({
        where: { id: roundId, gameId },
      });
      if (!round) throw new Error("ROUND_NOT_FOUND");

      await tx.round.delete({ where: { id: roundId } });

      const recalc = await recalculateGameInTransaction(tx, gameId);

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "ROUND_DELETED",
          entityType: "Round",
          entityId: roundId,
          metadata: JSON.stringify({ gameId, deletedRoundNumber: round.roundNumber }),
        },
      });

      return { deletedRoundNumber: round.roundNumber, ...recalc };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Game not found." }, { status: 404 });
      }
      if (err.message === "ROUND_NOT_FOUND") {
        return NextResponse.json({ error: "Round not found." }, { status: 404 });
      }
    }
    return handleApiError(err, { route: "DELETE /api/games/[id]/rounds/[roundId]" });
  }
}

