"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Dart } from "@/lib/types";

interface Match {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_name: string;
  player2_name: string;
  status: string;
}

interface Tournament {
  id: string;
  name: string;
  best_of: number;
}

interface MatchState {
  match: Record<string, unknown>;
  legs: Record<string, unknown>[];
  player1_legs_won: number;
  player2_legs_won: number;
  active_leg: Record<string, unknown> | null;
  turns: Record<string, unknown>[];
  current_turn: Record<string, unknown> | null;
  player1_avg: number;
  player2_avg: number;
}

interface TurnResponse {
  turn: Record<string, unknown>;
  status: string;
  next_turn?: Record<string, unknown>;
  leg?: Record<string, unknown>;
  match_won?: boolean;
  match?: Record<string, unknown>;
}

interface Props {
  match: Match;
  tournament: Tournament;
  sessionToken: string;
  onMatchEnd: () => void;
  onBack: () => void;
}

export function DartScoring({
  match,
  tournament,
  sessionToken,
  onMatchEnd,
  onBack,
}: Props) {
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [modifier, setModifier] = useState<"S" | "D" | "T">("S");
  const [error, setError] = useState("");
  const [legEndDialog, setLegEndDialog] = useState(false);
  const [matchEndDialog, setMatchEndDialog] = useState(false);
  const [newLegDialog, setNewLegDialog] = useState(false);
  const [startingPlayer, setStartingPlayer] = useState("");
  const [legSummary, setLegSummary] = useState<Record<string, unknown> | null>(
    null
  );
  const [matchResult, setMatchResult] = useState<Record<string, unknown> | null>(
    null
  );
  const [lockDialog, setLockDialog] = useState(false);
  const lockTokenRef = useRef(crypto.randomUUID());

  const loadMatchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/matches/${match.id}/state`);
      if (res.ok) {
        const data = await res.json();
        setMatchState(data);
      }
    } catch {
      setError("Verbindungsfehler");
    }
  }, [match.id]);

  // Acquire lock + load state on mount
  useEffect(() => {
    const acquireLock = async () => {
      const res = await fetch(`/api/matches/${match.id}/lock`, {
        method: "POST",
        headers: { "X-Lock-Token": lockTokenRef.current },
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.locked) {
          setLockDialog(true);
        }
      }
    };

    acquireLock();
    loadMatchState();

    // Release lock on unmount
    const token = lockTokenRef.current;
    const matchId = match.id;
    const release = () => {
      navigator.sendBeacon(
        `/api/matches/${matchId}/lock?token=${token}`,
      );
    };
    window.addEventListener("beforeunload", release);

    return () => {
      window.removeEventListener("beforeunload", release);
      // Release lock on component unmount
      fetch(`/api/matches/${matchId}/lock?token=${token}`, {
        method: "DELETE",
      }).catch(() => {});
    };
  }, [match.id, loadMatchState]);

  const forceTakeLock = async () => {
    await fetch(`/api/matches/${match.id}/lock/force`, {
      method: "POST",
      headers: { "X-Lock-Token": lockTokenRef.current },
    });
    setLockDialog(false);
    loadMatchState();
  };

  // Create first leg if none exists
  useEffect(() => {
    if (matchState && !matchState.active_leg && matchState.legs.length === 0) {
      setStartingPlayer(match.player1_id);
      setNewLegDialog(true);
    }
  }, [matchState, match.player1_id]);

  const createLeg = async () => {
    if (!startingPlayer) return;
    setError("");

    const res = await fetch(`/api/matches/${match.id}/legs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starting_player_id: startingPlayer }),
    });

    if (res.ok) {
      setNewLegDialog(false);
      setLegEndDialog(false);
      loadMatchState();
    } else {
      const data = await res.json();
      setError(data.error);
    }
  };

  const throwDart = async (segment: string) => {
    if (!matchState?.current_turn) return;
    setError("");

    try {
      const res = await fetch(
        `/api/turns/${matchState.current_turn.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segment }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
        if (navigator.vibrate) navigator.vibrate(200);
        return;
      }

      const data: TurnResponse = await res.json();

      if (data.status === "bust") {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }

      if (data.status === "checkout") {
        // Leg won
        if (data.match_won) {
          // Match ended
          setMatchResult(data.match || null);
          setMatchEndDialog(true);
        } else {
          // Show leg summary then prompt for next leg
          setLegSummary(data.leg || null);
          setLegEndDialog(true);
        }
      }

      loadMatchState();
    } catch {
      setError("Verbindungsfehler");
      if (navigator.vibrate) navigator.vibrate(200);
    }
  };

  const undoDart = async () => {
    if (!matchState?.current_turn) return;
    setError("");

    try {
      const res = await fetch(
        `/api/turns/${matchState.current_turn.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "undo" }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
        return;
      }

      loadMatchState();
    } catch {
      setError("Verbindungsfehler");
    }
  };

  const handleNumberTap = (num: number) => {
    const segment = `${modifier}${num}`;
    throwDart(segment);
  };

  const handleBull = () => {
    if (modifier === "T") {
      throwDart("SB");
    } else if (modifier === "D") {
      throwDart("DB");
    } else {
      throwDart("SB");
    }
  };

  const handleMiss = () => {
    throwDart("MISS");
  };

  if (!matchState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p>Lade...</p>
      </div>
    );
  }

  const currentTurn = matchState.current_turn;
  const darts: Dart[] = currentTurn
    ? ((currentTurn.darts as Dart[]) || [])
    : [];
  const currentPlayerId = currentTurn?.player_id as string | undefined;
  const isPlayer1 = currentPlayerId === match.player1_id;

  // Get remaining scores
  const p1Remaining = getCurrentRemaining(
    matchState,
    match.player1_id
  );
  const p2Remaining = getCurrentRemaining(
    matchState,
    match.player2_id
  );

  // Calculate current turn total
  const turnTotal = darts.reduce((sum, d) => sum + d.score, 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Score Header */}
      <div className="bg-white shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Zurück
          </Button>
          <span className="text-sm text-muted-foreground">
            Leg {matchState.legs.length} / Best of {tournament.best_of}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 items-center text-center">
          <div
            className={`p-3 rounded-lg ${
              isPlayer1 ? "bg-green-50 ring-2 ring-green-500" : "bg-muted"
            }`}
          >
            <p className="text-sm font-medium truncate">
              {match.player1_name}
            </p>
            <p className="text-4xl font-bold tabular-nums">{p1Remaining}</p>
            <p className="text-xs text-muted-foreground">
              Legs: {matchState.player1_legs_won}
            </p>
          </div>

          <div className="text-center">
            <p className="text-lg font-semibold">vs</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ø {matchState.player1_avg} - {matchState.player2_avg}
            </p>
          </div>

          <div
            className={`p-3 rounded-lg ${
              !isPlayer1 && currentPlayerId
                ? "bg-green-50 ring-2 ring-green-500"
                : "bg-muted"
            }`}
          >
            <p className="text-sm font-medium truncate">
              {match.player2_name}
            </p>
            <p className="text-4xl font-bold tabular-nums">{p2Remaining}</p>
            <p className="text-xs text-muted-foreground">
              Legs: {matchState.player2_legs_won}
            </p>
          </div>
        </div>
      </div>

      {/* Dart slots + turn total */}
      <div className="bg-white border-b p-3">
        <div className="flex items-center justify-center gap-3 mb-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-20 h-12 rounded-lg border-2 flex items-center justify-center text-lg font-mono font-bold"
              style={{
                borderColor: darts[i] ? "#16a34a" : "#e5e7eb",
                backgroundColor: darts[i] ? "#f0fdf4" : "white",
              }}
            >
              {darts[i]?.segment || "—"}
            </div>
          ))}
        </div>
        <p className="text-center text-2xl font-bold tabular-nums">
          Aufnahme: {turnTotal}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 text-destructive p-2 text-center text-sm">
          {error}
        </div>
      )}

      {/* Number Pad */}
      <div className="flex-1 flex flex-col p-3 gap-2">
        {/* Modifier Row */}
        <div className="grid grid-cols-3 gap-2">
          {(["S", "D", "T"] as const).map((mod) => (
            <Button
              key={mod}
              variant={modifier === mod ? "default" : "outline"}
              className="h-14 text-xl font-bold"
              onClick={() => setModifier(mod)}
            >
              {mod}
            </Button>
          ))}
        </div>

        {/* Numbers 1-20 in 4x5 grid */}
        <div className="grid grid-cols-5 gap-2 flex-1">
          {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
            <Button
              key={num}
              variant="outline"
              className="h-full min-h-[48px] text-xl font-bold"
              onClick={() => handleNumberTap(num)}
              disabled={!currentTurn || darts.length >= 3}
            >
              {num}
            </Button>
          ))}
        </div>

        {/* Bottom Row: Bull, Miss, Undo */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            className="h-14 text-lg font-bold"
            onClick={handleBull}
            disabled={!currentTurn || darts.length >= 3}
          >
            BULL
          </Button>
          <Button
            variant="outline"
            className="h-14 text-lg font-bold"
            onClick={handleMiss}
            disabled={!currentTurn || darts.length >= 3}
          >
            MISS
          </Button>
          <Button
            variant="outline"
            className="h-14 text-lg font-bold text-orange-600"
            onClick={undoDart}
            disabled={!currentTurn || darts.length === 0}
          >
            UNDO
          </Button>
        </div>
      </div>

      {/* No active leg — show start button */}
      {!matchState.active_leg && matchState.legs.length > 0 && !legEndDialog && !matchEndDialog && (
        <div className="p-4 bg-white border-t">
          <Button
            className="w-full h-14 text-lg"
            onClick={() => {
              setStartingPlayer(match.player1_id);
              setNewLegDialog(true);
            }}
          >
            Nächstes Leg starten
          </Button>
        </div>
      )}

      {/* Leg End Dialog */}
      <Dialog open={legEndDialog} onOpenChange={setLegEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leg beendet!</DialogTitle>
          </DialogHeader>
          {legSummary && (
            <div className="space-y-2 text-center">
              <p className="text-lg font-bold">
                Gewinner:{" "}
                {(legSummary.winner_id as string) === match.player1_id
                  ? match.player1_name
                  : match.player2_name}
              </p>
              <p>
                Legs: {matchState.player1_legs_won} -{" "}
                {matchState.player2_legs_won}
              </p>
            </div>
          )}
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Wer beginnt das nächste Leg?
            </p>
            <select
              value={startingPlayer}
              onChange={(e) => setStartingPlayer(e.target.value)}
              className="h-12 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
            >
              <option value={match.player1_id}>
                {match.player1_name}
              </option>
              <option value={match.player2_id}>
                {match.player2_name}
              </option>
            </select>
          </div>
          <DialogFooter>
            <Button className="w-full h-12 text-lg" onClick={createLeg}>
              Nächstes Leg starten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Leg Dialog (first leg) */}
      <Dialog open={newLegDialog} onOpenChange={setNewLegDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wer beginnt?</DialogTitle>
          </DialogHeader>
          <select
            value={startingPlayer}
            onChange={(e) => setStartingPlayer(e.target.value)}
            className="h-12 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
          >
            <option value={match.player1_id}>
              {match.player1_name}
            </option>
            <option value={match.player2_id}>
              {match.player2_name}
            </option>
          </select>
          <DialogFooter>
            <Button className="w-full h-12 text-lg" onClick={createLeg}>
              Leg starten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Match End Dialog */}
      <Dialog open={matchEndDialog} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Spiel beendet!</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-3">
            {matchResult && (
              <>
                <p className="text-2xl font-bold">
                  Gewinner:{" "}
                  {(matchResult.winner_id as string) === match.player1_id
                    ? match.player1_name
                    : match.player2_name}
                </p>
                <p className="text-lg">
                  Legs: {matchState.player1_legs_won} -{" "}
                  {matchState.player2_legs_won}
                </p>
                <p className="text-sm text-muted-foreground">
                  Ø {matchState.player1_avg} - {matchState.player2_avg}
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button className="w-full h-12 text-lg" onClick={onMatchEnd}>
              Zurück zur Übersicht
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock Dialog */}
      <Dialog open={lockDialog} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Spiel gesperrt</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Dieses Spiel wird bereits von einem anderen Gerät erfasst.
          </p>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={onBack}>
              Zurück
            </Button>
            <Button onClick={forceTakeLock}>Trotzdem übernehmen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getCurrentRemaining(
  state: MatchState,
  playerId: string
): number {
  if (!state.active_leg) return 501;

  // Find last turn for this player in active leg
  const playerTurns = state.turns
    .filter((t) => t.player_id === playerId)
    .sort((a, b) => (a.turn_number as number) - (b.turn_number as number));

  if (playerTurns.length === 0) return 501;

  const lastTurn = playerTurns[playerTurns.length - 1];

  // If this is the current turn and it has darts, calculate live remaining
  if (
    state.current_turn &&
    state.current_turn.id === lastTurn.id
  ) {
    const darts = (lastTurn.darts as Dart[]) || [];
    let remaining = lastTurn.remaining_before as number;
    if (!lastTurn.is_bust) {
      for (const d of darts) {
        remaining -= d.score;
      }
    }
    return remaining;
  }

  return lastTurn.remaining_after as number;
}
