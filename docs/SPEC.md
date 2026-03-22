# 🎯 Darts Turnier App — Technical Specification

## Overview

A web-based darts tournament scoring application with two distinct views:
1. **Admin Panel** — Touch-optimized for mobile/iPad, used by scorekeepers to enter throws
2. **Scoreboard** — TV/projector display for spectators, auto-refreshing live scores

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js (latest) | App Router |
| Language | TypeScript (latest) | Strict mode |
| Styling | Tailwind CSS + shadcn/ui | Latest versions |
| DB Client | postgres.js | Raw SQL, no ORM overhead |
| Database | PostgreSQL 18 | Hetzner `91.99.97.197:5433` |
| Live Updates | Polling (2s interval) | Via Next.js API routes |
| Deploy | Vercel | Frontend + API |
| Game Mode | 501 Double-Out | Single mode, no variants |

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Admin Panel │────▶│  Next.js API │────▶│   PG 18      │
│  (Mobile)    │     │  (Vercel)    │◀────│  (Hetzner)   │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────▼───────┐
                     │  Scoreboard  │
                     │  (TV/Beamer) │
                     │  polls /2s   │
                     └──────────────┘
```

## Data Model

### Tables

```sql
-- Tournaments
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pin TEXT NOT NULL,                    -- 4-digit admin PIN
  status TEXT NOT NULL DEFAULT 'setup', -- setup | active | finished
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Players
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nickname TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Matches (a game between two players)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES players(id),
  player2_id UUID NOT NULL REFERENCES players(id),
  best_of INT NOT NULL DEFAULT 3,       -- best of X legs
  status TEXT NOT NULL DEFAULT 'pending', -- pending | active | finished
  winner_id UUID REFERENCES players(id),
  round INT NOT NULL DEFAULT 1,          -- tournament round
  match_order INT NOT NULL DEFAULT 0,    -- order within round
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Legs (each leg starts at 501)
CREATE TABLE legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  leg_number INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active | finished
  winner_id UUID REFERENCES players(id),
  starting_player_id UUID NOT NULL REFERENCES players(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Throws (individual turn = up to 3 darts)
CREATE TABLE throws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id UUID NOT NULL REFERENCES legs(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  turn_number INT NOT NULL,              -- sequential within leg
  score INT NOT NULL,                    -- total score of the turn (0-180)
  darts_used INT NOT NULL DEFAULT 3,     -- how many darts thrown (1-3)
  is_bust BOOLEAN NOT NULL DEFAULT false,
  remaining_after INT NOT NULL,          -- remaining score after this throw
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_players_tournament ON players(tournament_id);
CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_legs_match ON legs(match_id);
CREATE INDEX idx_throws_leg ON throws(leg_id);
CREATE INDEX idx_throws_player ON throws(player_id);
```

## URL Structure

| Route | Purpose | Access |
|-------|---------|--------|
| `/` | Landing — Create tournament or enter PIN | Public |
| `/admin/[tournamentId]` | Admin Panel (PIN-protected) | Scorekeeper |
| `/board/[tournamentId]` | Scoreboard for TV | Public (read-only) |
| `/board/[tournamentId]/match/[matchId]` | Single match scoreboard | Public (read-only) |

## API Routes

All under `/api/`:

### Tournament Management
- `POST /api/tournaments` — Create tournament (returns ID + PIN)
- `GET /api/tournaments/[id]` — Get tournament details
- `POST /api/tournaments/[id]/verify-pin` — Verify admin PIN

### Player Management
- `POST /api/tournaments/[id]/players` — Add player
- `DELETE /api/tournaments/[id]/players/[playerId]` — Remove player
- `GET /api/tournaments/[id]/players` — List players

### Match Management
- `POST /api/tournaments/[id]/matches` — Create match
- `GET /api/tournaments/[id]/matches` — List matches
- `PATCH /api/matches/[id]` — Update match (start, finish)

### Scoring
- `POST /api/legs/[legId]/throws` — Record a throw
- `DELETE /api/throws/[id]` — Undo last throw
- `GET /api/matches/[matchId]/state` — Get full match state (polled by scoreboard)

### Live Data
- `GET /api/board/[tournamentId]` — Aggregated scoreboard data (polled every 2s)

## Screens

### 1. Landing Page (`/`)

Simple screen with two options:
- **"Neues Turnier erstellen"** → Creates tournament, shows PIN + QR code
- **"Turnier beitreten"** → Enter PIN to access admin, or scan QR for scoreboard

### 2. Admin Panel (`/admin/[tournamentId]`)

**PIN Gate:** First visit requires 4-digit PIN entry.

**Tournament Setup Phase:**
- Add/remove players (name + optional nickname)
- Create matches (select 2 players, set best-of)
- "Turnier starten" button

**Active Match Scoring:**
- Large display showing: Player 1 vs Player 2
- Current remaining score for both players
- **Score Input:** Large numpad buttons (0-9) for entering turn total
  - Alternative: Quick-buttons for common scores (26, 41, 45, 60, 85, 100, 140, 180)
- **"Bust"** button (score goes back, turn wasted)
- **"Undo"** button (revert last throw)
- **Checkout suggestion** shown when remaining ≤ 170
- Legs won counter
- "Nächstes Leg" / "Match beenden" controls

**Touch Optimization:**
- Minimum touch target: 48px
- Large fonts, high contrast
- No hover states, everything tap-based
- Works in portrait (phone) and landscape (iPad)

### 3. Scoreboard (`/board/[tournamentId]`)

**Full-screen TV display:**

**Active Match View:**
- Player names (large, centered)
- Remaining score (huge font, primary focus)
- Legs won (visual indicators, e.g., dots/circles)
- Who's throwing (highlighted/animated indicator)
- Last 3 throws per player (smaller, below score)
- Checkout suggestion for active player (when ≤ 170)

**Tournament Overview:**
- If no active match: show bracket/standings
- Upcoming matches
- Completed match results

**Design:**
- Dark theme (looks better on TV)
- Minimal UI, maximum readability
- Auto-scales to screen size
- No scrolling needed
- Polls `/api/board/[tournamentId]` every 2 seconds

## 501 Double-Out Scoring Logic

### Rules
1. Each player starts at 501
2. Each turn, player throws up to 3 darts
3. Score of the turn is subtracted from remaining
4. To finish (checkout): final dart MUST hit a double (or bullseye/D25)
5. If remaining goes below 0, equals 0 without a double, or equals 1 → **BUST** (score reverts)
6. Maximum possible score per turn: 180 (3x Triple 20)

### Bust Detection
The admin enters the total score per turn. The app auto-detects bust:
- `remaining - score < 0` → bust
- `remaining - score == 1` → bust (can't finish with 1, no double possible)
- `remaining - score == 0` → valid ONLY if it's a valid checkout (but since we enter totals, we trust the scorekeeper)

### Checkout Table
Include standard checkout suggestions for scores 2-170. Reference data from `docs/checkouts.json`.

### Special Scores
- Bull (outer): 25
- Bullseye (inner/double bull): 50 (counts as double for checkout)
- Maximum checkout: 170 (T20, T20, Bull)

## Implementation Notes

### Database Connection
```typescript
// lib/db.ts
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: false, // internal Hetzner connection
  max: 10,
  idle_timeout: 20,
});

