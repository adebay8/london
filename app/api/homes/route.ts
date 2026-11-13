import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadListings, loadTowns } from "@/lib/homes/store";

// GET /api/homes — every tracked listing and every search town. Flags and
// duplicates are derived on the page (lib/homes/flags.ts), so nothing derived
// is sent.
export async function GET() {
  const [towns, listings] = await Promise.all([loadTowns(prisma), loadListings(prisma)]);
  // A pass is thousands of homes: send only what the page reads (the first
  // photo, and the two raw fields the flags use).
  const slim = listings.map((l) => ({
    ...l,
    photos: l.photos.slice(0, 1),
    photoCount: l.photos.length,
    raw: Object.fromEntries(Object.entries(l.raw).filter(([k]) => k === "date_listed_or_changed" || k === "floor_area")),
  }));
  return NextResponse.json({ towns, listings: slim });
}
