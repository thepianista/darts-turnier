// Database row types

export interface Tournament {
  id: string;
  name: string;
  pin_hash: string;
  best_of: number;
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  tournament_id: string;
  name: string;
  nickname: string | null;
  created_at: string;
}

export interface Match {
  id: string;
  tournament_id: string;
  player1_id: string;
  player2_id: string;
  status: "pending" | "active" | "finished";
  winner_id: string | null;
  lock_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface Leg {
  id: string;
  match_id: string;
  leg_number: number;
  status: "active" | "finished";
  winner_id: string | null;
  starting_player_id: string;
  created_at: string;
}

export interface Dart {
  dart_number: number;
  segment: string;
  multiplier: number;
  base_value: number;
  score: number;
}

export interface Turn {
  id: string;
  leg_id: string;
  player_id: string;
  turn_number: number;
  is_bust: boolean;
  remaining_before: number;
  remaining_after: number;
  darts: Dart[];
  created_at: string;
}
