import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get("ids")?.split(",") ?? [];

  if (ids.length < 2 || ids.length > 3) {
    return NextResponse.json({ error: "Provide 2-3 neighbourhood IDs as ?ids=id1,id2,id3" }, { status: 400 });
  }

  const profiles = await prisma.researchProfile.findMany({
    where: { neighbourhoodId: { in: ids } },
    include: { neighbourhood: true },
  });

  const parsed = profiles.map((p) => ({
    ...p,
    safety: JSON.parse(p.safety),
    transport: JSON.parse(p.transport),
    rentValue: JSON.parse(p.rentValue),
    newBuilds: JSON.parse(p.newBuilds),
    amenities: JSON.parse(p.amenities),
    areaQuality: JSON.parse(p.areaQuality),
    pros: JSON.parse(p.pros),
    cons: JSON.parse(p.cons),
  }));

  return NextResponse.json(parsed);
}
