# Darts Turnier App -- Technical Specification

## Overview

A web-based darts tournament scoring application with two distinct views:
1. **Admin Panel** -- Touch-optimized for mobile/iPad, used by scorekeepers to enter individual dart throws
2. **Scoreboard** -- TV/projector display (1080p+) for spectators, auto-refreshing live scores

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js (latest) | App Router |
| Language | TypeScript (latest) | Strict mode |
| Styling | Tailwind CSS + shadcn/ui | Latest versions |
| DB Client | postgres.js | Raw SQL, no ORM overhead |
| Database | PostgreSQL 18 | Hetzner `91.99.97.197:5433`, direct external connection |
| Live Updates | Polling (2s interval) | Via Next.js API routes |
| Deploy | Vercel | Frontend + API |
| Game Mode | 501 Double-Out | Single mode, no variants |

> **Latency note:** Vercel (edge) to Hetzner (Germany) adds round-trip latency on every API call. For v1 this is acceptable. If latency becomes noticeable, consider moving the DB to a Vercel-colocated provider or adding a connection pooler.

## Architecture

```
+----------------+     +----------------+     +----------------+
|  Admin Panel   |---->|  Next.js API   |---->|   PG 18        |
|  (Mobile)      |     |  (Vercel)      |<----|  (Hetzner)     |
+----------------+     +-------+--------+     +----------------+
                               |
                        +------v--------+
                        |  Scoreboard   |
                        |  (TV/Beamer)  |
                        |  polls /2s    |
                        +---------------+
```

**Offline behavior:** No offline queue. If the network is unavailable, the admin panel shows a "Keine Verbindung" banner and blocks input until reconnected.

## Language & Localization

- **UI language:** German (all user-facing text)
- **Codebase language:** English (variable names, comments, API field names, DB column names)
- No i18n framework needed for v1

## Data Model

### Tables

```sql
-- Tournaments
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,              -- SHA-256 of 4-digit PIN (UI gate, not real security)
  best_of INT NOT NULL DEFAULT 3,     -- best-of legs per match (1,3,5,7), set per tournament
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Players
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Matches (a game between two players)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES players(id),
  player2_id UUID NOT NULL REFERENCES players(id),
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | active | finished
  winner_id UUID REFERENCES players(id),
  -- Scorekeeper lock (simple ownership, no heartbeat)
  lock_token TEXT,                          -- session token of active scorekeeper
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Legs (each leg starts at 501)
CREATE TABLE legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  leg_number INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',    -- active | finished
  winner_id UUID REFERENCES players(id),
  starting_player_id UUID NOT NULL REFERENCES players(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Turns (a player's turn = up to 3 darts, darts stored as JSONB)
CREATE TABLE turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id UUID NOT NULL REFERENCES legs(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  turn_number INT NOT NULL,                -- sequential within leg (across both players)
  is_bust BOOLEAN NOT NULL DEFAULT false,
  remaining_before INT NOT NULL,           -- remaining score before this turn
  remaining_after INT NOT NULL,            -- remaining score after this turn (same as before if bust)
  darts JSONB NOT NULL DEFAULT '[]',       -- array of {dart_number, segment, multiplier, base_value, score}
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_players_tournament ON players(tournament_id);
CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_legs_match ON legs(match_id);
CREATE INDEX idx_turns_leg ON turns(leg_id);
CREATE INDEX idx_turns_player ON turns(player_id);
```

### Darts JSONB Schema

Each entry in the `darts` array:
```json
{
  "dart_number": 1,
  "segment": "T20",
  "multiplier": 3,
  "base_value": 20,
  "score": 60
}
```

### Segment Encoding

| Segment | Meaning | multiplier | base_value | score |
|---------|---------|-----------|------------|-------|
| `S1`-`S20` | Single 1-20 | 1 | 1-20 | 1-20 |
| `D1`-`D20` | Double 1-20 | 2 | 1-20 | 2-40 |
| `T1`-`T20` | Triple 1-20 | 3 | 1-20 | 3-60 |
| `SB` | Single Bull (outer) | 1 | 25 | 25 |
| `DB` | Double Bull (inner) | 2 | 25 | 50 |
| `MISS` | Missed / bounce-out | 0 | 0 | 0 |