export default sql;
```

### Polling Pattern (Scoreboard)
```typescript
// Scoreboard component
useEffect(() => {
  const interval = setInterval(async () => {
    const res = await fetch(`/api/board/${tournamentId}`);
    const data = await res.json();
    setMatchState(data);
  }, 2000);
  return () => clearInterval(interval);
}, [tournamentId]);
```

### PIN Storage
- Stored in `localStorage` after first entry
- PIN is hashed (SHA-256) before DB storage
- Simple but effective — no auth library needed

### Environment Variables
```
DATABASE_URL=postgresql://postgres:<password>@91.99.97.197:5433/darts
```

## Design Guidelines

### Admin (Light Theme)
- Clean, functional — optimized for speed of input
- shadcn/ui components (Button, Input, Card, Dialog)
- Large touch targets, especially for score input
- Visual feedback on tap (color change, haptic where supported)

### Scoreboard (Dark Theme)
- Cinema/TV optimized
- Background: near-black (#0a0a0a)
- Primary text: white
- Accent: green for active player, red for bust
- Scores: 120px+ font on large screens
- Player names: 48px+
- Smooth transitions on score changes (subtle animation)
- No UI chrome — pure content

## Deployment

1. **Vercel:** `vercel --prod` from repo root
2. **Database:** Create `darts` DB on PG 18, run migration SQL
3. **Environment:** Set `DATABASE_URL` in Vercel project settings
4. **Access:**
   - Admin: `https://<domain>/admin/<id>` (share via QR code)
   - Scoreboard: `https://<domain>/board/<id>` (open on TV browser)

## Future Enhancements (v2, not in scope)
- Player statistics / averages
- Tournament brackets (auto-generated)
- Multiple game modes (301, Cricket)
- Sound effects on 180, checkout, etc.
- Spectator count
- Multiple simultaneous matches on scoreboard
