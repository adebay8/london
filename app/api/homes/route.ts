import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadListings, loadTowns } from "@/lib/homes/store";

// GET /api/homes — every tracked listing and every search town. Flags and
// duplicates are derived on the page (lib/homes/flags.ts), so nothing derived
// is sent.
export async function GET() {
  const [towns, listings] = await Promise.all([loadTowns(prisma), loadListings(prisma)]);
  return NextResponse.json({ towns, listings });
}
