import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const neighbourhoods = await prisma.neighbourhood.findMany({
    orderBy: [{ zone: "asc" }, { borough: "asc" }, { name: "asc" }],
    include: {
      researchProfile: { select: { fitScore: true } },
      researchJobs: {
        where: { status: { in: ["pending", "running"] } },
        select: { status: true },
        take: 1,
      },
    },
  });
  return NextResponse.json(neighbourhoods);
}

const VALID_STATUSES = ["yes", "no", "maybe", null];

export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, status } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "status must be yes, no, maybe, or null" }, { status: 400 });
  }

  const updated = await prisma.neighbourhood.update({
    where: { id },
    data: { status },
  });
  return NextResponse.json(updated);
}
