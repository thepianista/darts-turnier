import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

// POST /api/matches/[id]/lock - Acquire scorekeeper lock
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
      SELECT id, lock_token, status FROM matches WHERE id = ${id}
    `;

    if (!match) {
      return NextResponse.json(
        { error: "Spiel nicht gefunden" },
        { status: 404 }
      );
    }

    if (match.lock_token && match.lock_token !== lockToken) {
      return NextResponse.json(
        { error: "Spiel wird bereits von einem anderen Gerät erfasst", locked: true },
        { status: 409 }
      );
    }

    await sql`
      UPDATE matches SET lock_token = ${lockToken}, updated_at = now()
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Acquire lock error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// DELETE /api/matches/[id]/lock - Release scorekeeper lock
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.nextUrl.searchParams.get("token");

    await sql`
      UPDATE matches SET lock_token = NULL, updated_at = now()
      WHERE id = ${id} AND (lock_token = ${token} OR lock_token IS NULL)
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Release lock error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
