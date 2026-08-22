import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setBedPref } from "@/lib/beds/store";

// POST /api/beds/pref { bedId, pref } — set/clear a want/reject preference.
// pref "want" | "reject" upserts; pref null (or DELETE) clears it.
export async function POST(request: Request) {
  const { bedId, pref } = await request.json();
  if (!bedId || typeof bedId !== "string") {
    return NextResponse.json({ error: "bedId is required" }, { status: 400 });
  }
  if (pref != null && pref !== "want" && pref !== "reject") {
    return NextResponse.json({ error: "pref must be 'want', 'reject', or null" }, { status: 400 });
  }
  await setBedPref(prisma, bedId, pref ?? null);
  return NextResponse.json({ ok: true, pref: pref ?? null });
}

export async function DELETE(request: Request) {
  const { bedId } = await request.json();
  if (!bedId) return NextResponse.json({ error: "bedId is required" }, { status: 400 });
  await setBedPref(prisma, bedId, null);
  return NextResponse.json({ ok: true });
}
