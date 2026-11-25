# Production Deployment Guide — PackScore Pro

## 1. Dedicated Database Schema Isolation (`pack_score_calc`)

When sharing a PostgreSQL database across multiple applications, **PackScore Pro** isolates all of its tables, indexes, foreign keys, and `_prisma_migrations` strictly inside the dedicated **`pack_score_calc`** schema (`prisma/postgres/schema.prisma`).

- **Never touches `public`** or any other application's schema.
- Every model uses `@@schema("pack_score_calc")` via Prisma `multiSchema`.
- `scripts/db-migrate-prod.sh` enforces that `DATABASE_URL` explicitly contains `?schema=pack_score_calc` before running any migration.

## 2. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | **Local SQLite**: `file:./pack_score_calc.db`<br>**Production PostgreSQL**: `postgresql://user:pass@host:5432/shared_db?schema=pack_score_calc` |
| `DB_SCHEMA_NAME` | No | Dedicated PostgreSQL schema name (default: `pack_score_calc`) |
| `AUTH_SECRET` | Yes | Cryptographically random secret (min 32 chars): `openssl rand -base64 48` |
| `SESSION_MAX_AGE_DAYS` | No | Session cookie lifetime in days (default: `7`) |
| `LOG_LEVEL` | No | `debug`, `info`, `warn`, or `error` (default: `info`) |
| `NODE_ENV` | Yes | Set to `production` |

## 3. Initializing a New or Shared Production PostgreSQL Database

1. Set `DATABASE_URL` with `?schema=pack_score_calc`:
   ```bash
   export DATABASE_URL="postgresql://user:pass@host:5432/shared_db?schema=pack_score_calc"
   ```
2. Run the safe migration bootstrap script (creates `pack_score_calc` schema if missing, applies all migrations strictly inside `pack_score_calc`, and generates the PostgreSQL Prisma Client):
   ```bash
   npm run db:pg:migrate:deploy
   ```
3. Build and start:
   ```bash
   npm run build:pg
   npm run start
   ```

## 4. Creating Future Database Migrations

- **For Local SQLite**:
  ```bash
  npm run db:migrate -- --name describe_change
  ```
- **For Production Shared PostgreSQL (`pack_score_calc` schema)**:
  ```bash
  DATABASE_URL="postgresql://user:pass@host:5432/dev_db?schema=pack_score_calc" \
    npm run db:pg:migrate:dev -- --name describe_change
  ```
- Always commit both migration folders (`prisma/migrations/` and `prisma/postgres/migrations/`).

## 5. Health & Monitoring

- `GET /api/health` verifies database connectivity and returns HTTP `200` with latency in ms (or `503` if unreachable).
