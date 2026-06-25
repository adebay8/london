import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchApartmentBuildings, searchPlaces } from "@/lib/google-places";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const neighbourhoodId = searchParams.get("neighbourhoodId");

  const where = neighbourhoodId ? { neighbourhoodId } : {};

  const buildings = await prisma.apartmentBuilding.findMany({
    where,
    include: {
      neighbourhood: true,
      amenities: { orderBy: { walkMins: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  const parsed = buildings.map((b) => ({
    ...b,
    types: JSON.parse(b.types),
  }));

  return NextResponse.json(parsed);
}

export async function POST(request: Request) {
  const { neighbourhoodId, radius } = await request.json();

  if (!neighbourhoodId) {
    return NextResponse.json({ error: "neighbourhoodId is required" }, { status: 400 });
  }

  const neighbourhood = await prisma.neighbourhood.findUnique({ where: { id: neighbourhoodId } });
  if (!neighbourhood) {
    return NextResponse.json({ error: "Neighbourhood not found" }, { status: 404 });
  }

  const radiusMeters = typeof radius === "number" && radius > 0 ? radius : 0;
  console.log(`[apartments] Fetching apartments for ${neighbourhood.name} (${neighbourhood.borough})${radiusMeters ? ` radius: ${radiusMeters}m` : ""}`);

  // Geocode neighbourhood to get center coordinates (needed for radius search)
  let centerLat: number | undefined;
  let centerLng: number | undefined;
  if (radiusMeters > 0) {
    const geoResults = await searchPlaces(`${neighbourhood.name}, ${neighbourhood.borough}, London`);
    if (geoResults.length > 0) {
      centerLat = geoResults[0].lat;
      centerLng = geoResults[0].lng;
      console.log(`[apartments] Geocoded ${neighbourhood.name}: ${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}`);
    }
  }

  const results = await fetchApartmentBuildings(neighbourhood.name, neighbourhood.borough, {
    radiusMeters,
    centerLat,
    centerLng,
  });

  // Delete existing and insert fresh
  await prisma.apartmentBuilding.deleteMany({ where: { neighbourhoodId } });

  if (results.length > 0) {
    const existingPlaceIds = new Set(
      (await prisma.apartmentBuilding.findMany({ where: { placeId: { in: results.map((r) => r.placeId) } }, select: { placeId: true } }))
        .map((r) => r.placeId)
    );
    const newResults = results.filter((r) => !existingPlaceIds.has(r.placeId));
    if (newResults.length > 0) {
      await prisma.apartmentBuilding.createMany({
        data: newResults.map((r) => ({
          neighbourhoodId,
          placeId: r.placeId,
          name: r.name,
          address: r.address,
          lat: r.lat,
          lng: r.lng,
          googleMapsUri: r.googleMapsUri,
          types: JSON.stringify(r.types),
        })),
      });
    }
  }

  console.log(`[apartments] Saved ${results.length} apartments for ${neighbourhood.name}`);

  return NextResponse.json({ count: results.length, neighbourhoodId });
}
