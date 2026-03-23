import { NextRequest, NextResponse } from "next/server";
import sql, { parseDarts } from "@/lib/db";
import { parseSegment, checkDartResult } from "@/lib/scoring";
import { Dart } from "@/lib/types";

// PATCH /api/turns/[turnId] - Update turn (add dart or undo last dart)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ turnId: string }> }
) {
  try {
    const { turnId } = await params;
    const body = await request.json();

    const [turn] = await sql`SELECT * FROM turns WHERE id = ${turnId}`;
    if (!turn) {
      return NextResponse.json(
        { error: "Aufnahme nicht gefunden" },
        { status: 404 }
      );
    }

    const darts: Dart[] = parseDarts<Dart>(turn.darts);

    // Undo last dart
    if (body.action === "undo") {
      if (darts.length === 0) {
        return NextResponse.json(
          { error: "Keine Darts zum Rückgängigmachen" },
          { status: 400 }
        );
      }

      const newDarts = darts.slice(0, -1);

      // Recalculate remaining after
      let remaining = turn.remaining_before;
      for (const d of newDarts) {
        remaining -= d.score;
      }

      const [updated] = await sql`
        UPDATE turns
        SET darts = ${JSON.stringify(newDarts)}::jsonb,
            remaining_after = ${remaining},
            is_bust = false
        WHERE id = ${turnId}
        RETURNING *
      `;

      return NextResponse.json({
        turn: fixTurn(updated),
        status: "ok",
      });
    }

    // Add dart
    if (!body.segment) {
      return NextResponse.json(
        { error: "Segment erforderlich" },
        { status: 400 }
      );
    }

    if (darts.length >= 3) {
      return NextResponse.json(
        { error: "Aufnahme ist bereits vollständig" },
        { status: 400 }
      );
    }

    const dartNumber = darts.length + 1;
    const dart = parseSegment(body.segment, dartNumber);

    if (!dart) {
      return NextResponse.json(
        { error: "Ungültiges Segment" },
        { status: 400 }
      );
    }

    // Calculate current remaining (after previous darts in this turn)
    let currentRemaining = turn.remaining_before;
    for (const d of darts) {
      currentRemaining -= d.score;
    }

    const result = checkDartResult(currentRemaining, dart);
    const newDarts = [...darts, dart];

    if (result === "bust") {
      // Bust: score reverts to start-of-turn value
      const [updated] = await sql`
        UPDATE turns
        SET darts = ${JSON.stringify(newDarts)}::jsonb,
            remaining_after = ${turn.remaining_before},
            is_bust = true
        WHERE id = ${turnId}
        RETURNING *
      `;

      // Create next turn for other player
      const nextTurn = await createNextTurn(turn);

      return NextResponse.json({
        turn: fixTurn(updated),
        status: "bust",
        next_turn: nextTurn,
      });
    }

    if (result === "checkout") {
      // Checkout: leg won
      const remainingAfter = 0;
      const [updated] = await sql`
        UPDATE turns
        SET darts = ${JSON.stringify(newDarts)}::jsonb,
            remaining_after = ${remainingAfter},
            is_bust = false
        WHERE id = ${turnId}
        RETURNING *
      `;

      // Mark leg as finished
      const [leg] = await sql`
        UPDATE legs
        SET status = 'finished', winner_id = ${turn.player_id}
        WHERE id = ${turn.leg_id}
        RETURNING *
      `;

      // Check if match is won
      const matchResult = await checkMatchWon(leg.match_id, turn.player_id);

      return NextResponse.json({
        turn: fixTurn(updated),
        status: "checkout",
        leg,
        match_won: matchResult.won,
        match: matchResult.match,
      });
    }

    // Normal dart
    const remainingAfter = currentRemaining - dart.score;
    const [updated] = await sql`
      UPDATE turns
      SET darts = ${JSON.stringify(newDarts)}::jsonb,
          remaining_after = ${remainingAfter},
          is_bust = false
      WHERE id = ${turnId}
      RETURNING *
    `;

    // Auto-submit after 3rd dart
    if (newDarts.length === 3) {
      const nextTurn = await createNextTurn(turn, remainingAfter);
      return NextResponse.json({
        turn: fixTurn(updated),
        status: "turn_complete",
        next_turn: nextTurn,
      });
    }

    return NextResponse.json({
      turn: fixTurn(updated),
      status: "ok",
    });
  } catch (error) {
    console.error("Update turn error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

async function createNextTurn(
  currentTurn: Record<string, unknown>,
  remainingOverride?: number
) {
  const legId = currentTurn.leg_id as string;
  const currentPlayerId = currentTurn.player_id as string;

  // Get the leg to find the match
  const [leg] = await sql`SELECT * FROM legs WHERE id = ${legId}`;
  const [match] = await sql`SELECT * FROM matches WHERE id = ${leg.match_id}`;

  // Determine next player
  const nextPlayerId =
    currentPlayerId === match.player1_id
      ? match.player2_id
      : match.player1_id;

  // Get remaining for next player (their last remaining_after, or 501 if first turn)
  let nextRemaining = 501;
  if (remainingOverride === undefined) {
    // bust case: current player's remaining doesn't change, get next player's remaining
    const [lastTurn] = await sql`
      SELECT remaining_after FROM turns
      WHERE leg_id = ${legId} AND player_id = ${nextPlayerId}
      ORDER BY turn_number DESC
      LIMIT 1
    `;
    if (lastTurn) {
      nextRemaining = lastTurn.remaining_after;
    }
  } else {
    // normal complete: get next player's remaining
    const [lastTurn] = await sql`
      SELECT remaining_after FROM turns
      WHERE leg_id = ${legId} AND player_id = ${nextPlayerId}
      ORDER BY turn_number DESC
      LIMIT 1
    `;
    if (lastTurn) {
      nextRemaining = lastTurn.remaining_after;
    }
  }

  const nextTurnNumber = (currentTurn.turn_number as number) + 1;

  const [newTurn] = await sql`
    INSERT INTO turns (leg_id, player_id, turn_number, remaining_before, remaining_after)
    VALUES (${legId}, ${nextPlayerId}, ${nextTurnNumber}, ${nextRemaining}, ${nextRemaining})
    RETURNING *
  `;

  return newTurn;
}

// Ensure darts field is parsed array in response
function fixTurn(turn: Record<string, unknown>) {
  return { ...turn, darts: parseDarts<Dart>(turn.darts) };
}

async function checkMatchWon(matchId: string, playerId: string) {
  const [match] = await sql`
    SELECT m.*, t.best_of
    FROM matches m
    JOIN tournaments t ON m.tournament_id = t.id
    WHERE m.id = ${matchId}
  `;

  const legsToWin = Math.ceil(match.best_of / 2);

  const [{ count }] = await sql`
    SELECT COUNT(*)::int as count FROM legs
    WHERE match_id = ${matchId} AND winner_id = ${playerId}
  `;

  if (count >= legsToWin) {
    // Match won
    const [updated] = await sql`
      UPDATE matches
      SET status = 'finished', winner_id = ${playerId}, lock_token = NULL, updated_at = now()
      WHERE id = ${matchId}
      RETURNING *
    `;
    return { won: true, match: updated };
  }

  return { won: false, match };
}
