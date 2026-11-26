import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api-utils";
import { z } from "zod";

const reorderSchema = z.object({
  orderedGamePlayerIds: z.array(z.string().min(1)).min(2),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: gameId } = await context.params;
    const body = await request.json();
    const { orderedGamePlayerIds } = reorderSchema.parse(body);

    const game = await prisma.game.findFirst({
      where: { id: gameId, createdById: session.userId },
      include: { players: { select: { id: true } } },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found." }, { status: 404 });
    }

    const validIds = new Set(game.players.map((p) => p.id));
    if (
      orderedGamePlayerIds.length !== validIds.size ||
      orderedGamePlayerIds.some((pid) => !validIds.has(pid))
    ) {
      return NextResponse.json(
        { error: "Player order list must contain every player in this game." },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      orderedGamePlayerIds.map((gpId, idx) =>
        prisma.gamePlayer.update({
          where: { id: gpId },
          data: { seatOrder: idx + 1 },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: "PATCH /api/games/[id]/players/order" });
  }
}