### Key Design Decisions

- **No global tournament state.** Tournament is a container; matches are started/finished independently.
- **`best_of` is per-tournament**, set at creation, locked after any match starts. Range: 1, 3, 5, 7.
- **No `round`/`match_order` columns.** Matches are ordered by `created_at`.
- **No `sort_order` on players.** Players ordered by `created_at`.
- **Scorekeeper lock:** Simple `lock_token` on matches table. One admin scores at a time. Other admins can force-take the lock via confirmation dialog.
- **Darts as JSONB:** Individual darts stored inside the `turns` row. Avoids a separate table and reduces query complexity while preserving per-dart granularity.

## URL Structure

| Route | Purpose | Access |
|-------|---------|--------|
| `/` | Landing -- Create tournament or enter PIN | Public |
| `/admin/[tournamentId]` | Admin Panel (PIN-protected) | Scorekeeper |
| `/board/[tournamentId]` | Scoreboard for TV | Public (read-only) |
| `/board/[tournamentId]/match/[matchId]` | Single match scoreboard | Public (read-only) |

## API Routes

All under `/api/`:

### Tournament Management
- `POST /api/tournaments` -- Create tournament (name, PIN, best_of) -> returns ID
- `GET /api/tournaments/[id]` -- Get tournament details
- `POST /api/tournaments/[id]/verify-pin` -- Verify admin PIN -> returns session token
- `DELETE /api/tournaments/[id]` -- Delete tournament (requires PIN, CASCADE deletes all data)

### Player Management
- `POST /api/tournaments/[id]/players` -- Add player
- `DELETE /api/tournaments/[id]/players/[playerId]` -- Remove player
- `GET /api/tournaments/[id]/players` -- List players

### Match Management
- `POST /api/tournaments/[id]/matches` -- Create match (select 2 players)
- `GET /api/tournaments/[id]/matches` -- List matches
- `PATCH /api/matches/[id]` -- Update match (start, finish)
- `POST /api/matches/[id]/lock` -- Acquire scorekeeper lock
- `DELETE /api/matches/[id]/lock` -- Release scorekeeper lock (called on navigate-away)
- `POST /api/matches/[id]/lock/force` -- Force-take lock (with confirmation)

### Scoring
- `PATCH /api/turns/[turnId]` -- Update turn (add dart to JSONB array, or remove last dart for undo)
- `POST /api/matches/[matchId]/legs` -- Create next leg (with starting_player_id)
- `GET /api/matches/[matchId]/state` -- Get full match state (polled by scoreboard)

### Live Data
- `GET /api/board/[tournamentId]` -- Aggregated scoreboard data (polled every 2s)

## Screens

### 1. Landing Page (`/`)

Two options:
- **"Neues Turnier erstellen"** -> Creates tournament, shows PIN + QR code (QR links to scoreboard URL `/board/[id]`)
- **"Turnier beitreten"** -> PIN input field for admin access

