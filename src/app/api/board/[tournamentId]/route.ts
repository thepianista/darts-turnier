import { NextRequest, NextResponse } from "next/server";
import sql, { parseDarts } from "@/lib/db";

// GET /api/board/[tournamentId] - Aggregated scoreboard data
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params;

    const [tournament] = await sql`
      SELECT id, name, best_of FROM tournaments WHERE id = ${tournamentId}
    `;

    if (!tournament) {
      return NextResponse.json(
        { error: "Turnier nicht gefunden" },
        { status: 404 }
      );
    }

    // Get all players
    const players = await sql`
      SELECT id, name, nickname FROM players
      WHERE tournament_id = ${tournamentId}
      ORDER BY created_at ASC
    `;

    // Get all matches with player info
    const matches = await sql`
      SELECT m.*,
        p1.name as player1_name, p1.nickname as player1_nickname,
        p2.name as player2_name, p2.nickname as player2_nickname,
        w.name as winner_name
      FROM matches m
      JOIN players p1 ON m.player1_id = p1.id
      JOIN players p2 ON m.player2_id = p2.id
      LEFT JOIN players w ON m.winner_id = w.id
      WHERE m.tournament_id = ${tournamentId}
      ORDER BY m.created_at ASC
    `;

    // Find active match
    const activeMatch = matches.find(
      (m: Record<string, unknown>) => m.status === "active"
    );

    let activeMatchState = null;

    if (activeMatch) {
      // Get full state for active match
      const legs = await sql`
        SELECT * FROM legs
        WHERE match_id = ${activeMatch.id}
        ORDER BY leg_number ASC
      `;

      const [p1Legs] = await sql`
        SELECT COUNT(*)::int as count FROM legs
        WHERE match_id = ${activeMatch.id} AND winner_id = ${activeMatch.player1_id}
      `;
      const [p2Legs] = await sql`
        SELECT COUNT(*)::int as count FROM legs
        WHERE match_id = ${activeMatch.id} AND winner_id = ${activeMatch.player2_id}
      `;

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

        if (turns.length > 0) {
          const lastTurn = turns[turns.length - 1];
          const darts = parseDarts(lastTurn.darts);
          if (darts.length < 3 && !lastTurn.is_bust) {
            currentTurn = lastTurn;
          }
        }
      }

      // Calculate averages for match
      const allTurns = await sql`
        SELECT t.player_id, t.darts, t.is_bust, t.remaining_before, t.remaining_after
        FROM turns t
        JOIN legs l ON t.leg_id = l.id
        WHERE l.match_id = ${activeMatch.id}
      `;

      const calcAvg = (playerId: string) => {
        const playerTurns = allTurns.filter(
          (t: Record<string, unknown>) => t.player_id === playerId
        );
        if (playerTurns.length === 0) return 0;

        let totalScore = 0;
        let totalTurns = 0;
        for (const t of playerTurns) {
          const darts = parseDarts(t.darts);
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

      // Last finished leg (for summary)
      const lastFinishedLeg = [...legs]
        .reverse()
        .find((l: Record<string, unknown>) => l.status === "finished");

      let legSummary = null;
      if (lastFinishedLeg && !activeLeg) {
        // Show summary between legs
        const legTurns = await sql`
          SELECT * FROM turns WHERE leg_id = ${lastFinishedLeg.id} ORDER BY turn_number ASC
        `;

        const winnerId = lastFinishedLeg.winner_id as string;
        const winnerTurns = legTurns.filter(
          (t: Record<string, unknown>) => t.player_id === winnerId
        );

        let totalDarts = 0;
        let totalScore = 0;
        let highestTurn = 0;
        for (const t of winnerTurns) {
          const darts = parseDarts(t.darts);
          totalDarts += darts.length;
          const turnScore = t.is_bust ? 0 : (t.remaining_before as number) - (t.remaining_after as number);
          totalScore += turnScore;
          if (turnScore > highestTurn) highestTurn = turnScore;
        }

        legSummary = {
          leg: lastFinishedLeg,
          winner_id: winnerId,
          darts_thrown: totalDarts,
          avg: winnerTurns.length > 0
            ? Math.round((totalScore / winnerTurns.length) * 3 * 100) / 100
            : 0,
          highest_turn: highestTurn,
        };
      }

      activeMatchState = {
        match: activeMatch,
        legs,
        player1_legs_won: p1Legs.count,
        player2_legs_won: p2Legs.count,
        active_leg: activeLeg || null,
        turns: turns.map((t: Record<string, unknown>) => ({ ...t, darts: parseDarts(t.darts) })),
        current_turn: currentTurn ? { ...currentTurn, darts: parseDarts(currentTurn.darts) } : null,
        player1_avg: calcAvg(activeMatch.player1_id as string),
        player2_avg: calcAvg(activeMatch.player2_id as string),
        leg_summary: legSummary,
      };
    }

    // Standings: wins/losses per player
    const standings = players.map((p: Record<string, unknown>) => {
      const matchesWon = matches.filter(
        (m: Record<string, unknown>) =>
          m.status === "finished" && m.winner_id === p.id
      ).length;
      const matchesLost = matches.filter(
        (m: Record<string, unknown>) =>
          m.status === "finished" &&
          m.winner_id !== p.id &&
          (m.player1_id === p.id || m.player2_id === p.id)
      ).length;

      return {
        ...p,
        matches_won: matchesWon,
        matches_lost: matchesLost,
      };
    });

    return NextResponse.json({
      tournament,
      players,
      matches,
      active_match: activeMatchState,
      standings,
    });
  } catch (error) {
    console.error("Board data error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
