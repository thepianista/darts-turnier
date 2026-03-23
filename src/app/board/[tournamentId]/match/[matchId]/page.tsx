"use client";

import { useEffect, useState, use } from "react";
import { Dart } from "@/lib/types";
import { getCheckoutSuggestion } from "@/lib/checkouts";

interface MatchState {
  match: {
    id: string;
    player1_id: string;
    player2_id: string;
    player1_name: string;
    player1_nickname: string | null;
    player2_name: string;
    player2_nickname: string | null;
    status: string;
    winner_id: string | null;
    best_of: number;
  };
  legs: { id: string; leg_number: number; status: string; winner_id: string | null }[];
  player1_legs_won: number;
  player2_legs_won: number;
  active_leg: { id: string } | null;
  turns: {
    id: string;
    player_id: string;
    turn_number: number;
    is_bust: boolean;
    remaining_before: number;
    remaining_after: number;
    darts: Dart[];
  }[];
  current_turn: {
    id: string;
    player_id: string;
    darts: Dart[];
    remaining_before: number;
  } | null;
  player1_avg: number;
  player2_avg: number;
}

export default function MatchBoardPage({
  params,
}: {
  params: Promise<{ tournamentId: string; matchId: string }>;
}) {
  const { matchId } = use(params);
  const [state, setState] = useState<MatchState | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/matches/${matchId}/state`);
        if (res.ok) {
          setState(await res.json());
        }
      } catch {
        // retry next poll
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [matchId]);

  if (!state) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-white text-2xl">Lade...</p>
      </div>
    );
  }

  // Match finished
  if (state.match.status === "finished") {
    return <MatchResultView state={state} />;
  }

  const { match, turns, current_turn } = state;
  const p1Id = match.player1_id;
  const currentPlayerId = current_turn?.player_id;
  const isP1Active = currentPlayerId === p1Id;

  const p1Remaining = getLiveRemaining(state, p1Id);
  const p2Remaining = getLiveRemaining(state, match.player2_id);

  const currentDarts = current_turn?.darts || [];
  const dartsLeft = 3 - currentDarts.length;
  const activeRemaining = isP1Active ? p1Remaining : p2Remaining;
  const checkout =
    activeRemaining <= 170
      ? getCheckoutSuggestion(activeRemaining, dartsLeft)
      : null;

  const allDarts: { segment: string }[] = [];
  for (const t of [...turns].reverse()) {
    for (const d of [...(t.darts || [])].reverse()) {
      allDarts.push({ segment: d.segment });
      if (allDarts.length >= 3) break;
    }
    if (allDarts.length >= 3) break;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <div className="flex-1 flex">
        <PlayerPanel
          name={match.player1_nickname || match.player1_name}
          remaining={p1Remaining}
          legsWon={state.player1_legs_won}
          avg={state.player1_avg}
          isActive={isP1Active}
          bestOf={match.best_of}
        />
        <div className="w-px bg-gray-800" />
        <PlayerPanel
          name={match.player2_nickname || match.player2_name}
          remaining={p2Remaining}
          legsWon={state.player2_legs_won}
          avg={state.player2_avg}
          isActive={!isP1Active && !!currentPlayerId}
          bestOf={match.best_of}
        />
      </div>

      <div className="bg-gray-900/50 border-t border-gray-800 px-8 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <span className="text-gray-500 text-lg">Letzte Darts:</span>
            <div className="flex gap-2">
              {allDarts.map((d, i) => (
                <span
                  key={i}
                  className="text-2xl font-mono font-bold px-3 py-1 rounded bg-gray-800"
                >
                  {d.segment}
                </span>
              ))}
            </div>
          </div>

          {checkout && (
            <div className="flex items-center gap-4">
              <span className="text-gray-500 text-lg">Checkout:</span>
              <div className="flex gap-2">
                {checkout.map((seg, i) => (
                  <span
                    key={i}
                    className="text-2xl font-mono font-bold px-3 py-1 rounded bg-green-900/50 text-green-400"
                  >
                    {seg}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerPanel({
  name,
  remaining,
  legsWon,
  avg,
  isActive,
  bestOf,
}: {
  name: string;
  remaining: number;
  legsWon: number;
  avg: number;
  isActive: boolean;
  bestOf: number;
}) {
  const needed = Math.ceil(bestOf / 2);
  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center p-8 transition-colors duration-300 ${
        isActive ? "bg-green-950/30" : ""
      }`}
    >
      {isActive && (
        <div className="w-4 h-4 rounded-full bg-green-500 mb-4 animate-pulse" />
      )}
      <p className="text-4xl md:text-5xl font-semibold mb-4">{name}</p>
      <p
        className="font-bold tabular-nums transition-all duration-300"
        style={{ fontSize: "min(20vw, 160px)", lineHeight: 1 }}
      >
        {remaining}
      </p>
      <div className="flex gap-2 mt-6">
        {Array.from({ length: needed }, (_, i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full ${
              i < legsWon ? "bg-green-500" : "bg-gray-700"
            }`}
          />
        ))}
      </div>
      <p className="text-xl text-gray-400 mt-4 tabular-nums">
        Ø {avg.toFixed(2)}
      </p>
    </div>
  );
}

function MatchResultView({ state }: { state: MatchState }) {
  const { match } = state;
  const winnerName =
    match.winner_id === match.player1_id
      ? match.player1_nickname || match.player1_name
      : match.player2_nickname || match.player2_name;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
      <div className="text-center space-y-8">
        <p className="text-3xl text-gray-400">Spiel beendet</p>
        <p className="text-7xl font-bold">{winnerName}</p>
        <p className="text-4xl">
          {state.player1_legs_won} - {state.player2_legs_won}
        </p>
        <div className="grid grid-cols-2 gap-12 text-center mt-12">
          <div>
            <p className="text-gray-500 text-xl">
              {match.player1_nickname || match.player1_name}
            </p>
            <p className="text-3xl font-bold mt-2">
              Ø {state.player1_avg.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xl">
              {match.player2_nickname || match.player2_name}
            </p>
            <p className="text-3xl font-bold mt-2">
              Ø {state.player2_avg.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function getLiveRemaining(state: MatchState, playerId: string): number {
  if (!state.active_leg) return 501;

  const playerTurns = state.turns
    .filter((t) => t.player_id === playerId)
    .sort((a, b) => a.turn_number - b.turn_number);

  if (playerTurns.length === 0) return 501;

  const lastTurn = playerTurns[playerTurns.length - 1];

  if (state.current_turn && state.current_turn.id === lastTurn.id) {
    let remaining = lastTurn.remaining_before;
    if (!lastTurn.is_bust) {
      for (const d of lastTurn.darts || []) {
        remaining -= d.score;
      }
    }
    return remaining;
  }

  return lastTurn.remaining_after;
}
