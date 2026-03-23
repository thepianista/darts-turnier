import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

// PATCH /api/matches/[id] - Update match (start, finish)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const [match] = await sql`
      SELECT * FROM matches WHERE id = ${id}
    `;

    if (!match) {
      return NextResponse.json(
        { error: "Spiel nicht gefunden" },
        { status: 404 }
      );
    }

    // Start match
    if (body.status === "active") {
      if (match.status !== "pending") {
        return NextResponse.json(
          { error: "Spiel kann nur aus Status 'pending' gestartet werden" },
          { status: 400 }
        );
      }

      // Check no other match is active in this tournament
      const activeMatches = await sql`
        SELECT id FROM matches
        WHERE tournament_id = ${match.tournament_id}
          AND status = 'active'
          AND id != ${id}
      `;

      if (activeMatches.length > 0) {
        return NextResponse.json(
          { error: "Es läuft bereits ein anderes Spiel" },
          { status: 409 }
        );
      }

      const [updated] = await sql`
        UPDATE matches
        SET status = 'active', updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;

      return NextResponse.json(updated);
    }

    // Finish match
    if (body.status === "finished" && body.winner_id) {
      const [updated] = await sql`
        UPDATE matches
        SET status = 'finished', winner_id = ${body.winner_id}, lock_token = NULL, updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;

      return NextResponse.json(updated);
    }

    return NextResponse.json(
      { error: "Ungültige Aktualisierung" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Update match error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
