export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { prisma } = await import("./lib/prisma");
  const { logger } = await import("./lib/logger");

  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info("Database connection verified on application startup", {
      latencyMs: Date.now() - startedAt,
      schema: process.env.DB_SCHEMA_NAME || "pack_score_calc",
    });
  } catch (err) {
    logger.error("Database connection check failed on application startup", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

