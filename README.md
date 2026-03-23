# Darts Turnier App

A web-based darts tournament scoring application with a touch-optimized **Admin Panel** for scorekeepers and a **TV Scoreboard** for spectators.

**Live:** [darts-turnier.vercel.app](https://darts-turnier.vercel.app/)

## Features

- **501 Double-Out** scoring with per-dart entry and automatic bust detection
- **Admin Panel** — Mobile/iPad optimized score entry with S/D/T modifier + number pad
- **TV Scoreboard** — Dark-themed, auto-refreshing display for projectors/TVs (1080p+)
- **Checkout suggestions** — Dynamic per-dart checkout paths (2-170) on scoreboard
- **PIN-based access** — Simple 4-digit PIN for admin, no auth overhead
- **Real-time updates** — Scoreboard polls every 2 seconds
- **Scorekeeper lock** — One admin scores at a time, with force-take option

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | PostgreSQL 18 (postgres.js, raw SQL) |
| Deploy | Vercel |
| Live Updates | Polling (2s) |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 18 database

### Setup

```bash
# Clone the repo
git clone https://github.com/thepianista/darts-turnier.git
cd darts-turnier

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL

# Run database schema
psql $DATABASE_URL -f db/schema.sql

# Start development server
npm run dev
```

### Environment Variables

```
DATABASE_URL=postgresql://postgres:<password>@<host>:5433/darts
```

## Usage

1. **Create a tournament** at the landing page (name, PIN, best-of)
2. **Share the PIN** with scorekeepers
3. **Open the scoreboard** URL on the TV browser (shown after creation)
4. **Add players** and create matches in the admin panel
5. **Start scoring!** — Select modifier (S/D/T), tap number, repeat for 3 darts

## URLs

| Route | Purpose |
|-------|---------|
| `/` | Landing — Create or join tournament |
| `/admin/[id]` | Admin panel (PIN-protected) |
| `/board/[id]` | TV scoreboard (public, read-only) |

## Documentation

- [Technical Specification](docs/SPEC.md) — Full architecture, data model, and screen designs
- [Checkout Table](docs/checkouts.json) — Standard checkout paths (2-170)

## License

MIT
