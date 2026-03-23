import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

// GET /api/tournaments/[id]/players - List players
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const players = await sql`
      SELECT id, name, nickname, created_at
      FROM players
      WHERE tournament_id = ${id}
      ORDER BY created_at ASC
    `;

    return NextResponse.json(players);
  } catch (error) {
    console.error("List players error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// POST /api/tournaments/[id]/players - Add player
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, nickname } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Spielername erforderlich" },
        { status: 400 }
      );
    }

    const [player] = await sql`
      INSERT INTO players (tournament_id, name, nickname)
      VALUES (${id}, ${name.trim()}, ${nickname?.trim() || null})
      RETURNING id, name, nickname, created_at
    `;

    return NextResponse.json(player, { status: 201 });
  } catch (error) {
    console.error("Add player error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
