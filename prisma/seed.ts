import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding PackScore Pro SQLite database...");

  const passwordHash = await bcrypt.hash("Admin@123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@packscore.app" },
    update: {},
    create: {
      name: "Pack Game Host",
      email: "admin@packscore.app",
      passwordHash,
      role: "ADMIN",
    },
  });

  const playerNames = [
    { name: "Aarav Sharma", nickname: "Ace", phone: "+91 98765 00001" },
    { name: "Priya Nair", nickname: "Queen", phone: "+91 98765 00002" },
    { name: "Rohan Verma", nickname: "Shark", phone: "+91 98765 00003" },
    { name: "Meera Patel", nickname: "Maverick", phone: "+91 98765 00004" },
    { name: "Kabir Reddy", nickname: "Joker", phone: "+91 98765 00005" },
  ];

  const players = [];
  for (const p of playerNames) {
    const normalizedName = p.name.trim().toLowerCase();
    const player = await prisma.player.upsert({
      where: {
        createdById_normalizedName: {
          createdById: admin.id,
          normalizedName,
        },
      },
      update: {},
      create: {
        name: p.name,
        normalizedName,
        nickname: p.nickname,
        phone: p.phone,
        createdById: admin.id,
      },
    });
    players.push(player);
  }

  // Create one completed sample game using the 0-5 announcement rules if none exist
  const existingGames = await prisma.game.count({ where: { createdById: admin.id } });
  if (existingGames === 0) {
    const game = await prisma.game.create({
      data: {
        title: "Friday Night Championship",
        status: "COMPLETED",
        targetScore: 15,
        betAmountPerPlayer: 250,
        totalPrizePool: 1000,
        currency: "INR",
        distributionMode: "ELIMINATION_CONTRIBUTION",
        prizeDistribution: JSON.stringify([
          { order: 1, label: "1st Eliminated", percentage: 50 },
          { order: 2, label: "2nd Eliminated", percentage: 30 },
          { order: 3, label: "3rd Eliminated", percentage: 20 },
        ]),
        currentRound: 4,
        createdById: admin.id,
        completedAt: new Date(),
        players: {
          create: [
            {
              playerId: players[0].id,
              seatOrder: 1,
              totalScore: 18,
              isEliminated: true,
              eliminationOrder: 1,
              eliminatedInRound: 2,
              isWinner: false,
              prizePercentage: 50,
              payoutAmount: 500,
            },
            {
              playerId: players[1].id,
              seatOrder: 2,
              totalScore: 15,
              isEliminated: true,
              eliminationOrder: 2,
              eliminatedInRound: 3,
              isWinner: false,
              prizePercentage: 30,
              payoutAmount: 300,
            },
            {
              playerId: players[2].id,
              seatOrder: 3,
              totalScore: 15,
              isEliminated: true,
              eliminationOrder: 3,
              eliminatedInRound: 4,
              isWinner: false,
              prizePercentage: 20,
              payoutAmount: 200,
            },
            {
              playerId: players[3].id,
              seatOrder: 4,
              totalScore: 3,
              isEliminated: false,
              eliminationOrder: null,
              eliminatedInRound: null,
              isWinner: true,
              prizePercentage: 100,
              payoutAmount: 1000,
            },
          ],
        },
      },
      include: { players: { orderBy: { seatOrder: "asc" } } },
    });

    const [gp0, gp1, gp2, gp3] = game.players;
    const roundsData = [
      {
        roundNumber: 1,
        evaluatedGamePlayerId: gp3.id,
        outcome: "ANNOUNCER_WON",
        totalAnnounced: 14,
        resultSummary: "Meera Patel won the round (announced 1, received 0 pts)",
        scores: [
          { gamePlayerId: gp0.id, announcedScore: 4, isEvaluated: false, isRoundWinner: false, points: 4, cumulativeScore: 4, triggeredElimination: false },
          { gamePlayerId: gp1.id, announcedScore: 4, isEvaluated: false, isRoundWinner: false, points: 4, cumulativeScore: 4, triggeredElimination: false },
          { gamePlayerId: gp2.id, announcedScore: 5, isEvaluated: false, isRoundWinner: false, points: 5, cumulativeScore: 5, triggeredElimination: false },
          { gamePlayerId: gp3.id, announcedScore: 1, isEvaluated: true, isRoundWinner: true, points: 0, cumulativeScore: 0, triggeredElimination: false },
        ],
      },
      {
        roundNumber: 2,
        evaluatedGamePlayerId: gp0.id,
        outcome: "ANNOUNCER_LOST",
        totalAnnounced: 14,
        resultSummary: "Aarav Sharma lost the round (announced 4, received +14 pts). Round winners: Priya Nair, Meera Patel",
        scores: [
          { gamePlayerId: gp0.id, announcedScore: 4, isEvaluated: true, isRoundWinner: false, points: 14, cumulativeScore: 18, triggeredElimination: true },
          { gamePlayerId: gp1.id, announcedScore: 2, isEvaluated: false, isRoundWinner: true, points: 0, cumulativeScore: 4, triggeredElimination: false },
          { gamePlayerId: gp2.id, announcedScore: 5, isEvaluated: false, isRoundWinner: false, points: 0, cumulativeScore: 5, triggeredElimination: false },
          { gamePlayerId: gp3.id, announcedScore: 3, isEvaluated: false, isRoundWinner: true, points: 0, cumulativeScore: 0, triggeredElimination: false },
        ],
      },
      {
        roundNumber: 3,
        evaluatedGamePlayerId: gp1.id,
        outcome: "ANNOUNCER_LOST",
        totalAnnounced: 11,
        resultSummary: "Priya Nair lost the round (announced 5, received +11 pts). Round winners: Rohan Verma, Meera Patel",
        scores: [
          { gamePlayerId: gp1.id, announcedScore: 5, isEvaluated: true, isRoundWinner: false, points: 11, cumulativeScore: 15, triggeredElimination: true },
          { gamePlayerId: gp2.id, announcedScore: 4, isEvaluated: false, isRoundWinner: true, points: 0, cumulativeScore: 5, triggeredElimination: false },
          { gamePlayerId: gp3.id, announcedScore: 2, isEvaluated: false, isRoundWinner: true, points: 0, cumulativeScore: 0, triggeredElimination: false },
        ],
      },
      {
        roundNumber: 4,
        evaluatedGamePlayerId: gp2.id,
        outcome: "ANNOUNCER_LOST",
        totalAnnounced: 10,
        resultSummary: "Rohan Verma lost the round (announced 5, received +10 pts). Round winner: Meera Patel",
        scores: [
          { gamePlayerId: gp2.id, announcedScore: 5, isEvaluated: true, isRoundWinner: false, points: 10, cumulativeScore: 15, triggeredElimination: true },
          { gamePlayerId: gp3.id, announcedScore: 5, isEvaluated: false, isRoundWinner: true, points: 0, cumulativeScore: 0, triggeredElimination: false },
        ],
      },
    ];

    for (const r of roundsData) {
      await prisma.round.create({
        data: {
          gameId: game.id,
          roundNumber: r.roundNumber,
          evaluatedGamePlayerId: r.evaluatedGamePlayerId,
          outcome: r.outcome,
          totalAnnounced: r.totalAnnounced,
          resultSummary: r.resultSummary,
          scores: { create: r.scores },
        },
      });
    }
  }

  console.log("Seed complete. Default login: admin@packscore.app / Admin@123");
}

main()
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
