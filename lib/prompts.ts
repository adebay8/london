export const USER_CRITERIA = `Budget: ~£1,900/month all-in (rent + bills)
Property: 1-bedroom flat, preferably new build / modern development
Location: Nice, safe, well-kept neighbourhood over zone proximity
Commute: ≤45-60 mins to Westminster, Tube/DLR preferred over National Rail
Lifestyle: Clean, modern environment > nightlife
Nice-to-haves: gym, concierge, balcony, secure entry, lift
Trade-offs: Willing to go further out for genuinely nicer area; avoiding cheap but not a lifestyle upgrade areas`;

export function perplexityQueries(area: string, borough: string): string[] {
  return [
    `Current 1-bed new build rental prices in ${area}, ${borough}, London 2025-2026`,
    `Transport links and commute time from ${area} ${borough} to Westminster London`,
    `Crime rates and safety in ${area} ${borough} London neighbourhood`,
    `New build developments with concierge gym in ${area} ${borough} London`,
    `What is ${area} ${borough} London like to live in, amenities, lifestyle`,
  ];
}

export function analysisSystemPrompt(): string {
  return `You are analysing London neighbourhoods for a renter with these criteria:

${USER_CRITERIA}

You will be given research data about a specific neighbourhood. Analyse it and return a structured JSON response.

Each score must be between 1.0 and 10.0. Justify every score with specific evidence from the research data. Do not invent data — only use what is provided.

Return ONLY valid JSON matching this exact structure:
{
  "overview": "2-3 sentence summary of the area's character and suitability",
  "safety": {
    "score": <number 1-10>,
    "evidence": "specific evidence from research data",
    "sources": ["source URLs or names"]
  },
  "transport": {
    "score": <number 1-10>,
    "stations": ["station names"],
    "commuteMins": <number>,
    "lines": ["line names"],
    "frequency": "description of service frequency",
    "sources": ["source URLs or names"]
  },
  "rentValue": {
    "score": <number 1-10>,
    "rangeLow": <number in GBP>,
    "rangeHigh": <number in GBP>,
    "analysis": "what £1,900 budget gets you here",
    "sources": ["source URLs or names"]
  },
  "newBuilds": {
    "score": <number 1-10>,
    "developments": [
      {
        "name": "development name",
        "features": ["concierge", "gym", etc],
        "priceRange": "£X,XXX - £X,XXX pcm"
      }
    ],
    "sources": ["source URLs or names"]
  },
  "amenities": {
    "score": <number 1-10>,
    "details": "description of nearby amenities",
    "sources": ["source URLs or names"]
  },
  "areaQuality": {
    "score": <number 1-10>,
    "evidence": "description of cleanliness, upkeep, modern feel",
    "sources": ["source URLs or names"]
  },
  "pros": ["pro 1", "pro 2", "pro 3"],
  "cons": ["con 1", "con 2", "con 3"]
}`;
}

export function analysisUserPrompt(
  area: string,
  borough: string,
  researchData: { query: string; content: string; citations: string[] }[]
): string {
  const formattedData = researchData
    .map(
      (r) =>
        `### ${r.query}\n${r.content}\nSources: ${r.citations.join(", ") || "none"}`
    )
    .join("\n\n");

  return `Analyse the neighbourhood "${area}" in ${borough}, London.

Here is the research data:

${formattedData}

Return the structured JSON analysis.`;
}