PIN entry navigates to `/admin/[tournamentId]`.
Scoreboard is accessed exclusively via QR code or direct URL (it's displayed on a TV, not manually navigated to).

### 2. Admin Panel (`/admin/[tournamentId]`)

**PIN Gate:** First visit requires 4-digit PIN entry. PIN stored in `localStorage` after successful verification.

**Tournament Management:**
- Add/remove players (name + optional nickname)
- Create matches (select 2 players from dropdown)
- Only one match can be active at a time
- Delete tournament (requires PIN re-entry + confirmation dialog)

**Active Match Scoring:**

The scoring interface uses a **per-dart entry** model with a two-step input: modifier + number. Each turn consists of up to 3 individual dart entries.

**Dart Input UI -- Number Pad + Modifier:**
```
+---------------------------------------------+
|  Player 1: 501    vs    Player 2: 501       |
|  Leg: 1/3         Darts: [T20] [S19] [_]   |
+---------------------------------------------+
|  Current turn total: 79                      |
+---------------------------------------------+
|  [  S  ]    [  D  ]    [  T  ]              |
+---------------------------------------------+
|  [ 1] [ 2] [ 3] [ 4] [ 5]                  |
|  [ 6] [ 7] [ 8] [ 9] [10]                  |
|  [11] [12] [13] [14] [15]                   |
|  [16] [17] [18] [19] [20]                   |
+---------------------------------------------+
|  [  BULL  ]    [  MISS  ]    [  UNDO  ]     |
+---------------------------------------------+
```

- **Modifier row:** S (Single), D (Double), T (Triple) -- default is S, stays selected until changed
- **Number pad:** 1-20 in a 4×5 grid, always fully visible, no scrolling
- **Bull button:** Scores SB (25) or DB (50) depending on active modifier (S or D). T+Bull is ignored (treated as S).
- **Miss button:** Records a miss (0 points), ignores modifier
- **Undo button:** Reverts the last dart
- Total: ~24 buttons, all visible without scrolling
- Minimum touch target: 48px
- Large fonts, high contrast
- No hover states, everything tap-based
- Works in portrait (phone) and landscape (iPad)

**Turn Flow:**
1. Admin selects modifier (optional, defaults to S)
2. Admin taps a number -> dart recorded and displayed in dart slot
3. Repeat for dart 2 and dart 3
4. After dart 3 -> **turn auto-submits immediately**, switches to next player

**Special Turn Endings (before dart 3):**
- **Checkout:** If a dart brings remaining to exactly 0 via a double (D1-D20 or DB), the turn ends immediately. Remaining darts are skipped.
- **Bust:** If a dart causes remaining < 0, remaining = 1, or remaining = 0 without a double, the turn ends immediately as a bust. Score reverts to start-of-turn value.

**Undo:** Reverts the last individual dart. Can be used mid-turn (removes last entered dart) or after a turn was submitted (reopens turn and removes last dart). Single-level only -- one undo at a time.

**Checkout Suggestions:** NOT shown on admin panel (scoreboard only). Avoids potential coaching concerns.

**Leg Transition:**
When a leg finishes (checkout), both admin and scoreboard show a **leg summary screen**:
- Leg winner
- Darts thrown
- 3-dart average
- Highest turn score
- Current legs-won tally

Admin sees a **"Nächstes Leg starten"** button + a prompt to select who throws first.

**Match Completion:**
When a player wins enough legs (best_of), the match ends. Both screens show a **match result screen**:
- Winner name
- Leg scores (e.g., 2-1)
- Full match stats: overall 3-dart average, highest turn, checkout percentage, total darts thrown per player

**Scorekeeper Lock:**
- When admin starts scoring a match, a `lock_token` is stored in the match row + `localStorage`
- Other admin devices trying to score the same match see: "Dieses Spiel wird bereits von einem anderen Gerät erfasst" with a "Trotzdem übernehmen" (force-take) button
- Lock is released when: match finishes, or admin navigates away (`beforeunload` -> `DELETE /api/matches/[id]/lock`)
- Force-take: if the original scorekeeper crashed/closed the tab, another admin can take over via confirmation dialog

**Error Handling:**
- Inline red error message directly on the score input area
- Device vibration on error (if `navigator.vibrate` is supported)
- Error clears on next successful action

### 3. Scoreboard (`/board/[tournamentId]`)

**Full-screen TV display (optimized for 1080p+):**

**Active Match View:**
- Player names (large, centered)
- Remaining score (huge font, primary focus)
- Legs won (visual indicators, e.g., filled/empty dots)
- Who's throwing (highlighted/animated indicator)
- Complete throw history for the current leg (all turns, scrolling if needed)
- Last 3 individual darts thrown (e.g., "T20, S19, D12")
- Running 3-dart average per player
- **Checkout suggestion** for active player when remaining <= 170 (dynamic per-dart: updates after each dart is thrown)

**Idle View (no active match):**
- Standings table: player names, matches won/lost, legs won/lost
- Match list: completed matches with scores, upcoming matches with player names

**Leg Summary (between legs):**
- Shown on scoreboard for ~5 seconds or until admin starts next leg
- Same data as admin leg summary screen

**Match Result:**
- Full match stats displayed on scoreboard when match finishes

**Design:**
- Dark theme (cinema/TV optimized)
- Background: near-black (#0a0a0a)
- Primary text: white
- Accent: green for active player, red for bust
- Scores: 120px+ font on large screens
- Player names: 48px+
- **Subtle transitions only** -- smooth number transitions when scores change. No flashy animations, no sounds.
- No UI chrome -- pure content
- No scrolling needed on main view (1080p+)
- Polls `/api/board/[tournamentId]` every 2 seconds

## 501 Double-Out Scoring Logic

### Rules
1. Each player starts at 501
2. Each turn, player throws up to 3 darts
3. Score of each dart is subtracted from remaining individually
4. To finish (checkout): final dart MUST hit a double (D1-D20 or DB)
5. **Bust conditions** (turn ends immediately, score reverts):
   - `remaining - dart_score < 0`
   - `remaining - dart_score == 1` (can't finish with 1, no double possible)
   - `remaining - dart_score == 0` AND dart is NOT a double
6. Maximum possible score per turn: 180 (T20 + T20 + T20)

### Per-Dart Bust Detection

Since the app records individual darts, bust is checked **after each dart**:

```
after_dart = remaining - dart.score

if after_dart < 0        -> BUST (immediate, turn ends)
if after_dart == 1       -> BUST (immediate, turn ends)
if after_dart == 0:
  if dart.multiplier == 2 -> CHECKOUT (leg won, turn ends)
  else                    -> BUST (immediate, turn ends)
```

### Turn Alternation
- Strict alternation: player1, player2, player1, etc.
- A bust counts as a completed turn (score reverts but turn order advances)
- Starting player for each leg is chosen by admin (prompted at leg creation)

### Checkout Suggestions
- Displayed on **scoreboard only** (not admin panel)
- **Dynamic per-dart:** updates after each dart within a turn based on current remaining
- Standard checkout table for scores 2-170 from `docs/checkouts.json`
- Shows the optimal finish path considering remaining darts in the turn
  - 3 darts remaining: show full 3-dart checkout
  - 2 darts remaining: show 2-dart checkout (if possible)
  - 1 dart remaining: show 1-dart checkout (must be a double)

### Special Scores
- Bull (outer): 25 (Single Bull = SB)
- Bullseye (inner/double bull): 50 (Double Bull = DB, counts as double for checkout)
- Maximum checkout: 170 (T20, T20, DB)

## Implementation Notes

### Database Connection
```typescript
// lib/db.ts
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: false,  // direct external connection to Hetzner
  max: 10,
  idle_timeout: 20,
});

export default sql;
```

### Polling Pattern (Scoreboard)
```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    const res = await fetch(`/api/board/${tournamentId}`);
    const data = await res.json();
    setMatchState(data);
  }, 2000);
  return () => clearInterval(interval);
}, [tournamentId]);
```

### Scorekeeper Lock (Acquire + Release)
```typescript
// Acquire lock when entering scoring view
const acquireLock = async () => {
  const res = await fetch(`/api/matches/${matchId}/lock`, {
    method: 'POST',
    headers: { 'X-Lock-Token': lockToken },
  });
  if (!res.ok) { /* show "already locked" dialog with force-take option */ }
};

// Release lock on navigate-away
useEffect(() => {
  const release = () => {
    navigator.sendBeacon(`/api/matches/${matchId}/lock/release?token=${lockToken}`);
  };
  window.addEventListener('beforeunload', release);
  return () => window.removeEventListener('beforeunload', release);
}, [matchId, lockToken]);
```

### PIN Storage
- Hashed with SHA-256 before DB storage (no salt). This is a UI gate for casual use, not cryptographic security -- a 4-digit PIN has only 10,000 possibilities regardless of hashing.
- Stored in `localStorage` after first successful entry per tournament
- Session token generated on PIN verification, used for API auth

### Environment Variables
```
DATABASE_URL=postgresql://postgres:<password>@91.99.97.197:5433/darts
```

## Design Guidelines

### Admin (Light Theme)
- Clean, functional -- optimized for speed of input
- shadcn/ui components (Button, Input, Card, Dialog)
- Large touch targets (48px minimum), especially for number pad and modifier buttons
- Visual feedback on tap (color change, haptic via `navigator.vibrate` where supported)
- Active modifier button visually highlighted (e.g., filled/primary color)
- Inline error messages with device vibration on failures
- Number pad + modifiers fit within viewport without scrolling

### Scoreboard (Dark Theme)
- Cinema/TV optimized (1080p+ target, not mobile-responsive)
- Background: near-black (#0a0a0a)
- Primary text: white
- Accent: green for active player, red for bust
- Scores: 120px+ font on large screens
- Player names: 48px+
- Smooth transitions on score changes (subtle CSS transitions)
- No flashy animations, no sound effects
- No UI chrome -- pure content

## Deployment

1. **Database:** Create `darts` DB on PG 18, run the initial schema SQL
2. **Vercel:** `vercel --prod` from repo root
3. **Environment:** Set `DATABASE_URL` in Vercel project settings
4. **Access:**
   - Admin: `https://<domain>/admin/<id>` (share PIN verbally or via message)
   - Scoreboard: `https://<domain>/board/<id>` (open on TV browser, share via QR code)

## Summary of Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Input model | Per-dart entry (modifier + number pad) | Fast, no scrolling, fits any screen |
| Segment picker | S/D/T modifier + 1-20 number pad + Bull + Miss | ~24 buttons flat, zero scrolling |
| Turn submission | Auto-submit after 3rd dart | Fastest flow for scorekeeper |
| Bust/Checkout | Immediate (mid-turn) | Matches real darts rules |
| Undo | Single dart (last entered) | Simple, low risk of over-undoing |
| Best-of | Per-tournament, 1-7, default 3 | Locked after first match starts |
| Tournament state | No global state (container only) | Matches managed independently |
| Match concurrency | One active match at a time | Simple for single-board events |
| Scorekeeper lock | Simple lock_token, force-take option | No heartbeat complexity |
| Starting player | Admin picks per leg | Manual control, no auto-alternation |
| Leg transition | Confirmation screen with stats | Pause between legs, review performance |
| Match result | Full stats (avg, checkout %, etc.) | Informative for spectators |
| Checkout suggestions | Scoreboard only, dynamic per-dart | Avoids coaching, updates mid-turn |
| Offline behavior | Block input, show banner | No offline queue complexity |
| Scoreboard scaling | Large screens only (1080p+) | TV is the primary target |
| Idle scoreboard | Match list + standings table | Informative between matches |
| Animations | Subtle CSS transitions only | Professional, not distracting |
| PIN security | SHA-256, no salt (UI gate only) | Honest about security level |
| Match creation | Manual only | Full admin control, no auto-generation |
| Match ordering | Creation timestamp | No round/bracket concept needed |
| Tournament deletion | Hard delete + confirmation dialog | Clean, simple, CASCADE |
| Data retention | Manual delete only | No auto-cleanup |
| Language | German UI, English code | Standard for German-market apps |
| QR code | Links to scoreboard URL | Primary use case for QR |
| Join flow | PIN entry only (scoreboard via QR/link) | No confusing dual-ID entry |
| DB connection | Direct external to Hetzner PG | No pooler/VPN needed |
| Darts storage | JSONB array in turns table | Fewer tables, simpler queries |

## Future Enhancements (v2, not in scope)

- Player statistics / averages (dedicated page)
- Tournament brackets (auto-generated)
- Multiple game modes (301, Cricket)
- Sound effects on 180, checkout, etc.
- Spectator count
- Multiple simultaneous matches on scoreboard
- Mobile-responsive scoreboard
- Per-match best-of override
- Match history / replay page
- Offline queue with sync
