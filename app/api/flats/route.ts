import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadAreas, loadConfig, loadListings } from "@/lib/flat-search/store";

// GET /api/flats — the whole flat-search store (areas + listings + config).
// The /flats page recomputes timing/staleness/sort live from this, so nothing derived is sent.
export async function GET() {
  const [areas, listings, config] = await Promise.all([
    loadAreas(prisma),
    loadListings(prisma),
    loadConfig(prisma),
  ]);
  return NextResponse.json({ areas, listings, config });
}
