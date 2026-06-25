import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scanBuildingAmenities } from "@/lib/google-places";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const building = await prisma.apartmentBuilding.findUnique({
    where: { id },
    include: {
      neighbourhood: {
        include: { researchProfile: { select: { rentValue: true } } },
      },
      amenities: { orderBy: [{ category: "asc" }, { walkMins: "asc" }] },
    },
  });

  if (!building) {
    return NextResponse.json({ error: "Building not found" }, { status: 404 });
  }

  const neighbourhood = building.neighbourhood as typeof building.neighbourhood & { researchProfile?: { rentValue: string } | null };

  return NextResponse.json({
    ...building,
    types: JSON.parse(building.types),
    neighbourhood: {
      ...building.neighbourhood,
      researchProfile: neighbourhood.researchProfile
        ? { rentValue: JSON.parse(neighbourhood.researchProfile.rentValue) }
        : null,
    },
  });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const building = await prisma.apartmentBuilding.findUnique({ where: { id } });
  if (!building) {
    return NextResponse.json({ error: "Building not found" }, { status: 404 });
  }

  console.log(`[walkability] Scanning amenities for ${building.name}`);

  const amenities = await scanBuildingAmenities(building.lat, building.lng);

  // Delete existing and insert fresh
  await prisma.buildingAmenity.deleteMany({ where: { buildingId: id } });

  if (amenities.length > 0) {
    // Deduplicate by placeId — keep the first occurrence (best category match)
    const seen = new Set<string>();
    const unique = amenities.filter((a) => {
      if (seen.has(a.placeId)) return false;
      seen.add(a.placeId);
      return true;
    });

    await prisma.buildingAmenity.createMany({
      data: unique.map((a) => ({
        buildingId: id,
        category: a.category,
        name: a.name,
        address: a.address,
        lat: a.lat,
        lng: a.lng,
        placeId: a.placeId,
        googleMapsUri: a.googleMapsUri,
        walkMins: a.walkMins,
        walkMeters: a.walkMeters,
      })),
    });
  }

  console.log(`[walkability] Saved ${amenities.length} amenities for ${building.name}`);

  return NextResponse.json({ count: amenities.length, buildingId: id });
}
