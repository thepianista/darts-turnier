"use client";

import { useEffect, useState, use } from "react";
import { Dart } from "@/lib/types";
import { getCheckoutSuggestion } from "@/lib/checkouts";

interface BoardData {
  tournament: { id: string; name: string; best_of: number };
  players: { id: string; name: string; nickname: string | null }[];
  matches: {
    id: string;
    player1_id: string;
    player2_id: string;
    player1_name: string;
    player2_name: string;
    status: string;
    winner_name: string | null;
  }[];
  active_match: ActiveMatchState | null;
  standings: {
    id: string;
    name: string;
    nickname: string | null;
    matches_won: number;
    matches_lost: number;
  }[];
}

interface ActiveMatchState {
  match: {
    id: string;
    player1_id: string;
    player2_id: string;
    player1_name: string;
    player1_nickname: string | null;
    player2_name: string;
    player2_nickname: string | null;
    best_of: number;
  };
  legs: { id: string; leg_number: number; status: string; winner_id: string | null }[];
  player1_legs_won: number;
  player2_legs_won: number;
  active_leg: { id: string; leg_number: number } | null;
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
  leg_summary: {
    leg: Record<string, unknown>;
    winner_id: string;
    darts_thrown: number;
    avg: number;
    highest_turn: number;
  } | null;
}

export default function ScoreboardPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  const [data, setData] = useState<BoardData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/board/${tournamentId}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // silently retry on next poll
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [tournamentId]);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-white text-2xl">Lade...</p>
      </div>
    );
  }

  const am = data.active_match;

  // Active match view
  if (am) {
    return <ActiveMatchView data={am} bestOf={data.tournament.best_of} />;
  }

  // Idle view
  return <IdleView data={data} />;
}

