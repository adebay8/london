import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const neighbourhoodId = searchParams.get("neighbourhoodId");
  const where = neighbourhoodId ? { neighbourhoodId } : {};

  const entries = await prisma.journalEntry.findMany({
    where,
    include: { neighbourhood: { select: { name: true, borough: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(entries);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { neighbourhoodId, content, decision, fitScoreSnapshot } = body;

  if (!content || content.trim() === "") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const entry = await prisma.journalEntry.create({
    data: {
      neighbourhoodId: neighbourhoodId || null,
      content: content.trim(),
      decision: decision || null,
      fitScoreSnapshot: fitScoreSnapshot ?? null,
    },
    include: { neighbourhood: { select: { name: true, borough: true } } },
  });

  return NextResponse.json(entry);
}
