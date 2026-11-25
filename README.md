# PackScore Pro — Pack Game Score & Prize Management

A production-ready full-stack web application built with **Next.js (App Router)**, **TypeScript**, **shadcn/ui**, **Tailwind CSS**, **Prisma**, and **SQLite** (with dedicated schema & tracked Prisma migrations) for managing Pack Game sessions, tracking round-by-round scores, automatically computing eliminations, and distributing final prize pools.

## Core Features

- **Game Configuration**: Create sessions with custom target scores, per-player betting amount or total prize pool, currency selection, and reusable player autocomplete suggestions.
- **Player Management & Profiles**: Register, search, edit, and archive players; inspect career win rates, net profit/loss, average scores, and full game history.
- **Real-Time Active Game Engine**: Enter round scores with live cumulative progress bars, projected elimination warnings, strict elimination ordering (with deterministic tie-breaking), idempotency-protected submissions, and atomic **Undo Last Round**.
- **Configurable Prize Distribution**: Supports **Pack Standard** (eliminated players' shares sum to 100% of the winner's prize pool — e.g. 50% / 30% / 20% for 4 players) and **Custom Payout Split** (all positions summing strictly to 100%) with cent-accurate currency reconciliation.
- **Game History & Printable Results**: Browse/filter past and active games, review round-by-round scorecards, print final settlement sheets, and launch one-click rematches.
- **Dedicated SQLite Schema & Migrations**: All schema updates are managed exclusively through Prisma migrations (`prisma/migrations/`).

## Quick Start (Local Development)

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```

3. **Apply SQLite migrations & seed sample data**
   ```bash
   npm run db:generate
   npm run db:migrate:deploy
   npm run db:seed
   ```
   Default seeded login: `admin@packscore.app` / `Admin@123` (or register a new account at `/register`).

4. **Start the development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Database Migrations Workflow

For any schema update in `prisma/schema.prisma`, always create a versioned migration (never edit the DB manually):
```bash
npm run db:migrate -- --name describe_your_change
```
In production, apply pending migrations with:
```bash
npm run db:migrate:deploy
```

## Testing & Verification

```bash
npm run test       # Run game engine unit tests
npm run typecheck  # TypeScript strict check
npm run build      # Production Next.js build
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Docker Compose setup, SQLite backups, and monitoring.
