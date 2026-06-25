import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const rankings = await prisma.ranking.findMany({
    orderBy: { position: "asc" },
    include: {
      neighbourhood: {
        include: {
          researchProfile: true,
        },
      },
    },
  });

  const parsed = rankings.map((r) => {
    const rp = r.neighbourhood.researchProfile;
    return {
      ...r,
      neighbourhood: {
        ...r.neighbourhood,
        researchProfile: rp
          ? {
              ...rp,
              safety: JSON.parse(rp.safety),
              transport: JSON.parse(rp.transport),
              rentValue: JSON.parse(rp.rentValue),
              newBuilds: JSON.parse(rp.newBuilds),
              amenities: JSON.parse(rp.amenities),
              areaQuality: JSON.parse(rp.areaQuality),
              pros: JSON.parse(rp.pros),
              cons: JSON.parse(rp.cons),
            }
          : null,
      },
    };
  });

  return NextResponse.json(parsed);
}

// Add a neighbourhood to the ranking
export async function POST(request: Request) {
  const { neighbourhoodId } = await request.json();

  if (!neighbourhoodId) {
    return NextResponse.json({ error: "neighbourhoodId is required" }, { status: 400 });
  }

  // Check if already ranked
  const existing = await prisma.ranking.findUnique({ where: { neighbourhoodId } });
  if (existing) {
    return NextResponse.json({ error: "Already ranked" }, { status: 409 });
  }

  // Get the next position
  const last = await prisma.ranking.findFirst({ orderBy: { position: "desc" } });
  const position = (last?.position ?? 0) + 1;

  const ranking = await prisma.ranking.create({
    data: { neighbourhoodId, position },
  });

  return NextResponse.json(ranking);
}

// Reorder rankings
export async function PUT(request: Request) {
  const { orderedIds } = await request.json();

  if (!Array.isArray(orderedIds)) {
    return NextResponse.json({ error: "orderedIds array is required" }, { status: 400 });
  }

  // Update positions in a transaction
  await prisma.$transaction(
    orderedIds.map((neighbourhoodId: string, index: number) =>
      prisma.ranking.update({
        where: { neighbourhoodId },
        data: { position: index + 1 },
      })
    )
  );

  return NextResponse.json({ ok: true });
}

// Remove from ranking
export async function DELETE(request: Request) {
  const { neighbourhoodId } = await request.json();

  if (!neighbourhoodId) {
    return NextResponse.json({ error: "neighbourhoodId is required" }, { status: 400 });
  }

  await prisma.ranking.deleteMany({ where: { neighbourhoodId } });

  // Re-compact positions
  const remaining = await prisma.ranking.findMany({ orderBy: { position: "asc" } });
  await prisma.$transaction(
    remaining.map((r, i) =>
      prisma.ranking.update({ where: { id: r.id }, data: { position: i + 1 } })
    )
  );

  return NextResponse.json({ ok: true });
}
