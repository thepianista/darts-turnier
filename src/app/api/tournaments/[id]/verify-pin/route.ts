import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { hashPin } from "@/lib/hash";

// POST /api/tournaments/[id]/verify-pin - Verify admin PIN
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { pin } = await request.json();

    const [tournament] = await sql`
      SELECT id, pin_hash, name, best_of FROM tournaments WHERE id = ${id}
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

    // Generate a simple session token
    const sessionToken = crypto.randomUUID();

    return NextResponse.json({
      sessionToken,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        best_of: tournament.best_of,
      },
    });
  } catch (error) {
    console.error("Verify PIN error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