function ActiveMatchView({
  data,
  bestOf,
}: {
  data: ActiveMatchState;
  bestOf: number;
}) {
  const { match, turns, current_turn, leg_summary } = data;

  // If there's a leg summary and no active leg, show it
  if (leg_summary && !data.active_leg) {
    return <LegSummaryView data={data} summary={leg_summary} bestOf={bestOf} />;
  }

  const p1Id = match.player1_id;
  const p2Id = match.player2_id;
  const currentPlayerId = current_turn?.player_id;
  const isP1Active = currentPlayerId === p1Id;

  // Calculate live remaining
  const p1Remaining = getLiveRemaining(data, p1Id);
  const p2Remaining = getLiveRemaining(data, p2Id);

  // Current darts
  const currentDarts = current_turn?.darts || [];
  const dartsLeft = 3 - currentDarts.length;

  // Checkout suggestion for active player
  const activeRemaining = isP1Active ? p1Remaining : p2Remaining;
  const checkout =
    activeRemaining <= 170
      ? getCheckoutSuggestion(activeRemaining, dartsLeft)
      : null;

  // Last 3 darts thrown (from all turns, most recent first)
  const allDarts: { segment: string; playerId: string }[] = [];
  for (const t of [...turns].reverse()) {
    for (const d of [...(t.darts || [])].reverse()) {
      allDarts.push({ segment: d.segment, playerId: t.player_id });
      if (allDarts.length >= 3) break;
    }
    if (allDarts.length >= 3) break;
  }

  // Turn history for current leg
  const completedTurns = turns.filter(
    (t) => t.darts && t.darts.length > 0 && (t.darts.length === 3 || t.is_bust || t.id !== current_turn?.id)
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Player scores */}
      <div className="flex-1 flex">
        {/* Player 1 */}
        <div
          className={`flex-1 flex flex-col items-center justify-center p-8 transition-colors duration-300 ${
            isP1Active ? "bg-green-950/30" : ""
          }`}
        >
          {isP1Active && (
            <div className="w-4 h-4 rounded-full bg-green-500 mb-4 animate-pulse" />
          )}
          <p className="text-4xl md:text-5xl font-semibold mb-4 truncate max-w-full">
            {match.player1_nickname || match.player1_name}
          </p>
          <p
            className="font-bold tabular-nums transition-all duration-300"
            style={{ fontSize: "min(20vw, 160px)", lineHeight: 1 }}
          >
            {p1Remaining}
          </p>
          <div className="flex gap-2 mt-6">
            {renderLegDots(data.player1_legs_won, bestOf)}
          </div>
          <p className="text-xl text-gray-400 mt-4 tabular-nums">
            Ø {data.player1_avg.toFixed(2)}
          </p>
        </div>

        {/* Divider */}
        <div className="w-px bg-gray-800 flex-shrink-0" />

        {/* Player 2 */}
        <div
          className={`flex-1 flex flex-col items-center justify-center p-8 transition-colors duration-300 ${
            !isP1Active && currentPlayerId ? "bg-green-950/30" : ""
          }`}
        >
          {!isP1Active && currentPlayerId && (
            <div className="w-4 h-4 rounded-full bg-green-500 mb-4 animate-pulse" />
          )}
          <p className="text-4xl md:text-5xl font-semibold mb-4 truncate max-w-full">
            {match.player2_nickname || match.player2_name}
          </p>
          <p
            className="font-bold tabular-nums transition-all duration-300"
            style={{ fontSize: "min(20vw, 160px)", lineHeight: 1 }}
          >
            {p2Remaining}
          </p>
          <div className="flex gap-2 mt-6">
            {renderLegDots(data.player2_legs_won, bestOf)}
          </div>
          <p className="text-xl text-gray-400 mt-4 tabular-nums">
            Ø {data.player2_avg.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Bottom bar: last darts + checkout */}
      <div className="bg-gray-900/50 border-t border-gray-800 px-8 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          {/* Last darts */}
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

          {/* Checkout suggestion */}
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

      {/* Throw history */}
      {completedTurns.length > 0 && (
        <div className="bg-gray-900/30 border-t border-gray-800 px-8 py-3 max-h-48 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              {completedTurns.map((t) => {
                const turnScore = t.is_bust
                  ? 0
                  : t.remaining_before - t.remaining_after;
                const isP1 = t.player_id === p1Id;
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 py-1 ${
                      isP1 ? "col-start-1" : "col-start-2"
                    }`}
                  >
                    <span className="text-gray-500 w-8 text-right">
                      #{t.turn_number}
                    </span>
                    <span className="font-mono text-gray-300">
                      {t.darts?.map((d: Dart) => d.segment).join(" ") || "—"}
                    </span>
                    <span
                      className={`font-bold ml-auto ${
                        t.is_bust ? "text-red-500" : "text-white"
                      }`}
                    >
                      {t.is_bust ? "BUST" : turnScore}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegSummaryView({
  data,
  summary,
  bestOf,
}: {
  data: ActiveMatchState;
  summary: NonNullable<ActiveMatchState["leg_summary"]>;
  bestOf: number;
}) {
  const { match } = data;
  const winnerName =
    summary.winner_id === match.player1_id
      ? match.player1_nickname || match.player1_name
      : match.player2_nickname || match.player2_name;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
      <div className="text-center space-y-8">
        <p className="text-3xl text-gray-400">Leg beendet</p>
        <p className="text-6xl font-bold">{winnerName}</p>
        <div className="text-2xl text-gray-300">
          Legs: {data.player1_legs_won} - {data.player2_legs_won} (Best of{" "}
          {bestOf})
        </div>
        <div className="grid grid-cols-3 gap-8 text-center">
          <div>
            <p className="text-gray-500 text-lg">Darts</p>
            <p className="text-4xl font-bold">{summary.darts_thrown}</p>
          </div>
          <div>
            <p className="text-gray-500 text-lg">Ø 3-Dart</p>
            <p className="text-4xl font-bold">{summary.avg.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-lg">Höchste Aufnahme</p>
            <p className="text-4xl font-bold">{summary.highest_turn}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function IdleView({ data }: { data: BoardData }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-12">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-12">
          {data.tournament.name}
        </h1>

        {/* Standings */}
        {data.standings.length > 0 && (
          <div className="mb-12">
            <h2 className="text-3xl font-semibold mb-6 text-gray-300">
              Tabelle
            </h2>
            <table className="w-full text-2xl">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-3 font-medium">Spieler</th>
                  <th className="text-center py-3 font-medium w-24">S</th>
                  <th className="text-center py-3 font-medium w-24">N</th>
                </tr>
              </thead>
              <tbody>
                {data.standings
                  .sort((a, b) => b.matches_won - a.matches_won)
                  .map((p) => (
                    <tr key={p.id} className="border-b border-gray-800/50">
                      <td className="py-4">
                        {p.name}
                        {p.nickname && (
                          <span className="text-gray-500 ml-2">
                            ({p.nickname})
                          </span>
                        )}
                      </td>
                      <td className="text-center py-4 text-green-400">
                        {p.matches_won}
                      </td>
                      <td className="text-center py-4 text-red-400">
                        {p.matches_lost}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Match list */}
        {data.matches.length > 0 && (
          <div>
            <h2 className="text-3xl font-semibold mb-6 text-gray-300">
              Spiele
            </h2>
            <div className="space-y-3">
              {data.matches.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-4 px-6 rounded-lg bg-gray-900/50 text-xl"
                >
                  <span className="flex-1 text-right">
                    {m.player1_name}
                  </span>
                  <span className="mx-6 text-gray-500">vs</span>
                  <span className="flex-1">{m.player2_name}</span>
                  <span className="ml-6 w-32 text-right">
                    {m.status === "finished" && m.winner_name ? (
                      <span className="text-green-400">
                        {m.winner_name}
                      </span>
                    ) : m.status === "pending" ? (
                      <span className="text-gray-600">Ausstehend</span>
                    ) : (
                      <span className="text-yellow-400">Live</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.matches.length === 0 && data.standings.length === 0 && (
          <p className="text-center text-gray-600 text-3xl mt-20">
            Warte auf Turnierdaten...
          </p>
        )}
      </div>
    </div>
  );
}

function getLiveRemaining(data: ActiveMatchState, playerId: string): number {
  if (!data.active_leg) return 501;

  const playerTurns = data.turns
    .filter((t) => t.player_id === playerId)
    .sort((a, b) => a.turn_number - b.turn_number);

  if (playerTurns.length === 0) return 501;

  const lastTurn = playerTurns[playerTurns.length - 1];

  // If this is the current turn, calculate live
  if (data.current_turn && data.current_turn.id === lastTurn.id) {
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

function renderLegDots(won: number, bestOf: number) {
  const needed = Math.ceil(bestOf / 2);
  return Array.from({ length: needed }, (_, i) => (
    <div
      key={i}
      className={`w-5 h-5 rounded-full ${
        i < won ? "bg-green-500" : "bg-gray-700"
      }`}
    />
  ));
}
