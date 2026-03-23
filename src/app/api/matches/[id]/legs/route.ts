import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

// POST /api/matches/[matchId]/legs - Create next leg
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const matchId = (await params).id;
    const { starting_player_id } = await request.json();

    if (!starting_player_id) {
      return NextResponse.json(
        { error: "Startspieler erforderlich" },
        { status: 400 }
      );
    }

    const [match] = await sql`
      SELECT * FROM matches WHERE id = ${matchId}
    `;

    if (!match) {
      return NextResponse.json(
        { error: "Spiel nicht gefunden" },
        { status: 404 }
      );
    }

    if (match.status !== "active") {
      return NextResponse.json(
        { error: "Spiel ist nicht aktiv" },
        { status: 400 }
      );
    }

    // Check no active leg exists
    const activeLegs = await sql`
      SELECT id FROM legs WHERE match_id = ${matchId} AND status = 'active'
    `;

    if (activeLegs.length > 0) {
      return NextResponse.json(
        { error: "Es gibt bereits ein aktives Leg" },
        { status: 409 }
      );
    }

    // Get next leg number
    const [{ count }] = await sql`
      SELECT COUNT(*)::int as count FROM legs WHERE match_id = ${matchId}
    `;

    const legNumber = count + 1;

    const [leg] = await sql`
      INSERT INTO legs (match_id, leg_number, starting_player_id)
      VALUES (${matchId}, ${legNumber}, ${starting_player_id})
      RETURNING *
    `;

    // Create first turn for starting player
    const [turn] = await sql`
      INSERT INTO turns (leg_id, player_id, turn_number, remaining_before, remaining_after)
      VALUES (${leg.id}, ${starting_player_id}, 1, 501, 501)
      RETURNING *
    `;

    return NextResponse.json({ leg, turn }, { status: 201 });
  } catch (error) {
    console.error("Create leg error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
