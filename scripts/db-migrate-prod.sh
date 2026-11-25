#!/usr/bin/env bash
set -euo pipefail

# Safe production PostgreSQL migration script for PackScore Pro.
# Ensures all tables and _prisma_migrations live strictly inside the dedicated
# "pack_score_calc" schema without touching "public" or any other app's schema.
#
# Usage:
#   DATABASE_URL="postgresql://user:pass@host:5432/shared_db?schema=pack_score_calc" ./scripts/db-migrate-prod.sh

SCHEMA_NAME="${DB_SCHEMA_NAME:-pack_score_calc}"
PRISMA_SCHEMA="prisma/postgres/schema.prisma"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

if [[ "${DATABASE_URL}" != postgres* ]]; then
  echo "ERROR: DATABASE_URL must be a PostgreSQL connection string for production migrations." >&2
  exit 1
fi

# Safety guard: refuse to migrate into the shared public schema
if [[ "${DATABASE_URL}" != *"schema=${SCHEMA_NAME}"* ]]; then
  echo "ERROR: DATABASE_URL must explicitly specify ?schema=${SCHEMA_NAME} to isolate migrations from other apps." >&2
  echo "Example: postgresql://user:pass@host:5432/shared_db?schema=${SCHEMA_NAME}" >&2
  exit 1
fi

echo "[pack-score-calc] Ensuring dedicated schema \"${SCHEMA_NAME}\" exists..."
printf 'CREATE SCHEMA IF NOT EXISTS "%s";\n' "${SCHEMA_NAME}" | npx prisma db execute --stdin --schema="${PRISMA_SCHEMA}"

echo "[pack-score-calc] Applying pending Prisma migrations strictly to schema \"${SCHEMA_NAME}\"..."
npx prisma migrate deploy --schema="${PRISMA_SCHEMA}"

echo "[pack-score-calc] Generating Prisma Client for PostgreSQL schema \"${SCHEMA_NAME}\"..."
npx prisma generate --schema="${PRISMA_SCHEMA}"

echo "[pack-score-calc] Done. Only schema \"${SCHEMA_NAME}\" was modified."

