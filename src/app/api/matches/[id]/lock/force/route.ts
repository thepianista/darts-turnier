import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

// POST /api/matches/[id]/lock/force - Force-take lock
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lockToken = request.headers.get("X-Lock-Token");

    if (!lockToken) {
      return NextResponse.json(
        { error: "Lock-Token erforderlich" },
        { status: 400 }
      );
    }

    const [match] = await sql`
      SELECT id FROM matches WHERE id = ${id}
    `;

    if (!match) {
      return NextResponse.json(
        { error: "Spiel nicht gefunden" },
        { status: 404 }
      );
    }

    await sql`
      UPDATE matches SET lock_token = ${lockToken}, updated_at = now()
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Force lock error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
