"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { DartScoring } from "@/components/dart-scoring";

interface Tournament {
  id: string;
  name: string;
  best_of: number;
}

interface Player {
  id: string;
  name: string;
  nickname: string | null;
}

interface Match {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_name: string;
  player2_name: string;
  status: "pending" | "active" | "finished";
  winner_id: string | null;
  winner_name: string | null;
}

export default function AdminPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerNickname, setNewPlayerNickname] = useState("");
  const [matchPlayer1, setMatchPlayer1] = useState("");
  const [matchPlayer2, setMatchPlayer2] = useState("");
  const [error, setError] = useState("");
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePin, setDeletePin] = useState("");
  const [sessionToken, setSessionToken] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [tRes, pRes, mRes] = await Promise.all([
        fetch(`/api/tournaments/${tournamentId}`),
        fetch(`/api/tournaments/${tournamentId}/players`),
        fetch(`/api/tournaments/${tournamentId}/matches`),
      ]);

      if (tRes.ok) setTournament(await tRes.json());
      if (pRes.ok) setPlayers(await pRes.json());
      if (mRes.ok) {
        const matchData = await mRes.json();
        setMatches(matchData);
        const active = matchData.find(
          (m: Match) => m.status === "active"
        );
        setActiveMatch(active || null);
      }
    } catch {
      setError("Verbindungsfehler");
    }
  }, [tournamentId]);

  useEffect(() => {
    // Check stored PIN
    const storedPin = localStorage.getItem(`pin_${tournamentId}`);
    if (storedPin) {
      verifyPin(storedPin);
    }
  }, [tournamentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const verifyPin = async (pin: string) => {
    try {
      const res = await fetch(
        `/api/tournaments/${tournamentId}/verify-pin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        }
      );

      if (!res.ok) {
        setPinError("Falsche PIN");
        localStorage.removeItem(`pin_${tournamentId}`);
        return;
      }

      const data = await res.json();
      setSessionToken(data.sessionToken);
      localStorage.setItem(`pin_${tournamentId}`, pin);
      setAuthenticated(true);
      loadData();
    } catch {
      setPinError("Verbindungsfehler");
    }
  };

  const handlePinSubmit = () => {
    setPinError("");
    if (!/^\d{4}$/.test(pinInput)) {
      setPinError("PIN muss 4 Ziffern haben");
      return;
    }
    verifyPin(pinInput);
  };

  const addPlayer = async () => {
    if (!newPlayerName.trim()) return;
    setError("");

    const res = await fetch(`/api/tournaments/${tournamentId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newPlayerName.trim(),
        nickname: newPlayerNickname.trim() || null,
      }),
    });

    if (res.ok) {
      setNewPlayerName("");
      setNewPlayerNickname("");
      loadData();
    } else {
      const data = await res.json();
      setError(data.error);
    }
  };

  const removePlayer = async (playerId: string) => {
    const res = await fetch(
      `/api/tournaments/${tournamentId}/players/${playerId}`,
      { method: "DELETE" }
    );

    if (res.ok) {
      loadData();
    } else {
      const data = await res.json();
      setError(data.error);
    }
  };

  const createMatch = async () => {
    if (!matchPlayer1 || !matchPlayer2) return;
    setError("");

    const res = await fetch(`/api/tournaments/${tournamentId}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        player1_id: matchPlayer1,
        player2_id: matchPlayer2,
      }),
    });

    if (res.ok) {
      setMatchPlayer1("");
      setMatchPlayer2("");
      loadData();
    } else {
      const data = await res.json();
      setError(data.error);
    }
  };

  const startMatch = async (matchId: string) => {
    setError("");
    const res = await fetch(`/api/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });

    if (res.ok) {
      loadData();
    } else {
      const data = await res.json();
      setError(data.error);
    }
  };

  const deleteTournament = async () => {
    const res = await fetch(`/api/tournaments/${tournamentId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: deletePin }),
    });

    if (res.ok) {
      localStorage.removeItem(`pin_${tournamentId}`);
      router.push("/");
    } else {
      const data = await res.json();
      setError(data.error);
    }
  };

  // PIN gate
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-center">Admin-Zugang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>PIN eingeben</Label>
              <Input
                type="tel"
                inputMode="numeric"
                maxLength={4}
                placeholder="0000"
                value={pinInput}
                onChange={(e) =>
                  setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
                className="h-14 text-2xl font-mono text-center tracking-widest"
                autoFocus
              />
            </div>
            {pinError && (
              <p className="text-destructive text-sm text-center">
                {pinError}
              </p>
            )}
            <Button
              className="w-full h-12 text-lg"
              onClick={handlePinSubmit}
            >
              Bestätigen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active match scoring view
  if (activeMatch) {
    return (
      <DartScoring
        match={activeMatch}
        tournament={tournament!}
        sessionToken={sessionToken}
        onMatchEnd={() => {
          setActiveMatch(null);
          loadData();
        }}
        onBack={() => {
          setActiveMatch(null);
          loadData();
        }}
      />
    );
  }

  // Tournament management view
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{tournament?.name}</h1>
            <p className="text-sm text-muted-foreground">
              Best of {tournament?.best_of}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            Löschen
          </Button>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <Separator />

        {/* Players */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spieler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {players.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-2 px-3 bg-muted rounded-md"
                >
                  <span>
                    {p.name}
                    {p.nickname && (
                      <span className="text-muted-foreground ml-1">
                        ({p.nickname})
                      </span>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePlayer(p.id)}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Name"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                className="h-12"
              />
              <Input
                placeholder="Spitzname"
                value={newPlayerNickname}
                onChange={(e) => setNewPlayerNickname(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                className="h-12 w-32"
              />
              <Button className="h-12 px-6" onClick={addPlayer}>
                +
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Create Match */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Neues Spiel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Spieler 1</Label>
                <Select
                  value={matchPlayer1}
                  onValueChange={(v) => v && setMatchPlayer1(v)}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {players
                      .filter((p) => p.id !== matchPlayer2)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Spieler 2</Label>
                <Select
                  value={matchPlayer2}
                  onValueChange={(v) => v && setMatchPlayer2(v)}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {players
                      .filter((p) => p.id !== matchPlayer1)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="w-full h-12"
              onClick={createMatch}
              disabled={!matchPlayer1 || !matchPlayer2}
            >
              Spiel erstellen
            </Button>
          </CardContent>
        </Card>

        {/* Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spiele</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {matches.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Noch keine Spiele erstellt
              </p>
            )}
            {matches.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between py-3 px-4 bg-muted rounded-md"
              >
                <div>
                  <p className="font-medium">
                    {m.player1_name} vs {m.player2_name}
                  </p>
                  {m.status === "finished" && m.winner_name && (
                    <p className="text-sm text-muted-foreground">
                      Gewinner: {m.winner_name}
                    </p>
                  )}
                </div>
                {m.status === "pending" && (
                  <Button
                    size="sm"
                    className="h-10"
                    onClick={() => startMatch(m.id)}
                  >
                    Starten
                  </Button>
                )}
                {m.status === "active" && (
                  <Button
                    size="sm"
                    className="h-10"
                    onClick={() => setActiveMatch(m)}
                  >
                    Scoring
                  </Button>
                )}
                {m.status === "finished" && (
                  <span className="text-sm text-muted-foreground">
                    Beendet
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Delete Tournament Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Turnier löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Alle Daten werden unwiderruflich gelöscht.
          </p>
          <div className="space-y-2">
            <Label>PIN zur Bestätigung</Label>
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              value={deletePin}
              onChange={(e) =>
                setDeletePin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className="h-12 font-mono text-center"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={deleteTournament}>
              Endgültig löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
