import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/flats/pref { listingId, pref } — set/clear a want/reject preference.
// pref "want" | "reject" upserts; pref null (or DELETE) clears it.
export async function POST(request: Request) {
  const { listingId, pref } = await request.json();
  if (!listingId || typeof listingId !== "string") {
    return NextResponse.json({ error: "listingId is required" }, { status: 400 });
  }
  if (pref == null) {
    await prisma.flatPref.deleteMany({ where: { listingId } });
    return NextResponse.json({ ok: true, pref: null });
  }
  if (pref !== "want" && pref !== "reject") {
    return NextResponse.json({ error: "pref must be 'want', 'reject', or null" }, { status: 400 });
  }
  await prisma.flatPref.upsert({
    where: { listingId },
    create: { listingId, pref },
    update: { pref },
  });
  return NextResponse.json({ ok: true, pref });
}

export async function DELETE(request: Request) {
  const { listingId } = await request.json();
  if (!listingId) return NextResponse.json({ error: "listingId is required" }, { status: 400 });
  await prisma.flatPref.deleteMany({ where: { listingId } });
  return NextResponse.json({ ok: true });
}
