import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const settings = await prisma.setting.findMany();
  const settingsMap: Record<string, string> = {};
  for (const s of settings) {
    settingsMap[s.key] = s.value;
  }

  const apiKeyStatus = {
    perplexity: !!process.env.PERPLEXITY_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    googlePlaces: !!process.env.GOOGLE_PLACES_API_KEY,
  };

  return NextResponse.json({ settings: settingsMap, apiKeyStatus });
}

export async function PUT(request: Request) {
  const { key, value } = await request.json();

  if (!key || typeof value !== "string") {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  }

  if (key === "analysisProvider" && !["claude", "openai"].includes(value)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  return NextResponse.json({ ok: true });
}
