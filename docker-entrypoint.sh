#!/bin/sh
set -e

# 1. Dynamically generate public/env.js at container startup so runtime VPS/Coolify
#    NEXT_PUBLIC_* env vars are available in the browser via window.__ENV.
node -e '
const fs = require("fs");
const path = require("path");

const clientEnv = {};
for (const [key, val] of Object.entries(process.env)) {
  if (key.startsWith("NEXT_PUBLIC_")) {
    clientEnv[key] = val;
  }
}

const targetJsPath = path.resolve(process.cwd(), "public/env.js");
try {
  fs.writeFileSync(
    targetJsPath,
    `window.__ENV = Object.assign(window.__ENV || {}, ${JSON.stringify(clientEnv, null, 2)});\n`
  );
  console.log(`[Docker Entrypoint] Generated public/env.js with ${Object.keys(clientEnv).length} NEXT_PUBLIC_* vars.`);
} catch (err) {
  console.error("[Docker Entrypoint] Failed to write public/env.js:", err.message);
}
'

# 2. Automatic schema bootstrap & Prisma migrations on container startup (PostgreSQL)
#    Strictly targets the dedicated schema (default: pack_score_calc) so shared DBs are safe.
if [ "${AUTO_MIGRATE:-true}" != "false" ] && [ -n "${DATABASE_URL:-}" ]; then
  case "${DATABASE_URL}" in
    postgres*)
      SCHEMA_NAME="${DB_SCHEMA_NAME:-pack_score_calc}"
      PRISMA_SCHEMA="prisma/postgres/schema.prisma"

      case "${DATABASE_URL}" in
        *"schema=${SCHEMA_NAME}"*)
          echo "[Docker Entrypoint] Ensuring dedicated PostgreSQL schema \"${SCHEMA_NAME}\" exists..."
          printf 'CREATE SCHEMA IF NOT EXISTS "%s";\n' "${SCHEMA_NAME}" | ./node_modules/.bin/prisma db execute --stdin --schema="${PRISMA_SCHEMA}" || true

          echo "[Docker Entrypoint] Running Prisma migrations in schema \"${SCHEMA_NAME}\"..."
          ./node_modules/.bin/prisma migrate deploy --schema="${PRISMA_SCHEMA}"
          ;;
        *)
          echo "[Docker Entrypoint] WARNING: DATABASE_URL does not include ?schema=${SCHEMA_NAME}. Skipping auto-migration to protect shared schemas." >&2
          ;;
      esac
      ;;
  esac
fi

exec "$@"
