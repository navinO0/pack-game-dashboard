-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Round" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "evaluatedGamePlayerId" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'ANNOUNCER_WON',
    "totalAnnounced" INTEGER NOT NULL DEFAULT 0,
    "resultSummary" TEXT,
    "idempotencyKey" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Round_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Round" ("createdAt", "gameId", "id", "idempotencyKey", "notes", "roundNumber") SELECT "createdAt", "gameId", "id", "idempotencyKey", "notes", "roundNumber" FROM "Round";
DROP TABLE "Round";
ALTER TABLE "new_Round" RENAME TO "Round";
CREATE UNIQUE INDEX "Round_idempotencyKey_key" ON "Round"("idempotencyKey");
CREATE INDEX "Round_gameId_roundNumber_idx" ON "Round"("gameId", "roundNumber");
CREATE UNIQUE INDEX "Round_gameId_roundNumber_key" ON "Round"("gameId", "roundNumber");
CREATE TABLE "new_RoundScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "gamePlayerId" TEXT NOT NULL,
    "announcedScore" INTEGER NOT NULL DEFAULT 0,
    "isEvaluated" BOOLEAN NOT NULL DEFAULT false,
    "isRoundWinner" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL,
    "cumulativeScore" INTEGER NOT NULL,
    "triggeredElimination" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoundScore_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoundScore_gamePlayerId_fkey" FOREIGN KEY ("gamePlayerId") REFERENCES "GamePlayer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RoundScore" ("createdAt", "cumulativeScore", "gamePlayerId", "id", "points", "roundId", "triggeredElimination") SELECT "createdAt", "cumulativeScore", "gamePlayerId", "id", "points", "roundId", "triggeredElimination" FROM "RoundScore";
DROP TABLE "RoundScore";
ALTER TABLE "new_RoundScore" RENAME TO "RoundScore";
CREATE INDEX "RoundScore_gamePlayerId_idx" ON "RoundScore"("gamePlayerId");
CREATE UNIQUE INDEX "RoundScore_roundId_gamePlayerId_key" ON "RoundScore"("roundId", "gamePlayerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
