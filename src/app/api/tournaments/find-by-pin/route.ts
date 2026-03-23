import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { hashPin } from "@/lib/hash";

// POST /api/tournaments/find-by-pin - Find tournament by PIN
export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json();

    if (!pin || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: "4-stellige PIN erforderlich" },
        { status: 400 }
      );
    }

    const pinHash = await hashPin(pin);

    const [tournament] = await sql`
      SELECT id FROM tournaments
      WHERE pin_hash = ${pinHash}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!tournament) {
      return NextResponse.json(
        { error: "Kein Turnier mit dieser PIN gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json({ tournament_id: tournament.id });
  } catch (error) {
    console.error("Find by PIN error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
