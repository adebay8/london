import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { PerplexityResult, ResearchData } from "./types";
import { perplexityQueries, analysisSystemPrompt, analysisUserPrompt } from "./prompts";
import { fetchApartmentBuildings, type GooglePlaceResult } from "./google-places";
import { prisma } from "./db";

export type AnalysisProvider = "claude" | "openai";

// --- Phase 1: Perplexity data gathering ---

async function queryPerplexity(query: string): Promise<PerplexityResult> {
  console.log(`[research] Querying Perplexity: "${query.slice(0, 80)}${query.length > 80 ? "..." : ""}"`);
  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: query }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[research] Perplexity query failed: ${response.status} ${body}`);
    throw new Error(`Perplexity API error: ${response.status} ${body}`);
  }

  const data = await response.json();
  return {
    query,
    content: data.choices[0].message.content,
    citations: data.citations ?? [],
  };
}

export async function gatherResearchData(area: string, borough: string): Promise<PerplexityResult[]> {
  const queries = perplexityQueries(area, borough);
  console.log(`[research] Gathering data for ${area}, ${borough} — ${queries.length} queries`);
  const results = await Promise.all(queries.map(queryPerplexity));
  const totalChars = results.reduce((sum, r) => sum + r.content.length, 0);
  console.log(`[research] Data gathered — ${results.length} results, ${totalChars} chars`);
  return results;
}

// --- Phase 2: Analysis ---

export function parseAnalysisResponse(text: string): ResearchData {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error(`[research] Failed to parse analysis response: ${err instanceof Error ? err.message : err}`);
    throw err;
  }

  const required = ["overview", "safety", "transport", "rentValue", "newBuilds", "amenities", "areaQuality", "pros", "cons"];
  for (const field of required) {
    if (!(field in parsed)) {
      console.error(`[research] Missing required field in response: ${field}`);
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return parsed as ResearchData;
}

async function analyseWithClaude(
  area: string,
  borough: string,
  researchData: PerplexityResult[],
  apartmentBuildings?: GooglePlaceResult[]
): Promise<{ data: ResearchData; rawResponse: string }> {
  console.log("[research] Sending to Claude for analysis...");
  const anthropic = new Anthropic();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: analysisSystemPrompt(),
    messages: [{ role: "user", content: analysisUserPrompt(area, borough, researchData, apartmentBuildings) }],
  });

  const rawResponse = message.content[0].type === "text" ? message.content[0].text : "";
  console.log(`[research] Claude analysis complete — ${rawResponse.length} chars`);
  const data = parseAnalysisResponse(rawResponse);
  return { data, rawResponse };
}

async function analyseWithOpenAI(
  area: string,
  borough: string,
  researchData: PerplexityResult[],
  apartmentBuildings?: GooglePlaceResult[]
): Promise<{ data: ResearchData; rawResponse: string }> {
  console.log("[research] Sending to OpenAI for analysis...");
  const openai = new OpenAI();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    max_tokens: 4096,
    messages: [
      { role: "system", content: analysisSystemPrompt() },
      { role: "user", content: analysisUserPrompt(area, borough, researchData, apartmentBuildings) },
    ],
  });

  const rawResponse = completion.choices[0].message.content ?? "";
  console.log(`[research] OpenAI analysis complete — ${rawResponse.length} chars`);
  const data = parseAnalysisResponse(rawResponse);
  return { data, rawResponse };
}

export async function analyseResearchData(
  area: string,
  borough: string,
  researchData: PerplexityResult[],
  provider: AnalysisProvider = "openai",
  apartmentBuildings?: GooglePlaceResult[]
): Promise<{ data: ResearchData; rawResponse: string }> {
  if (provider === "openai") {
    return analyseWithOpenAI(area, borough, researchData, apartmentBuildings);
  }
  return analyseWithClaude(area, borough, researchData, apartmentBuildings);
}

// --- Full research pipeline ---

export async function runResearch(
  area: string,
  borough: string,
  neighbourhoodId: string,
  provider: AnalysisProvider = "openai"
): Promise<{ data: ResearchData; rawResponse: string }> {
  console.log(`[research] Starting research: ${area} (${borough}) via ${provider}`);

  // Phase 1: gather Perplexity data and apartment buildings in parallel
  const [perplexityResults, apartments] = await Promise.all([
    gatherResearchData(area, borough),
    fetchApartmentBuildings(area, borough).catch((err) => {
      console.error(`[research] Apartment fetch failed (non-fatal): ${err instanceof Error ? err.message : err}`);
      return [] as GooglePlaceResult[];
    }),
  ]);

  // Cache apartment results in DB
  if (apartments.length > 0) {
    console.log(`[research] Caching ${apartments.length} apartments for ${area}`);
    await prisma.apartmentBuilding.deleteMany({ where: { neighbourhoodId } });
    const existingPlaceIds = new Set(
      (await prisma.apartmentBuilding.findMany({ where: { placeId: { in: apartments.map((r) => r.placeId) } }, select: { placeId: true } }))
        .map((r) => r.placeId)
    );
    const newApartments = apartments.filter((r) => !existingPlaceIds.has(r.placeId));
    if (newApartments.length > 0) {
      await prisma.apartmentBuilding.createMany({
        data: newApartments.map((r) => ({
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

  // Phase 2: analyse with apartment context
  const result = await analyseResearchData(area, borough, perplexityResults, provider, apartments);
  console.log(`[research] Research complete for ${area}`);
  return result;
}
