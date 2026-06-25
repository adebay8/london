import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const { neighbourhoodId, placeId, name, address, lat, lng, googleMapsUri, types } = body;

  if (!neighbourhoodId || !placeId || !name) {
    return NextResponse.json({ error: "neighbourhoodId, placeId, and name are required" }, { status: 400 });
  }

  // Check if already exists
  const existing = await prisma.apartmentBuilding.findUnique({ where: { placeId } });
  if (existing) {
    console.log(`[apartments] ${name} already exists (placeId: ${placeId})`);
    return NextResponse.json({ ...existing, types: JSON.parse(existing.types), alreadyExisted: true });
  }

  const neighbourhood = await prisma.neighbourhood.findUnique({ where: { id: neighbourhoodId } });
  if (!neighbourhood) {
    return NextResponse.json({ error: "Neighbourhood not found" }, { status: 404 });
  }

  console.log(`[apartments] Adding ${name} to ${neighbourhood.name}`);

  const building = await prisma.apartmentBuilding.create({
    data: {
      neighbourhoodId,
      placeId,
      name,
      address: address ?? "",
      lat: lat ?? 0,
      lng: lng ?? 0,
      googleMapsUri: googleMapsUri ?? "",
      types: JSON.stringify(types ?? []),
    },
  });

  return NextResponse.json({ ...building, types: JSON.parse(building.types), alreadyExisted: false });
}
