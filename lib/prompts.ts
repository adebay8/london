export const USER_CRITERIA = `Budget: ~£1,900/month all-in (rent + bills)
Property: 1-bedroom flat, preferably new build / modern development
Location: Nice, safe, well-kept neighbourhood over zone proximity
Commute: ≤45-60 mins to Westminster, Tube/DLR preferred over National Rail
Lifestyle: Clean, modern environment > nightlife
Nice-to-haves: gym, concierge, balcony, secure entry, lift
Trade-offs: Willing to go further out for genuinely nicer area; avoiding cheap but not a lifestyle upgrade areas`;

// Queries 0-4: official/marketing data. Queries 5-6: resident opinions.
export const OPINION_QUERY_START_INDEX = 5;

export function perplexityQueries(area: string, borough: string): string[] {
  return [
    // Official / marketing data
    `Current 1-bed new build rental prices in ${area}, ${borough}, London 2025-2026`,
    `Transport links and commute time from ${area} ${borough} to Westminster London`,
    `Crime rates and safety in ${area} ${borough} London neighbourhood`,
    `New build residential developments in ${area} ${borough} London with official website links concierge gym managed building`,
    `What is ${area} ${borough} London like to live in, amenities, lifestyle`,
    // Resident opinions & reviews
    `site:reddit.com OR site:mumsnet.com living in ${area} ${borough} London pros cons honest review`,
    `${area} ${borough} London neighbourhood review what is it really like to live there safety noise cleanliness`,
  ];
}

export function analysisSystemPrompt(): string {
  return `You are analysing London neighbourhoods for a renter with these criteria:

${USER_CRITERIA}

You will be given research data about a specific neighbourhood, split into two sections:
1. **Official/Marketing Data** — from estate agents, developers, TfL, government stats. Useful for factual data (prices, commute times, crime stats) but tends to present areas positively.
2. **Resident Opinions & Reviews** — from Reddit, Mumsnet, forums, review sites. Provides honest ground-level perspective on what it's actually like to live there (safety feel, noise, cleanliness, community vibe). Can be pessimistic or opinionated — weigh accordingly.

**How to balance these sources:**
- For objective factors (commute times, rent prices, station names): trust official data.
- For subjective factors (safety feel, cleanliness, neighbourhood vibe, noise): weight resident opinions heavily — they reflect lived experience that marketing won't show.
- When marketing claims contradict resident experiences (e.g. "up and coming area" vs residents saying "still rough"), note the contradiction and lean toward the resident perspective for scoring.
- If residents are strongly negative about safety or quality despite positive marketing, reflect this in the score and flag it in cons.

Each score must be between 1.0 and 10.0. Justify every score with specific evidence from the research data, citing both official and resident sources where available. Do not invent data — only use what is provided.

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
        "priceRange": "£X,XXX - £X,XXX pcm",
        "url": "https://development-website.com (official development site, NOT a Rightmove/Zoopla listing)"
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
  const officialData = researchData
    .slice(0, OPINION_QUERY_START_INDEX)
    .map((r) => `### ${r.query}\n${r.content}\nSources: ${r.citations.join(", ") || "none"}`)
    .join("\n\n");

  const opinionData = researchData
    .slice(OPINION_QUERY_START_INDEX)
    .map((r) => `### ${r.query}\n${r.content}\nSources: ${r.citations.join(", ") || "none"}`)
    .join("\n\n");

  return `Analyse the neighbourhood "${area}" in ${borough}, London.

## Official / Marketing Data

${officialData}

## Resident Opinions & Reviews

${opinionData}

Return the structured JSON analysis.`;
}
