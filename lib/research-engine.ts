import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { PerplexityResult, ResearchData } from "./types";
import { perplexityQueries, analysisSystemPrompt, analysisUserPrompt } from "./prompts";

export type AnalysisProvider = "claude" | "openai";

// --- Phase 1: Perplexity data gathering ---

async function queryPerplexity(query: string): Promise<PerplexityResult> {
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
    throw new Error(`Perplexity API error: ${response.status} ${await response.text()}`);
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
  const results = await Promise.all(queries.map(queryPerplexity));
  return results;
}

// --- Phase 2: Analysis ---

export function parseAnalysisResponse(text: string): ResearchData {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  const required = ["overview", "safety", "transport", "rentValue", "newBuilds", "amenities", "areaQuality", "pros", "cons"];
  for (const field of required) {
    if (!(field in parsed)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return parsed as ResearchData;
}

async function analyseWithClaude(
  area: string,
  borough: string,
  researchData: PerplexityResult[]
): Promise<{ data: ResearchData; rawResponse: string }> {
  const anthropic = new Anthropic();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: analysisSystemPrompt(),
    messages: [{ role: "user", content: analysisUserPrompt(area, borough, researchData) }],
  });

  const rawResponse = message.content[0].type === "text" ? message.content[0].text : "";
  const data = parseAnalysisResponse(rawResponse);
  return { data, rawResponse };
}

async function analyseWithOpenAI(
  area: string,
  borough: string,
  researchData: PerplexityResult[]
): Promise<{ data: ResearchData; rawResponse: string }> {
  const openai = new OpenAI();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    max_tokens: 4096,
    messages: [
      { role: "system", content: analysisSystemPrompt() },
      { role: "user", content: analysisUserPrompt(area, borough, researchData) },
    ],
  });

  const rawResponse = completion.choices[0].message.content ?? "";
  const data = parseAnalysisResponse(rawResponse);
  return { data, rawResponse };
}

export async function analyseResearchData(
  area: string,
  borough: string,
  researchData: PerplexityResult[],
  provider: AnalysisProvider = "openai"
): Promise<{ data: ResearchData; rawResponse: string }> {
  if (provider === "openai") {
    return analyseWithOpenAI(area, borough, researchData);
  }
  return analyseWithClaude(area, borough, researchData);
}

// --- Full research pipeline ---

export async function runResearch(
  area: string,
  borough: string,
  provider: AnalysisProvider = "openai"
): Promise<{ data: ResearchData; rawResponse: string }> {
  const perplexityResults = await gatherResearchData(area, borough);
  return analyseResearchData(area, borough, perplexityResults, provider);
}
