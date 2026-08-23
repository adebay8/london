import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setSofaPref } from "@/lib/sofas/store";

// POST /api/sofas/pref { sofaId, pref } — set/clear a want/reject preference.
export async function POST(request: Request) {
  const { sofaId, pref } = await request.json();
  if (!sofaId || typeof sofaId !== "string") {
    return NextResponse.json({ error: "sofaId is required" }, { status: 400 });
  }
  if (pref != null && pref !== "want" && pref !== "reject") {
    return NextResponse.json({ error: "pref must be 'want', 'reject', or null" }, { status: 400 });
  }
  await setSofaPref(prisma, sofaId, pref ?? null);
  return NextResponse.json({ ok: true, pref: pref ?? null });
}

export async function DELETE(request: Request) {
  const { sofaId } = await request.json();
  if (!sofaId) return NextResponse.json({ error: "sofaId is required" }, { status: 400 });
  await setSofaPref(prisma, sofaId, null);
  return NextResponse.json({ ok: true });
}
