"use client";

import { useState } from "react";
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

export default function LandingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [bestOf, setBestOf] = useState("3");
  const [joinPin, setJoinPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleCreate = async () => {
    setError("");
    if (!name.trim()) {
      setError("Turniername erforderlich");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN muss 4 Ziffern haben");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          pin,
          best_of: parseInt(bestOf),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fehler beim Erstellen");
        return;
      }

      const tournament = await res.json();
      localStorage.setItem(`pin_${tournament.id}`, pin);
      setCreated(tournament);
    } catch {
      setError("Verbindungsfehler");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    setError("");
    if (!/^\d{4}$/.test(joinPin)) {
      setError("PIN muss 4 Ziffern haben");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/tournaments/find-by-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: joinPin }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Turnier nicht gefunden");
        return;
      }

      const { tournament_id } = await res.json();
      localStorage.setItem(`pin_${tournament_id}`, joinPin);
      router.push(`/admin/${tournament_id}`);
    } catch {
      setError("Verbindungsfehler");
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    const boardUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/board/${created.id}`
        : "";

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              Turnier erstellt!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-lg font-semibold">{created.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                PIN: <span className="font-mono font-bold text-lg">{pin}</span>
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                Scoreboard-Link (für TV/Beamer):
              </p>
              <div className="bg-muted p-3 rounded-md text-center">
                <code className="text-sm break-all">{boardUrl}</code>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full text-lg h-14"
                onClick={() => router.push(`/admin/${created.id}`)}
              >
                Zum Admin-Panel
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(boardUrl);
                }}
              >
                Scoreboard-Link kopieren
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-3xl">
            Darts Turnier
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {mode === "choose" && (
            <div className="flex flex-col gap-4">
              <Button
                size="lg"
                className="w-full text-lg h-14"
                onClick={() => setMode("create")}
              >
                Neues Turnier erstellen
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full text-lg h-14"
                onClick={() => setMode("join")}
              >
                Turnier beitreten
              </Button>
            </div>
          )}

          {mode === "create" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Turniername</Label>
                <Input
                  id="name"
                  placeholder="z.B. Freitagsturnier"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 text-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin">Admin-PIN (4 Ziffern)</Label>
                <Input
                  id="pin"
                  type="tel"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="0000"
                  value={pin}
                  onChange={(e) =>
                    setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  className="h-12 text-lg font-mono text-center tracking-widest"
                />
              </div>

              <div className="space-y-2">
                <Label>Best of</Label>
                <Select value={bestOf} onValueChange={(v) => v && setBestOf(v)}>
                  <SelectTrigger className="h-12 text-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Best of 1</SelectItem>
                    <SelectItem value="3">Best of 3</SelectItem>
                    <SelectItem value="5">Best of 5</SelectItem>
                    <SelectItem value="7">Best of 7</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p className="text-destructive text-sm text-center">{error}</p>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={() => {
                    setMode("choose");
                    setError("");
                  }}
                >
                  Zurück
                </Button>
                <Button
                  className="flex-1 h-12 text-lg"
                  onClick={handleCreate}
                  disabled={loading}
                >
                  {loading ? "Erstelle..." : "Erstellen"}
                </Button>
              </div>
            </div>
          )}

          {mode === "join" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="joinPin">Turnier-PIN eingeben</Label>
                <Input
                  id="joinPin"
                  type="tel"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="0000"
                  value={joinPin}
                  onChange={(e) =>
                    setJoinPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  className="h-12 text-lg font-mono text-center tracking-widest"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-destructive text-sm text-center">{error}</p>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={() => {
                    setMode("choose");
                    setError("");
                  }}
                >
                  Zurück
                </Button>
                <Button
                  className="flex-1 h-12 text-lg"
                  onClick={handleJoin}
                  disabled={loading}
                >
                  {loading ? "Suche..." : "Beitreten"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
