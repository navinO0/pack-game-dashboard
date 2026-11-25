-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "targetScore" INTEGER NOT NULL,
    "betDescription" TEXT,
    "betAmountPerPlayer" REAL,
    "totalPrizePool" REAL NOT NULL DEFAULT 0,
    "isBetFulfilled" BOOLEAN NOT NULL DEFAULT false,
    "betFulfilledAt" DATETIME,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "distributionMode" TEXT NOT NULL DEFAULT 'ELIMINATION_CONTRIBUTION',
    "prizeDistribution" TEXT NOT NULL,
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Game_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Game" ("betAmountPerPlayer", "completedAt", "createdAt", "createdById", "currency", "currentRound", "distributionMode", "id", "notes", "prizeDistribution", "startedAt", "status", "targetScore", "title", "totalPrizePool", "updatedAt", "version") SELECT "betAmountPerPlayer", "completedAt", "createdAt", "createdById", "currency", "currentRound", "distributionMode", "id", "notes", "prizeDistribution", "startedAt", "status", "targetScore", "title", "totalPrizePool", "updatedAt", "version" FROM "Game";
DROP TABLE "Game";
ALTER TABLE "new_Game" RENAME TO "Game";
CREATE INDEX "Game_createdById_status_idx" ON "Game"("createdById", "status");
CREATE INDEX "Game_createdById_createdAt_idx" ON "Game"("createdById", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
