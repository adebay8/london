import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setListingPref } from "@/lib/homes/store";

// POST /api/homes/pref { listingId, pref } — save ("want"), dismiss ("reject") or clear (null).
export async function POST(request: Request) {
  const { listingId, pref } = await request.json();
  if (!listingId || typeof listingId !== "string") {
    return NextResponse.json({ error: "listingId is required" }, { status: 400 });
  }
  if (pref != null && pref !== "want" && pref !== "reject") {
    return NextResponse.json({ error: "pref must be 'want', 'reject', or null" }, { status: 400 });
  }
  await setListingPref(prisma, listingId, pref ?? null);
  return NextResponse.json({ ok: true, pref: pref ?? null });
}
