import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { hashPin } from "@/lib/hash";

// GET /api/tournaments/[id] - Get tournament details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [tournament] = await sql`
      SELECT id, name, best_of, created_at, updated_at
      FROM tournaments WHERE id = ${id}
    `;

    if (!tournament) {
      return NextResponse.json(
        { error: "Turnier nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json(tournament);
  } catch (error) {
    console.error("Get tournament error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// DELETE /api/tournaments/[id] - Delete tournament (requires PIN)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { pin } = await request.json();

    const [tournament] = await sql`
      SELECT pin_hash FROM tournaments WHERE id = ${id}
    `;

    if (!tournament) {
      return NextResponse.json(
        { error: "Turnier nicht gefunden" },
        { status: 404 }
      );
    }

    const pinHash = await hashPin(pin);
    if (pinHash !== tournament.pin_hash) {
      return NextResponse.json(
        { error: "Falsche PIN" },
        { status: 403 }
      );
    }

    await sql`DELETE FROM tournaments WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete tournament error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
