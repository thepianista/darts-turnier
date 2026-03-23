import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

// GET /api/matches/[matchId]/state - Get full match state
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const matchId = (await params).id;

    const [match] = await sql`
      SELECT m.*,
        p1.name as player1_name, p1.nickname as player1_nickname,
        p2.name as player2_name, p2.nickname as player2_nickname,
        t.best_of
      FROM matches m
      JOIN players p1 ON m.player1_id = p1.id
      JOIN players p2 ON m.player2_id = p2.id
      JOIN tournaments t ON m.tournament_id = t.id
      WHERE m.id = ${matchId}
    `;

    if (!match) {
      return NextResponse.json(
        { error: "Spiel nicht gefunden" },
        { status: 404 }
      );
    }

    // Get all legs
    const legs = await sql`
      SELECT * FROM legs
      WHERE match_id = ${matchId}
      ORDER BY leg_number ASC
    `;

    // Get legs won count
    const [p1Legs] = await sql`
      SELECT COUNT(*)::int as count FROM legs
      WHERE match_id = ${matchId} AND winner_id = ${match.player1_id}
    `;
    const [p2Legs] = await sql`
      SELECT COUNT(*)::int as count FROM legs
      WHERE match_id = ${matchId} AND winner_id = ${match.player2_id}
    `;

    // Get active leg turns
    const activeLeg = legs.find(
      (l: Record<string, unknown>) => l.status === "active"
    );
    let turns: Record<string, unknown>[] = [];
    let currentTurn = null;

    if (activeLeg) {
      turns = await sql`
        SELECT * FROM turns
        WHERE leg_id = ${activeLeg.id}
        ORDER BY turn_number ASC
      `;

      // Current turn is the last one
      if (turns.length > 0) {
        const lastTurn = turns[turns.length - 1];
        const darts = (lastTurn.darts as unknown[]) || [];
        if (darts.length < 3 && !lastTurn.is_bust) {
          currentTurn = lastTurn;
        }
      }
    }

    // Calculate 3-dart averages
    const allTurns = await sql`
      SELECT t.player_id, t.darts, t.is_bust, t.remaining_before, t.remaining_after
      FROM turns t
      JOIN legs l ON t.leg_id = l.id
      WHERE l.match_id = ${matchId}
    `;

    const calcAvg = (playerId: string) => {
      const playerTurns = allTurns.filter(
        (t: Record<string, unknown>) => t.player_id === playerId
      );
      if (playerTurns.length === 0) return 0;

      let totalScore = 0;
      let totalTurns = 0;
      for (const t of playerTurns) {
        const darts = (t.darts as unknown[]) || [];
        if (darts.length === 0) continue;
        if (t.is_bust) {
          totalTurns++;
          continue;
        }
        totalScore += (t.remaining_before as number) - (t.remaining_after as number);
        totalTurns++;
      }

      if (totalTurns === 0) return 0;
      return Math.round((totalScore / totalTurns) * 3 * 100) / 100;
    };

    return NextResponse.json({
      match,
      legs,
      player1_legs_won: p1Legs.count,
      player2_legs_won: p2Legs.count,
      active_leg: activeLeg || null,
      turns,
      current_turn: currentTurn,
      player1_avg: calcAvg(match.player1_id),
      player2_avg: calcAvg(match.player2_id),
    });
  } catch (error) {
    console.error("Match state error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
