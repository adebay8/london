import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { searchPlaces } from "@/lib/google-places";

export async function POST(request: Request) {
  const { query } = await request.json();

  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  console.log(`[apartments] Direct search: "${query}"`);

  // No type filter — the user is searching by name so we trust their intent
  const results = await searchPlaces(`${query} London`);

  // Check which placeIds already exist in DB
  const existingPlaceIds = new Set(
    (await prisma.apartmentBuilding.findMany({
      where: { placeId: { in: results.map((r) => r.placeId) } },
      select: { placeId: true, neighbourhoodId: true },
    })).map((r) => r.placeId)
  );

  const resultsWithStatus = results.map((r) => ({
    ...r,
    alreadySaved: existingPlaceIds.has(r.placeId),
  }));

  console.log(`[apartments] Search found ${results.length} results (${existingPlaceIds.size} already saved)`);

  return NextResponse.json(resultsWithStatus);
}
