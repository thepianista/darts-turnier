# Darts Turnier App

## Quick Reference

- **Framework:** Next.js 16 (App Router) + TypeScript strict mode
- **Styling:** Tailwind CSS v4 + shadcn/ui (base-ui)
- **DB:** PostgreSQL 18 via postgres.js (raw SQL, no ORM)
- **Deploy:** Vercel ([darts-turnier.vercel.app](https://darts-turnier.vercel.app/))
- **JSONB caveat:** postgres.js returns JSONB as strings — always use `parseDarts()` from `@/lib/db` when reading the `darts` column

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npx tsc --noEmit` — Type-check
- `psql $DATABASE_URL -f db/schema.sql` — Run schema

## Project Structure

- `src/app/` — Next.js App Router pages and API routes
- `src/app/api/` — API endpoints (tournaments, players, matches, turns, board)
- `src/app/admin/[tournamentId]/` — Admin panel (PIN-protected)
- `src/app/board/[tournamentId]/` — TV scoreboard (dark theme, polls every 2s)
- `src/components/` — React components (dart-scoring, shadcn/ui)
- `src/lib/` — Shared utilities (db, types, scoring logic, checkouts, hash)
- `db/schema.sql` — Database schema
- `docs/` — Spec and checkout table

## Conventions

- **UI language:** German (all user-facing text)
- **Code language:** English (variables, comments, API fields, DB columns)
- **Game mode:** 501 Double-Out only
- **Scoring:** Per-dart entry with JSONB array in turns table
- **Polling:** 2s interval for scoreboard, no WebSocket/SSE
- **Auth:** 4-digit PIN with SHA-256 hash (UI gate, not security)
- **Lock:** Simple lock_token on matches, no heartbeat

## Environment

```
DATABASE_URL=postgresql://postgres:<password>@91.99.97.197:5433/darts
```
