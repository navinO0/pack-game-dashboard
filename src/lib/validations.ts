import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().email("Please enter a valid email address").toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export const playerSchema = z.object({
  name: z.string().trim().min(1, "Player name is required").max(80, "Name is too long"),
  nickname: z.string().trim().max(40).optional().or(z.literal("")),
  phone: z.string().trim().max(25).optional().or(z.literal("")),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

export const distributionSlotSchema = z.object({
  order: z.number().int().min(0),
  label: z.string().min(1).max(60),
  percentage: z.number().min(0).max(100),
});

export const createGameSchema = z.object({
  title: z.string().trim().min(2, "Game title must be at least 2 characters").max(120),
  targetScore: z.number().int().min(10, "Target score must be at least 10").max(100000),
  betDescription: z.string().trim().max(200).optional().or(z.literal("")),
  betAmountPerPlayer: z.number().min(0).max(10000000).nullable().optional(),
  totalPrizePool: z.number().min(0, "Prize pool cannot be negative").max(100000000).default(0),
  currency: z.string().trim().min(1).max(10).default("INR"),
  distributionMode: z
    .enum(["ELIMINATION_CONTRIBUTION", "PRIZE_SPLIT"])
    .default("ELIMINATION_CONTRIBUTION"),
  prizeDistribution: z.array(distributionSlotSchema).min(1),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  players: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(1, "Player name is required").max(80),
      })
    )
    .min(2, "At least 2 players are required")
    .max(20, "Maximum 20 players per game"),
});

export const submitRoundSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    idempotencyKey: z.string().trim().min(8).max(128),
    evaluatedGamePlayerId: z.string().trim().min(1, "Select the player who announced"),
    notes: z.string().trim().max(300).optional().or(z.literal("")),
    scores: z
      .array(
        z.object({
          gamePlayerId: z.string().min(1),
          announcedScore: z
            .number()
            .int("Score must be a whole number")
            .min(0, "Score cannot be negative")
            .max(100000, "Score exceeds maximum allowed"),
        })
      )
      .min(2, "At least 2 active players must have scores"),
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

