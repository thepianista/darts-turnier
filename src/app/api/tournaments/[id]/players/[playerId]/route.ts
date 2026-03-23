import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

// DELETE /api/tournaments/[id]/players/[playerId] - Remove player
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  try {
    const { id, playerId } = await params;

    // Check player is not in any active/pending match
    const activeMatches = await sql`
      SELECT id FROM matches
      WHERE tournament_id = ${id}
        AND (player1_id = ${playerId} OR player2_id = ${playerId})
        AND status != 'finished'
    `;

    if (activeMatches.length > 0) {
      return NextResponse.json(
        { error: "Spieler ist in einem laufenden Spiel" },
        { status: 409 }
      );
    }

    const result = await sql`
      DELETE FROM players
      WHERE id = ${playerId} AND tournament_id = ${id}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Spieler nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete player error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
