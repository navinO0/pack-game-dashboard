-- Ensure dedicated schema exists without touching public or any other app's schema
CREATE SCHEMA IF NOT EXISTS "pack_score_calc";

-- CreateTable
CREATE TABLE "pack_score_calc"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'HOST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_score_calc"."Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "nickname" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_score_calc"."Game" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "targetScore" INTEGER NOT NULL,
    "betDescription" TEXT,
    "betAmountPerPlayer" DOUBLE PRECISION,
    "totalPrizePool" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isBetFulfilled" BOOLEAN NOT NULL DEFAULT false,
    "betFulfilledAt" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "distributionMode" TEXT NOT NULL DEFAULT 'ELIMINATION_CONTRIBUTION',
    "prizeDistribution" TEXT NOT NULL,
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_score_calc"."GamePlayer" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seatOrder" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "isEliminated" BOOLEAN NOT NULL DEFAULT false,
    "eliminationOrder" INTEGER,
    "eliminatedInRound" INTEGER,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "prizePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payoutAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_score_calc"."Round" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "evaluatedGamePlayerId" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'ANNOUNCER_WON',
    "totalAnnounced" INTEGER NOT NULL DEFAULT 0,
    "resultSummary" TEXT,
    "idempotencyKey" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_score_calc"."RoundScore" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "gamePlayerId" TEXT NOT NULL,
    "announcedScore" INTEGER NOT NULL DEFAULT 0,
    "isEvaluated" BOOLEAN NOT NULL DEFAULT false,
    "isRoundWinner" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL,
    "cumulativeScore" INTEGER NOT NULL,
    "triggeredElimination" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_score_calc"."AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "pack_score_calc"."User"("email");
CREATE INDEX "User_email_idx" ON "pack_score_calc"."User"("email");

CREATE INDEX "Player_createdById_name_idx" ON "pack_score_calc"."Player"("createdById", "name");
CREATE INDEX "Player_createdById_isActive_idx" ON "pack_score_calc"."Player"("createdById", "isActive");
CREATE UNIQUE INDEX "Player_createdById_normalizedName_key" ON "pack_score_calc"."Player"("createdById", "normalizedName");

CREATE INDEX "Game_createdById_status_idx" ON "pack_score_calc"."Game"("createdById", "status");
CREATE INDEX "Game_createdById_createdAt_idx" ON "pack_score_calc"."Game"("createdById", "createdAt");

CREATE INDEX "GamePlayer_gameId_seatOrder_idx" ON "pack_score_calc"."GamePlayer"("gameId", "seatOrder");
CREATE INDEX "GamePlayer_gameId_eliminationOrder_idx" ON "pack_score_calc"."GamePlayer"("gameId", "eliminationOrder");
CREATE INDEX "GamePlayer_playerId_idx" ON "pack_score_calc"."GamePlayer"("playerId");
CREATE UNIQUE INDEX "GamePlayer_gameId_playerId_key" ON "pack_score_calc"."GamePlayer"("gameId", "playerId");

CREATE UNIQUE INDEX "Round_idempotencyKey_key" ON "pack_score_calc"."Round"("idempotencyKey");
CREATE INDEX "Round_gameId_roundNumber_idx" ON "pack_score_calc"."Round"("gameId", "roundNumber");
CREATE UNIQUE INDEX "Round_gameId_roundNumber_key" ON "pack_score_calc"."Round"("gameId", "roundNumber");

CREATE INDEX "RoundScore_gamePlayerId_idx" ON "pack_score_calc"."RoundScore"("gamePlayerId");
CREATE UNIQUE INDEX "RoundScore_roundId_gamePlayerId_key" ON "pack_score_calc"."RoundScore"("roundId", "gamePlayerId");

CREATE INDEX "AuditLog_userId_createdAt_idx" ON "pack_score_calc"."AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "pack_score_calc"."AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "pack_score_calc"."Player" ADD CONSTRAINT "Player_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "pack_score_calc"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pack_score_calc"."Game" ADD CONSTRAINT "Game_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "pack_score_calc"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pack_score_calc"."GamePlayer" ADD CONSTRAINT "GamePlayer_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "pack_score_calc"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pack_score_calc"."GamePlayer" ADD CONSTRAINT "GamePlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "pack_score_calc"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pack_score_calc"."Round" ADD CONSTRAINT "Round_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "pack_score_calc"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pack_score_calc"."RoundScore" ADD CONSTRAINT "RoundScore_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "pack_score_calc"."Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pack_score_calc"."RoundScore" ADD CONSTRAINT "RoundScore_gamePlayerId_fkey" FOREIGN KEY ("gamePlayerId") REFERENCES "pack_score_calc"."GamePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pack_score_calc"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "pack_score_calc"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

