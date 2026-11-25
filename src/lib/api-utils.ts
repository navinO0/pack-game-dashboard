import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth";
import { logger } from "./logger";

export function handleApiError(err: unknown, context?: Record<string, unknown>) {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: err.errors[0]?.message || "Invalid input",
        details: err.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      },
      { status: 400 }
    );
  }

  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  ) {
    return NextResponse.json(
      { error: "A record with this unique value already exists." },
      { status: 409 }
    );
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  logger.error("API route error", { error: message, ...context });

  return NextResponse.json(
    { error: process.env.NODE_ENV === "production" ? "Internal server error" : message },
    { status: 500 }
  );
}

