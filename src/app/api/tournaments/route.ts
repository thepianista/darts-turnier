import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { hashPin } from "@/lib/hash";

// POST /api/tournaments - Create tournament
export async function POST(request: NextRequest) {
  try {
    const { name, pin, best_of = 3 } = await request.json();

    if (!name || !pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: "Name und 4-stellige PIN erforderlich" },
        { status: 400 }
      );
    }

    if (![1, 3, 5, 7].includes(best_of)) {
      return NextResponse.json(
        { error: "Best-of muss 1, 3, 5 oder 7 sein" },
        { status: 400 }
      );
    }

    const pinHash = await hashPin(pin);

    const [tournament] = await sql`
      INSERT INTO tournaments (name, pin_hash, best_of)
      VALUES (${name}, ${pinHash}, ${best_of})
      RETURNING id, name, best_of, created_at
    `;

    return NextResponse.json(tournament, { status: 201 });
  } catch (error) {
    console.error("Create tournament error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
