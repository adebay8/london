import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runResearch, type AnalysisProvider } from "@/lib/research-engine";
import { calculateFitScore } from "@/lib/scoring";

export async function GET() {
  const profiles = await prisma.researchProfile.findMany({
    include: { neighbourhood: true },
    orderBy: { fitScore: "desc" },
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

export async function POST(request: Request) {
  const body = await request.json();
  const { neighbourhoodId } = body;

  if (!neighbourhoodId) {
    return NextResponse.json({ error: "neighbourhoodId is required" }, { status: 400 });
  }

  const neighbourhood = await prisma.neighbourhood.findUnique({ where: { id: neighbourhoodId } });
  if (!neighbourhood) {
    return NextResponse.json({ error: "Neighbourhood not found" }, { status: 404 });
  }

  const providerSetting = await prisma.setting.findUnique({ where: { key: "analysisProvider" } });
  const provider: AnalysisProvider = (providerSetting?.value as AnalysisProvider) ?? "openai";

  const job = await prisma.researchJob.create({
    data: { neighbourhoodId, status: "running", startedAt: new Date() },
  });

  // Run async — don't block the response
  runResearchAndSave(neighbourhood.id, neighbourhood.name, neighbourhood.borough, job.id, provider).catch(
    (err) => console.error(`Research failed for ${neighbourhood.name}:`, err)
  );

  return NextResponse.json({ jobId: job.id, status: "running" });
}

async function runResearchAndSave(neighbourhoodId: string, name: string, borough: string, jobId: string, provider: AnalysisProvider) {
  const modelLabel = provider === "openai" ? "gpt-4o" : "claude-sonnet-4-20250514";
  try {
    const { data, rawResponse } = await runResearch(name, borough, provider);
    const fitScore = calculateFitScore({
      transport: data.transport.score,
      safety: data.safety.score,
      rentValue: data.rentValue.score,
      newBuilds: data.newBuilds.score,
      amenities: data.amenities.score,
      areaQuality: data.areaQuality.score,
    });

    await prisma.researchProfile.upsert({
      where: { neighbourhoodId },
      update: {
        overview: data.overview,
        safety: JSON.stringify(data.safety),
        transport: JSON.stringify(data.transport),
        rentValue: JSON.stringify(data.rentValue),
        newBuilds: JSON.stringify(data.newBuilds),
        amenities: JSON.stringify(data.amenities),
        areaQuality: JSON.stringify(data.areaQuality),
        pros: JSON.stringify(data.pros),
        cons: JSON.stringify(data.cons),
        fitScore,
        rawResponse,
        researchedAt: new Date(),
        modelUsed: `${modelLabel} + perplexity-sonar`,
      },
      create: {
        neighbourhoodId,
        overview: data.overview,
        safety: JSON.stringify(data.safety),
        transport: JSON.stringify(data.transport),
        rentValue: JSON.stringify(data.rentValue),
        newBuilds: JSON.stringify(data.newBuilds),
        amenities: JSON.stringify(data.amenities),
        areaQuality: JSON.stringify(data.areaQuality),
        pros: JSON.stringify(data.pros),
        cons: JSON.stringify(data.cons),
        fitScore,
        rawResponse,
        modelUsed: `${modelLabel} + perplexity-sonar`,
      },
    });

    await prisma.researchJob.update({
      where: { id: jobId },
      data: { status: "done", completedAt: new Date() },
    });
  } catch (error) {
    await prisma.researchJob.update({
      where: { id: jobId },
      data: { status: "failed", completedAt: new Date(), error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}
