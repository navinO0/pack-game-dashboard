import { PrismaClient } from "@prisma/client";

function normalizeDatabaseUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  if (!rawUrl.startsWith("postgres://") && !rawUrl.startsWith("postgresql://")) {
    return rawUrl;
  }
  const schemaName = process.env.DB_SCHEMA_NAME || "pack_score_calc";
  try {
    const u = new URL(rawUrl);
    if (u.searchParams.get("schema") !== schemaName) {
      u.searchParams.set("schema", schemaName);
    }
    return u.toString();
  } catch {
    const sep = rawUrl.includes("?") ? "&" : "?";
    return rawUrl.includes("schema=") ? rawUrl : `${rawUrl}${sep}schema=${schemaName}`;
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const normalizedUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(normalizedUrl ? { datasources: { db: { url: normalizedUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
