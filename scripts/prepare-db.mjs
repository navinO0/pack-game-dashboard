#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Load .env file if DATABASE_URL isn't already in process.env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

const rawUrl = process.env.DATABASE_URL || "";
const schemaName = process.env.DB_SCHEMA_NAME || "pack_score_calc";

if (!rawUrl) {
  console.error("[DB Prepare] ERROR: DATABASE_URL is not set in environment or .env");
  process.exit(1);
}

const isPostgres = rawUrl.startsWith("postgres://") || rawUrl.startsWith("postgresql://");
const prismaSchema = isPostgres ? "prisma/postgres/schema.prisma" : "prisma/schema.prisma";

let effectiveUrl = rawUrl;
if (isPostgres) {
  try {
    const u = new URL(rawUrl);
    if (u.searchParams.get("schema") !== schemaName) {
      u.searchParams.set("schema", schemaName);
      effectiveUrl = u.toString();
    }
  } catch {
    const sep = rawUrl.includes("?") ? "&" : "?";
    if (!rawUrl.includes("schema=")) {
      effectiveUrl = `${rawUrl}${sep}schema=${schemaName}`;
    }
  }
}

const env = { ...process.env, DATABASE_URL: effectiveUrl };
const prismaBin = path.resolve(process.cwd(), "node_modules/prisma/build/index.js");

function runPrisma(args, input) {
  execFileSync(process.execPath, [prismaBin, ...args], {
    stdio: input ? ["pipe", "inherit", "inherit"] : "inherit",
    env,
    ...(input ? { input } : {}),
  });
}

console.log(
  `[DB Prepare] Detected ${isPostgres ? `PostgreSQL (dedicated schema: ${schemaName})` : "SQLite"}`
);

// 1. Generate matching Prisma Client for detected provider
runPrisma(["generate", "--schema", prismaSchema]);

// 2. Skip live DB operations if explicitly requested (e.g. offline build)
if (process.env.SKIP_DB_MIGRATE === "true") {
  console.log("[DB Prepare] SKIP_DB_MIGRATE=true; skipping migrations & connection check.");
  process.exit(0);
}

// 3. Ensure dedicated schema exists (PostgreSQL) & run idempotent migrations
if (isPostgres) {
  runPrisma(
    ["db", "execute", "--stdin", "--schema", prismaSchema],
    `CREATE SCHEMA IF NOT EXISTS "${schemaName}";\n`
  );
}

runPrisma(["migrate", "deploy", "--schema", prismaSchema]);

// 4. Verify live database connection
runPrisma(["db", "execute", "--stdin", "--schema", prismaSchema], "SELECT 1;\n");
console.log(
  `[DB Prepare] ✔ Database connection verified and migrations up to date (${isPostgres ? `PostgreSQL:${schemaName}` : "SQLite"}).`
);

