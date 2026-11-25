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

# 2. Ensure DATABASE_URL always targets the dedicated schema (default: pack_score_calc)
#    and run Prisma migrations automatically on every startup (already-applied migrations are skipped).
SCHEMA_NAME="${DB_SCHEMA_NAME:-pack_score_calc}"
PRISMA_CLI="./node_modules/prisma/build/index.js"

if [ -n "${DATABASE_URL:-}" ]; then
  case "${DATABASE_URL}" in
    postgres*)
      # Automatically enforce ?schema=pack_score_calc on DATABASE_URL so _prisma_migrations
      # and all tables stay isolated from public and other apps' schemas.
      NORMALIZED_DB_URL=$(node -e '
        const raw = process.env.DATABASE_URL;
        const schema = process.env.DB_SCHEMA_NAME || "pack_score_calc";
        try {
          const u = new URL(raw);
          if (u.searchParams.get("schema") !== schema) {
            u.searchParams.set("schema", schema);
          }
          process.stdout.write(u.toString());
        } catch {
          const sep = raw.includes("?") ? "&" : "?";
          process.stdout.write(raw.includes("schema=") ? raw : `${raw}${sep}schema=${schema}`);
        }
      ')
      export DATABASE_URL="${NORMALIZED_DB_URL}"

      if [ "${AUTO_MIGRATE:-true}" != "false" ]; then
        PRISMA_SCHEMA="prisma/postgres/schema.prisma"
        echo "[Docker Entrypoint] Running startup migrations for dedicated PostgreSQL schema \"${SCHEMA_NAME}\"..."

        # Retry up to 5 times in case PostgreSQL is still starting up
        ATTEMPT=1
        MAX_ATTEMPTS=5
        MIGRATED=0
        while [ "${ATTEMPT}" -le "${MAX_ATTEMPTS}" ]; do
          if printf 'CREATE SCHEMA IF NOT EXISTS "%s";\n' "${SCHEMA_NAME}" | node "${PRISMA_CLI}" db execute --stdin --schema="${PRISMA_SCHEMA}" \
             && node "${PRISMA_CLI}" migrate deploy --schema="${PRISMA_SCHEMA}"; then
            MIGRATED=1
            echo "[Docker Entrypoint] PostgreSQL migrations up to date in schema \"${SCHEMA_NAME}\"."
            break
          fi
          echo "[Docker Entrypoint] Migration attempt ${ATTEMPT}/${MAX_ATTEMPTS} failed. Retrying in 3s..." >&2
          ATTEMPT=$((ATTEMPT + 1))
          sleep 3
        done

        if [ "${MIGRATED}" -ne 1 ]; then
          echo "[Docker Entrypoint] ERROR: Failed to apply database migrations after ${MAX_ATTEMPTS} attempts." >&2
          exit 1
        fi
      fi
      ;;
    file:*)
      if [ "${AUTO_MIGRATE:-true}" != "false" ]; then
        echo "[Docker Entrypoint] Running startup SQLite migrations..."
        node "${PRISMA_CLI}" migrate deploy --schema="prisma/schema.prisma"
      fi
      ;;
  esac
else
  echo "[Docker Entrypoint] WARNING: DATABASE_URL is not set!" >&2
fi

exec "$@"
