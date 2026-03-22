# 🎯 Darts Turnier App

A web-based darts tournament scoring application with a touch-optimized **Admin Panel** for scorekeepers and a **TV Scoreboard** for spectators.

## Features

- **501 Double-Out** scoring with automatic bust detection
- **Admin Panel** — Mobile/iPad optimized score entry with large touch targets
- **TV Scoreboard** — Dark-themed, auto-refreshing display for projectors/TVs
- **Checkout suggestions** — Shows optimal finish paths (2-170)
- **PIN-based access** — Simple 4-digit PIN for admin, no auth overhead
- **Real-time updates** — Scoreboard polls every 2 seconds

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (latest) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL 18 (postgres.js) |
| Deploy | Vercel |
| Live Updates | Polling (2s) |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 18 database
- Vercel account (for deployment)

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

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Environment Variables

```
DATABASE_URL=postgresql://postgres:<password>@<host>:5433/darts
```

## Usage

1. **Create a tournament** at the landing page
2. **Share the PIN** with scorekeepers (or scan QR code)
3. **Open the scoreboard** URL on the TV browser
4. **Add players** and create matches in the admin panel
5. **Start scoring!** — Enter throw totals, the app handles the rest

## Documentation

- [Technical Specification](docs/SPEC.md) — Full architecture, data model, and screen designs
- [Checkout Table](docs/checkouts.json) — Standard checkout paths (2-170)

## License

MIT
