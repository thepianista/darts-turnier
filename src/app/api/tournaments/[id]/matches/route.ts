import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

// GET /api/tournaments/[id]/matches - List matches
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const matches = await sql`
      SELECT m.*,
        p1.name as player1_name, p1.nickname as player1_nickname,
        p2.name as player2_name, p2.nickname as player2_nickname,
        w.name as winner_name
      FROM matches m
      JOIN players p1 ON m.player1_id = p1.id
      JOIN players p2 ON m.player2_id = p2.id
      LEFT JOIN players w ON m.winner_id = w.id
      WHERE m.tournament_id = ${id}
      ORDER BY m.created_at ASC
    `;

    return NextResponse.json(matches);
  } catch (error) {
    console.error("List matches error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// POST /api/tournaments/[id]/matches - Create match
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { player1_id, player2_id } = await request.json();

    if (!player1_id || !player2_id) {
      return NextResponse.json(
        { error: "Zwei Spieler erforderlich" },
        { status: 400 }
      );
    }

    if (player1_id === player2_id) {
      return NextResponse.json(
        { error: "Spieler dürfen nicht identisch sein" },
        { status: 400 }
      );
    }

    const [match] = await sql`
      INSERT INTO matches (tournament_id, player1_id, player2_id)
      VALUES (${id}, ${player1_id}, ${player2_id})
      RETURNING *
    `;

    return NextResponse.json(match, { status: 201 });
  } catch (error) {
    console.error("Create match error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
