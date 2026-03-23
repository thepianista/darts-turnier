-- Darts Turnier App - Database Schema
-- Run against PostgreSQL 18: psql $DATABASE_URL -f db/schema.sql

-- Tournaments
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  best_of INT NOT NULL DEFAULT 3,
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
  status TEXT NOT NULL DEFAULT 'pending',
  winner_id UUID REFERENCES players(id),
  lock_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Legs (each leg starts at 501)
CREATE TABLE legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  leg_number INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  winner_id UUID REFERENCES players(id),
  starting_player_id UUID NOT NULL REFERENCES players(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Turns (a player's turn = up to 3 darts, darts stored as JSONB)
CREATE TABLE turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id UUID NOT NULL REFERENCES legs(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  turn_number INT NOT NULL,
  is_bust BOOLEAN NOT NULL DEFAULT false,
  remaining_before INT NOT NULL,
  remaining_after INT NOT NULL,
  darts JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_players_tournament ON players(tournament_id);
CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_legs_match ON legs(match_id);
CREATE INDEX idx_turns_leg ON turns(leg_id);
CREATE INDEX idx_turns_player ON turns(player_id);
