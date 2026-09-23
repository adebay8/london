import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setSofaBedPref } from "@/lib/sofabeds/store";

// POST /api/sofa-beds/pref { sofaBedId, pref } — set/clear a want/reject.
export async function POST(request: Request) {
  const { sofaBedId, pref } = await request.json();
  if (!sofaBedId || typeof sofaBedId !== "string") {
    return NextResponse.json({ error: "sofaBedId is required" }, { status: 400 });
  }
  if (pref != null && pref !== "want" && pref !== "reject") {
    return NextResponse.json({ error: "pref must be 'want', 'reject', or null" }, { status: 400 });
  }
  await setSofaBedPref(prisma, sofaBedId, pref ?? null);
  return NextResponse.json({ ok: true, pref: pref ?? null });
}

export async function DELETE(request: Request) {
  const { sofaBedId } = await request.json();
  // Unlike the sofas route, DELETE validates type as POST does, to prevent Prisma errors on malformed where clauses.
  if (!sofaBedId || typeof sofaBedId !== "string") {
    return NextResponse.json({ error: "sofaBedId is required" }, { status: 400 });
  }
  await setSofaBedPref(prisma, sofaBedId, null);
  return NextResponse.json({ ok: true });
}
