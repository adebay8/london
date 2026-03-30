import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await prisma.researchProfile.findFirst({
    where: { neighbourhoodId: id },
    include: { neighbourhood: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Research profile not found" }, { status: 404 });
  }

  const parsed = {
    ...profile,
    safety: JSON.parse(profile.safety),
    transport: JSON.parse(profile.transport),
    rentValue: JSON.parse(profile.rentValue),
    newBuilds: JSON.parse(profile.newBuilds),
    amenities: JSON.parse(profile.amenities),
    areaQuality: JSON.parse(profile.areaQuality),
    pros: JSON.parse(profile.pros),
    cons: JSON.parse(profile.cons),
  };

  return NextResponse.json(parsed);
}
