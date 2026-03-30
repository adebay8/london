# Neighbourhood Research Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the London neighbourhood selector from a React SPA to a Next.js app with AI-powered research profiles, comparison views, and a decision journal.

**Architecture:** Next.js 15 App Router with TypeScript. SQLite via Prisma for persistence. Two-phase research engine: Perplexity Sonar for data gathering, Claude Sonnet for analysis. Four views: Map & Select, Research, Compare, Journal — connected via a slim icon sidebar.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, React-Leaflet, Prisma + SQLite, Perplexity Sonar API, Anthropic Claude API

**Spec:** `docs/superpowers/specs/2026-03-30-neighbourhood-research-design.md`

---

## File Map

```
london/
├── app/
│   ├── layout.tsx                          # Root layout: sidebar + main content area
│   ├── page.tsx                            # Redirect to /map
│   ├── globals.css                         # Tailwind imports + global styles
│   ├── map/
│   │   └── page.tsx                        # Map & Select view (client component)
│   ├── research/
│   │   ├── page.tsx                        # Profile cards grid
│   │   └── [id]/
│   │       └── page.tsx                    # Full research profile
│   ├── compare/
│   │   └── page.tsx                        # Side-by-side comparison
│   ├── journal/
│   │   └── page.tsx                        # Decision timeline
│   └── api/
│       ├── neighbourhoods/
│       │   └── route.ts                    # GET list, PATCH status
│       ├── research/
│       │   ├── route.ts                    # POST trigger, GET list
│       │   └── [id]/
│       │       └── route.ts               # GET single profile
│       ├── compare/
│       │   └── route.ts                    # GET comparison data
│       └── journal/
│           └── route.ts                    # GET list, POST create
├── components/
│   ├── Sidebar.tsx                         # Icon navigation sidebar
│   ├── LondonMap.tsx                       # Leaflet map (client component)
│   ├── NeighbourhoodSelector.tsx           # Zone/borough/location selector
│   ├── ProfileCard.tsx                     # Research profile card
│   ├── ScoreBar.tsx                        # Score bar visualisation
│   ├── CompareTable.tsx                    # Side-by-side comparison table
│   ├── JournalTimeline.tsx                 # Journal timeline
│   └── JournalEntryForm.tsx               # New journal entry form
├── lib/
│   ├── db.ts                              # Prisma client singleton
│   ├── research-engine.ts                 # Two-phase research orchestrator
│   ├── scoring.ts                         # Weighted fit score calculation
│   ├── prompts.ts                         # LLM prompt templates
│   └── types.ts                           # Shared TypeScript types
├── data/
│   ├── districts.json                     # Migrated from src/
│   ├── districts_zones.json               # Migrated from src/
│   └── london_postcodes.json              # Migrated from src/
├── prisma/
│   └── schema.prisma                      # Database schema
├── __tests__/
│   ├── lib/
│   │   ├── scoring.test.ts                # Fit score calculation tests
│   │   └── research-engine.test.ts        # Research engine tests
│   └── api/
│       ├── neighbourhoods.test.ts         # Neighbourhoods API tests
│       ├── research.test.ts               # Research API tests
│       ├── compare.test.ts                # Compare API tests
│       └── journal.test.ts                # Journal API tests
├── .env.local                             # API keys (gitignored)
├── next.config.ts                         # Next.js config
├── tailwind.config.ts                     # Tailwind config
├── tsconfig.json                          # TypeScript config
└── package.json                           # Dependencies
```

---

## Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `postcss.config.mjs`, `.env.local`
- Modify: `.gitignore`
- Move: `src/districts.json` → `data/districts.json`, `src/districts_zones.json` → `data/districts_zones.json`, `src/london_postcodes.json` → `data/london_postcodes.json`

- [ ] **Step 1: Remove the old React app and create a fresh Next.js project**

The existing `src/` directory is a Create React App project. We'll start fresh with Next.js in the same directory.

```bash
cd /Users/onuchukwu/Documents/Projects/london
# Back up data files
mkdir -p data
cp src/districts.json data/districts.json
cp src/districts_zones.json data/districts_zones.json
cp src/london_postcodes.json data/london_postcodes.json
# Remove old CRA files
rm -rf src/ public/ build/ node_modules/ package.json package-lock.json
```

- [ ] **Step 2: Initialise Next.js with TypeScript and Tailwind**

```bash
cd /Users/onuchukwu/Documents/Projects/london
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --turbopack --yes
```

This creates the standard Next.js scaffolding with App Router, TypeScript, and Tailwind CSS.

- [ ] **Step 3: Install additional dependencies**

```bash
npm install prisma @prisma/client leaflet react-leaflet @anthropic-ai/sdk
npm install -D @types/leaflet
```

- [ ] **Step 4: Create `.env.local`**

```bash
cat > .env.local << 'ENVEOF'
PERPLEXITY_API_KEY=
ANTHROPIC_API_KEY=
DATABASE_URL="file:./london.db"
ENVEOF
```

- [ ] **Step 5: Update `.gitignore`**

Add to `.gitignore`:
```
london.db
london.db-journal
.env.local
.superpowers/
```

- [ ] **Step 6: Verify the data files migrated correctly**

```bash
ls -la data/
# Should show: districts.json, districts_zones.json, london_postcodes.json
head -5 data/districts.json
# Should show: [{"location":"Abbey Wood",...
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```

Expected: Next.js dev server starts on http://localhost:3000 with the default page.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with TypeScript and Tailwind"
```

---

## Task 2: Prisma Schema & Database Seed

**Files:**
- Create: `prisma/schema.prisma`, `prisma/seed.ts`, `lib/db.ts`

- [ ] **Step 1: Initialise Prisma**

```bash
npx prisma init --datasource-provider sqlite
```

This creates `prisma/schema.prisma` and updates `.env` (we'll use `.env.local` instead).

- [ ] **Step 2: Write the Prisma schema**

Write `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Neighbourhood {
  id        String   @id @default(cuid())
  name      String
  borough   String
  zone      Int
  postcodes String
  status    String?
  updatedAt DateTime @default(now()) @updatedAt

  researchProfile ResearchProfile?
  researchJobs    ResearchJob[]
  journalEntries  JournalEntry[]

  @@unique([name, borough])
  @@map("neighbourhoods")
}

model ResearchProfile {
  id              String   @id @default(cuid())
  neighbourhoodId String   @unique
  overview        String
  safety          String   // JSON string
  transport       String   // JSON string
  rentValue       String   // JSON string
  newBuilds       String   // JSON string
  amenities       String   // JSON string
  areaQuality     String   // JSON string
  pros            String   // JSON string (array)
  cons            String   // JSON string (array)
  fitScore        Float
  rawResponse     String
  researchedAt    DateTime @default(now())
  modelUsed       String

  neighbourhood Neighbourhood @relation(fields: [neighbourhoodId], references: [id])

  @@map("research_profiles")
}

model ResearchJob {
  id              String    @id @default(cuid())
  neighbourhoodId String
  status          String    @default("pending") // pending | running | done | failed
  startedAt       DateTime?
  completedAt     DateTime?
  error           String?

  neighbourhood Neighbourhood @relation(fields: [neighbourhoodId], references: [id])

  @@map("research_jobs")
}

model JournalEntry {
  id               String   @id @default(cuid())
  neighbourhoodId  String?
  content          String
  decision         String?  // yes | no | maybe
  fitScoreSnapshot Float?
  createdAt        DateTime @default(now())

  neighbourhood Neighbourhood? @relation(fields: [neighbourhoodId], references: [id])

  @@map("journal_entries")
}
```

- [ ] **Step 3: Run initial migration**

```bash
npx prisma migrate dev --name init
```

Expected: Creates `prisma/migrations/` directory and `london.db` file.

- [ ] **Step 4: Write the Prisma client singleton**

Write `lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 5: Write the seed script**

Write `prisma/seed.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import districts from "../data/districts.json";
import districtZones from "../data/districts_zones.json";

const prisma = new PrismaClient();

async function main() {
  // Build borough → zone map
  const boroughZoneMap: Record<string, number> = {};
  for (const entry of districtZones) {
    const zone = entry.zone.includes("/")
      ? Math.min(...entry.zone.split("/").map(Number))
      : Number(entry.zone);
    boroughZoneMap[entry.borough] = zone;
  }

  // Group districts by location + borough
  const grouped: Record<
    string,
    { location: string; borough: string; postcodes: Set<string> }
  > = {};

  for (const d of districts) {
    const key = `${d.location}::${d.borough}`;
    if (!grouped[key]) {
      grouped[key] = {
        location: d.location,
        borough: d.borough,
        postcodes: new Set(),
      };
    }
    for (const pc of d.postcodeDistrict.split(",").map((s: string) => s.trim())) {
      grouped[key].postcodes.add(pc);
    }
  }

  // Upsert each neighbourhood
  for (const entry of Object.values(grouped)) {
    const zone = boroughZoneMap[entry.borough] ?? 0;
    await prisma.neighbourhood.upsert({
      where: {
        name_borough: {
          name: entry.location,
          borough: entry.borough,
        },
      },
      update: {},
      create: {
        name: entry.location,
        borough: entry.borough,
        zone,
        postcodes: Array.from(entry.postcodes).join(", "),
      },
    });
  }

  const count = await prisma.neighbourhood.count();
  console.log(`Seeded ${count} neighbourhoods`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 6: Add seed script to package.json**

Add to `package.json`:
```json
{
  "prisma": {
    "seed": "npx tsx prisma/seed.ts"
  }
}
```

Install tsx:
```bash
npm install -D tsx
```

- [ ] **Step 7: Run the seed**

```bash
npx prisma db seed
```

Expected: `Seeded ~385 neighbourhoods`

- [ ] **Step 8: Verify the database**

```bash
npx prisma studio
```

Expected: Opens Prisma Studio in browser showing the `neighbourhoods` table with all seeded rows.

- [ ] **Step 9: Commit**

```bash
git add prisma/ lib/db.ts package.json
git commit -m "feat: add Prisma schema, migrations, and seed script"
```

---

## Task 3: Shared Types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Write the shared types**

Write `lib/types.ts`:

```typescript
// --- Database row shapes (returned from API routes) ---

export interface NeighbourhoodRow {
  id: string;
  name: string;
  borough: string;
  zone: number;
  postcodes: string;
  status: string | null;
  updatedAt: string;
}

export interface ResearchProfileRow {
  id: string;
  neighbourhoodId: string;
  overview: string;
  safety: SafetyScore;
  transport: TransportScore;
  rentValue: RentScore;
  newBuilds: NewBuildsScore;
  amenities: AmenitiesScore;
  areaQuality: AreaQualityScore;
  pros: string[];
  cons: string[];
  fitScore: number;
  researchedAt: string;
  modelUsed: string;
  neighbourhood?: NeighbourhoodRow;
}

// --- Sub-score shapes ---

export interface SafetyScore {
  score: number;
  evidence: string;
  sources: string[];
}

export interface TransportScore {
  score: number;
  stations: string[];
  commuteMins: number;
  lines: string[];
  frequency: string;
  sources: string[];
}

export interface RentScore {
  score: number;
  rangeLow: number;
  rangeHigh: number;
  analysis: string;
  sources: string[];
}

export interface NewBuildsScore {
  score: number;
  developments: {
    name: string;
    features: string[];
    priceRange: string;
  }[];
  sources: string[];
}

export interface AmenitiesScore {
  score: number;
  details: string;
  sources: string[];
}

export interface AreaQualityScore {
  score: number;
  evidence: string;
  sources: string[];
}

// --- Research engine shapes ---

export interface PerplexityResult {
  query: string;
  content: string;
  citations: string[];
}

export interface ResearchData {
  overview: string;
  safety: SafetyScore;
  transport: TransportScore;
  rentValue: RentScore;
  newBuilds: NewBuildsScore;
  amenities: AmenitiesScore;
  areaQuality: AreaQualityScore;
  pros: string[];
  cons: string[];
}

// --- Journal shapes ---

export interface JournalEntryRow {
  id: string;
  neighbourhoodId: string | null;
  content: string;
  decision: string | null;
  fitScoreSnapshot: number | null;
  createdAt: string;
  neighbourhood?: { name: string; borough: string } | null;
}

// --- Fit score weights ---

export const FIT_SCORE_WEIGHTS = {
  transport: 0.25,
  safety: 0.25,
  rentValue: 0.2,
  newBuilds: 0.15,
  amenities: 0.1,
  areaQuality: 0.05,
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 4: Scoring Module

**Files:**
- Create: `lib/scoring.ts`, `__tests__/lib/scoring.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `__tests__/lib/scoring.test.ts`:

```typescript
import { calculateFitScore } from "@/lib/scoring";

describe("calculateFitScore", () => {
  it("computes weighted average from sub-scores", () => {
    const scores = {
      transport: 8.5,
      safety: 7.0,
      rentValue: 6.5,
      newBuilds: 8.0,
      amenities: 7.5,
      areaQuality: 6.0,
    };
    // (8.5*0.25) + (7.0*0.25) + (6.5*0.20) + (8.0*0.15) + (7.5*0.10) + (6.0*0.05)
    // = 2.125 + 1.75 + 1.30 + 1.20 + 0.75 + 0.30 = 7.425
    const result = calculateFitScore(scores);
    expect(result).toBeCloseTo(7.43, 1);
  });

  it("returns 0 when all scores are 0", () => {
    const scores = {
      transport: 0,
      safety: 0,
      rentValue: 0,
      newBuilds: 0,
      amenities: 0,
      areaQuality: 0,
    };
    expect(calculateFitScore(scores)).toBe(0);
  });

  it("returns 10 when all scores are 10", () => {
    const scores = {
      transport: 10,
      safety: 10,
      rentValue: 10,
      newBuilds: 10,
      amenities: 10,
      areaQuality: 10,
    };
    expect(calculateFitScore(scores)).toBe(10);
  });

  it("rounds to 2 decimal places", () => {
    const scores = {
      transport: 7.3,
      safety: 6.7,
      rentValue: 8.1,
      newBuilds: 5.9,
      amenities: 7.2,
      areaQuality: 6.4,
    };
    const result = calculateFitScore(scores);
    const decimalPlaces = result.toString().split(".")[1]?.length ?? 0;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/lib/scoring.test.ts --no-cache
```

Expected: FAIL — `Cannot find module '@/lib/scoring'`

- [ ] **Step 3: Configure Jest for TypeScript path aliases**

Add `jest.config.ts` to project root:

```typescript
import type { Config } from "jest";
import nextJest from "next/jest";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};

export default createJestConfig(config);
```

- [ ] **Step 4: Write the scoring implementation**

Write `lib/scoring.ts`:

```typescript
import { FIT_SCORE_WEIGHTS } from "./types";

interface SubScores {
  transport: number;
  safety: number;
  rentValue: number;
  newBuilds: number;
  amenities: number;
  areaQuality: number;
}

export function calculateFitScore(scores: SubScores): number {
  const weighted =
    scores.transport * FIT_SCORE_WEIGHTS.transport +
    scores.safety * FIT_SCORE_WEIGHTS.safety +
    scores.rentValue * FIT_SCORE_WEIGHTS.rentValue +
    scores.newBuilds * FIT_SCORE_WEIGHTS.newBuilds +
    scores.amenities * FIT_SCORE_WEIGHTS.amenities +
    scores.areaQuality * FIT_SCORE_WEIGHTS.areaQuality;

  return Math.round(weighted * 100) / 100;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest __tests__/lib/scoring.test.ts --no-cache
```

Expected: 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add lib/scoring.ts __tests__/lib/scoring.test.ts jest.config.ts
git commit -m "feat: add weighted fit score calculation with tests"
```

---

## Task 5: LLM Prompt Templates

**Files:**
- Create: `lib/prompts.ts`

- [ ] **Step 1: Write the prompt templates**

Write `lib/prompts.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/prompts.ts
git commit -m "feat: add LLM prompt templates for research engine"
```

---

## Task 6: Research Engine

**Files:**
- Create: `lib/research-engine.ts`, `__tests__/lib/research-engine.test.ts`

- [ ] **Step 1: Write the failing test**

Write `__tests__/lib/research-engine.test.ts`:

```typescript
import { parseAnalysisResponse } from "@/lib/research-engine";

describe("parseAnalysisResponse", () => {
  it("parses valid JSON response into ResearchData", () => {
    const json = JSON.stringify({
      overview: "A great area",
      safety: { score: 7.0, evidence: "Low crime", sources: ["met.police.uk"] },
      transport: {
        score: 8.5,
        stations: ["Canada Water"],
        commuteMins: 22,
        lines: ["Jubilee"],
        frequency: "Every 3 mins",
        sources: ["tfl.gov.uk"],
      },
      rentValue: {
        score: 6.5,
        rangeLow: 1650,
        rangeHigh: 1900,
        analysis: "Within budget",
        sources: ["rightmove.co.uk"],
      },
      newBuilds: {
        score: 8.0,
        developments: [
          {
            name: "Marine Wharf",
            features: ["concierge", "gym"],
            priceRange: "£1,700-1,900",
          },
        ],
        sources: ["rightmove.co.uk"],
      },
      amenities: {
        score: 7.5,
        details: "Good grocery options",
        sources: ["google.com"],
      },
      areaQuality: {
        score: 6.0,
        evidence: "Regeneration area",
        sources: ["local forums"],
      },
      pros: ["Direct Jubilee line", "New builds"],
      cons: ["Construction noise"],
    });

    const result = parseAnalysisResponse(json);
    expect(result.overview).toBe("A great area");
    expect(result.safety.score).toBe(7.0);
    expect(result.transport.commuteMins).toBe(22);
    expect(result.rentValue.rangeLow).toBe(1650);
    expect(result.newBuilds.developments).toHaveLength(1);
    expect(result.pros).toContain("Direct Jubilee line");
    expect(result.cons).toContain("Construction noise");
  });

  it("handles JSON wrapped in markdown code fences", () => {
    const json = '```json\n{"overview":"Test","safety":{"score":5,"evidence":"ok","sources":[]},"transport":{"score":5,"stations":[],"commuteMins":30,"lines":[],"frequency":"ok","sources":[]},"rentValue":{"score":5,"rangeLow":1500,"rangeHigh":1800,"analysis":"ok","sources":[]},"newBuilds":{"score":5,"developments":[],"sources":[]},"amenities":{"score":5,"details":"ok","sources":[]},"areaQuality":{"score":5,"evidence":"ok","sources":[]},"pros":["a"],"cons":["b"]}\n```';
    const result = parseAnalysisResponse(json);
    expect(result.overview).toBe("Test");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseAnalysisResponse("not json")).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/lib/research-engine.test.ts --no-cache
```

Expected: FAIL — `Cannot find module '@/lib/research-engine'`

- [ ] **Step 3: Write the research engine**

Write `lib/research-engine.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { PerplexityResult, ResearchData } from "./types";
import {
  perplexityQueries,
  analysisSystemPrompt,
  analysisUserPrompt,
} from "./prompts";

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
    throw new Error(
      `Perplexity API error: ${response.status} ${await response.text()}`
    );
  }

  const data = await response.json();
  return {
    query,
    content: data.choices[0].message.content,
    citations: data.citations ?? [],
  };
}

export async function gatherResearchData(
  area: string,
  borough: string
): Promise<PerplexityResult[]> {
  const queries = perplexityQueries(area, borough);
  const results = await Promise.all(queries.map(queryPerplexity));
  return results;
}

// --- Phase 2: Claude analysis ---

export function parseAnalysisResponse(text: string): ResearchData {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  // Validate required fields exist
  const required = [
    "overview",
    "safety",
    "transport",
    "rentValue",
    "newBuilds",
    "amenities",
    "areaQuality",
    "pros",
    "cons",
  ];
  for (const field of required) {
    if (!(field in parsed)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return parsed as ResearchData;
}

export async function analyseResearchData(
  area: string,
  borough: string,
  researchData: PerplexityResult[]
): Promise<{ data: ResearchData; rawResponse: string }> {
  const anthropic = new Anthropic();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: analysisSystemPrompt(),
    messages: [
      {
        role: "user",
        content: analysisUserPrompt(area, borough, researchData),
      },
    ],
  });

  const rawResponse =
    message.content[0].type === "text" ? message.content[0].text : "";
  const data = parseAnalysisResponse(rawResponse);

  return { data, rawResponse };
}

// --- Full research pipeline ---

export async function runResearch(
  area: string,
  borough: string
): Promise<{ data: ResearchData; rawResponse: string }> {
  const perplexityResults = await gatherResearchData(area, borough);
  return analyseResearchData(area, borough, perplexityResults);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/lib/research-engine.test.ts --no-cache
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/research-engine.ts __tests__/lib/research-engine.test.ts
git commit -m "feat: add two-phase research engine (Perplexity + Claude)"
```

---

## Task 7: Neighbourhoods API Route

**Files:**
- Create: `app/api/neighbourhoods/route.ts`, `__tests__/api/neighbourhoods.test.ts`

- [ ] **Step 1: Write the failing test**

Write `__tests__/api/neighbourhoods.test.ts`:

```typescript
import { GET, PATCH } from "@/app/api/neighbourhoods/route";
import { prisma } from "@/lib/db";

// Clean up after tests
afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/neighbourhoods", () => {
  it("returns neighbourhoods as JSON", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty("name");
    expect(data[0]).toHaveProperty("borough");
    expect(data[0]).toHaveProperty("zone");
  });
});

describe("PATCH /api/neighbourhoods", () => {
  it("updates neighbourhood status", async () => {
    // Get a neighbourhood to update
    const neighbourhood = await prisma.neighbourhood.findFirst();
    expect(neighbourhood).not.toBeNull();

    const request = new Request("http://localhost/api/neighbourhoods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: neighbourhood!.id, status: "yes" }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("yes");
  });

  it("rejects invalid status values", async () => {
    const neighbourhood = await prisma.neighbourhood.findFirst();

    const request = new Request("http://localhost/api/neighbourhoods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: neighbourhood!.id, status: "invalid" }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/api/neighbourhoods.test.ts --no-cache
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the API route**

Write `app/api/neighbourhoods/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const neighbourhoods = await prisma.neighbourhood.findMany({
    orderBy: [{ zone: "asc" }, { borough: "asc" }, { name: "asc" }],
    include: {
      researchProfile: {
        select: { fitScore: true },
      },
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
    return NextResponse.json(
      { error: "status must be yes, no, maybe, or null" },
      { status: 400 }
    );
  }

  const updated = await prisma.neighbourhood.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json(updated);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/api/neighbourhoods.test.ts --no-cache
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/neighbourhoods/ __tests__/api/neighbourhoods.test.ts
git commit -m "feat: add neighbourhoods API route (GET list, PATCH status)"
```

---

## Task 8: Research API Route

**Files:**
- Create: `app/api/research/route.ts`, `app/api/research/[id]/route.ts`

- [ ] **Step 1: Write the research trigger route**

Write `app/api/research/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runResearch } from "@/lib/research-engine";
import { calculateFitScore } from "@/lib/scoring";

export async function GET() {
  const profiles = await prisma.researchProfile.findMany({
    include: {
      neighbourhood: true,
    },
    orderBy: { fitScore: "desc" },
  });

  // Parse JSON string fields for the response
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
    return NextResponse.json(
      { error: "neighbourhoodId is required" },
      { status: 400 }
    );
  }

  const neighbourhood = await prisma.neighbourhood.findUnique({
    where: { id: neighbourhoodId },
  });

  if (!neighbourhood) {
    return NextResponse.json(
      { error: "Neighbourhood not found" },
      { status: 404 }
    );
  }

  // Create a research job
  const job = await prisma.researchJob.create({
    data: {
      neighbourhoodId,
      status: "running",
      startedAt: new Date(),
    },
  });

  // Run research asynchronously (don't await — return immediately)
  runResearchAndSave(neighbourhood.id, neighbourhood.name, neighbourhood.borough, job.id).catch(
    (err) => console.error(`Research failed for ${neighbourhood.name}:`, err)
  );

  return NextResponse.json({ jobId: job.id, status: "running" });
}

async function runResearchAndSave(
  neighbourhoodId: string,
  name: string,
  borough: string,
  jobId: string
) {
  try {
    const { data, rawResponse } = await runResearch(name, borough);

    const fitScore = calculateFitScore({
      transport: data.transport.score,
      safety: data.safety.score,
      rentValue: data.rentValue.score,
      newBuilds: data.newBuilds.score,
      amenities: data.amenities.score,
      areaQuality: data.areaQuality.score,
    });

    // Upsert the profile (replace if re-researching)
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
        modelUsed: "claude-sonnet-4-20250514 + perplexity-sonar",
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
        modelUsed: "claude-sonnet-4-20250514 + perplexity-sonar",
      },
    });

    // Mark job as done
    await prisma.researchJob.update({
      where: { id: jobId },
      data: { status: "done", completedAt: new Date() },
    });
  } catch (error) {
    await prisma.researchJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        completedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
```

- [ ] **Step 2: Write the single profile route**

Write `app/api/research/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const profile = await prisma.researchProfile.findFirst({
    where: { neighbourhoodId: id },
    include: { neighbourhood: true },
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Research profile not found" },
      { status: 404 }
    );
  }

  const parsed = {
    ...profile,
    safety: JSON.parse(profile.safety),
    transport: JSON.parse(profile.transport),
    rentValue: JSON.parse(profile.rentValue),
    newBuilds: JSON.parse(profile.newBuilds),
    amenities: JSON.parse(profile.amenities),
    areaQuality: JSON.parse(profile.areaQuality),
    pros: JSON.parse(profile.pros),
    cons: JSON.parse(profile.cons),
  };

  return NextResponse.json(parsed);
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/research/
git commit -m "feat: add research API routes (trigger, list, get profile)"
```

---

## Task 9: Journal & Compare API Routes

**Files:**
- Create: `app/api/journal/route.ts`, `app/api/compare/route.ts`

- [ ] **Step 1: Write the journal API route**

Write `app/api/journal/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const neighbourhoodId = searchParams.get("neighbourhoodId");

  const where = neighbourhoodId ? { neighbourhoodId } : {};

  const entries = await prisma.journalEntry.findMany({
    where,
    include: {
      neighbourhood: {
        select: { name: true, borough: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(entries);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { neighbourhoodId, content, decision, fitScoreSnapshot } = body;

  if (!content || content.trim() === "") {
    return NextResponse.json(
      { error: "content is required" },
      { status: 400 }
    );
  }

  const entry = await prisma.journalEntry.create({
    data: {
      neighbourhoodId: neighbourhoodId || null,
      content: content.trim(),
      decision: decision || null,
      fitScoreSnapshot: fitScoreSnapshot ?? null,
    },
    include: {
      neighbourhood: {
        select: { name: true, borough: true },
      },
    },
  });

  return NextResponse.json(entry);
}
```

- [ ] **Step 2: Write the compare API route**

Write `app/api/compare/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get("ids")?.split(",") ?? [];

  if (ids.length < 2 || ids.length > 3) {
    return NextResponse.json(
      { error: "Provide 2-3 neighbourhood IDs as ?ids=id1,id2,id3" },
      { status: 400 }
    );
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
```

- [ ] **Step 3: Commit**

```bash
git add app/api/journal/ app/api/compare/
git commit -m "feat: add journal and compare API routes"
```

---

## Task 10: Sidebar Navigation Component

**Files:**
- Create: `components/Sidebar.tsx`, `app/layout.tsx` (modify)

- [ ] **Step 1: Write the Sidebar component**

Write `components/Sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/map", label: "Map & Select", icon: "🗺️" },
  { href: "/research", label: "Research", icon: "🔬" },
  { href: "/compare", label: "Compare", icon: "⚖️" },
  { href: "/journal", label: "Journal", icon: "📓" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-screen w-16 flex-col items-center gap-2 border-r border-gray-800 bg-gray-950 py-4">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
            }`}
          >
            {item.icon}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Update the root layout**

Write `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "London Neighbourhood Research",
  description: "Research and compare London neighbourhoods for apartment hunting",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="flex h-screen overflow-hidden bg-gray-900 text-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Write the root page redirect**

Write `app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/map");
}
```

- [ ] **Step 4: Verify sidebar renders**

```bash
npm run dev
```

Open http://localhost:3000 — should redirect to /map and show the sidebar with 4 icons.

- [ ] **Step 5: Commit**

```bash
git add components/Sidebar.tsx app/layout.tsx app/page.tsx
git commit -m "feat: add sidebar navigation and root layout"
```

---

## Task 11: Map & Select View

**Files:**
- Create: `app/map/page.tsx`, `components/LondonMap.tsx`, `components/NeighbourhoodSelector.tsx`

- [ ] **Step 1: Write the LondonMap client component**

Write `components/LondonMap.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection } from "geojson";
import type { PathOptions } from "leaflet";

interface SelectedOptions {
  [key: string]: string; // postcode → "yes" | "no" | "maybe"
}

interface Props {
  selectedOptions: SelectedOptions;
  districts: { location: string; borough: string; postcodeDistrict: string }[];
}

const OPTION_COLORS: Record<string, string> = {
  yes: "#22c55e",
  no: "#ef4444",
  maybe: "#f59e0b",
};

export default function LondonMap({ selectedOptions, districts }: Props) {
  const [geoJsonData, setGeoJsonData] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/data/london_postcodes.json")
      .then((res) => res.json())
      .then(setGeoJsonData);
  }, []);

  function findDistrictsForPostcode(postcodeDistrict: string): string {
    return districts
      .filter((d) =>
        d.postcodeDistrict
          .split(",")
          .map((s) => s.trim())
          .includes(postcodeDistrict)
      )
      .map((d) => d.location)
      .join(", ");
  }

  function style(feature: Feature | undefined): PathOptions {
    if (!feature) return {};
    const name = feature.properties?.Name;
    const option = selectedOptions[name];
    return {
      fillColor: option ? OPTION_COLORS[option] ?? "#9ca3af" : "#9ca3af",
      fillOpacity: 0.5,
      weight: 1,
      color: "#374151",
    };
  }

  function onEachFeature(feature: Feature, layer: L.Layer) {
    const name = feature.properties?.Name ?? "";
    const districts = findDistrictsForPostcode(name);
    const tooltipContent = `<strong>${name}</strong>${districts ? `<br/>${districts}` : ""}`;
    layer.bindTooltip(tooltipContent);
  }

  if (!geoJsonData) return <div className="flex-1 bg-gray-900" />;

  return (
    <MapContainer
      center={[51.5074, -0.1278]}
      zoom={10}
      className="h-full w-full"
      style={{ background: "#111827" }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <GeoJSON
        key={JSON.stringify(selectedOptions)}
        data={geoJsonData}
        style={style}
        onEachFeature={onEachFeature}
      />
    </MapContainer>
  );
}
```

- [ ] **Step 2: Write the NeighbourhoodSelector component**

Write `components/NeighbourhoodSelector.tsx`:

```tsx
"use client";

import { useState, useMemo, useCallback } from "react";

interface Neighbourhood {
  id: string;
  name: string;
  borough: string;
  zone: number;
  postcodes: string;
  status: string | null;
  researchProfile?: { fitScore: number } | null;
  researchJobs?: { status: string }[];
}

interface Props {
  neighbourhoods: Neighbourhood[];
  onStatusChange: (id: string, status: string | null) => void;
}

const STATUS_COLORS: Record<string, string> = {
  yes: "bg-green-500/20 text-green-400 border-green-500/40",
  no: "bg-red-500/20 text-red-400 border-red-500/40",
  maybe: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
};

export default function NeighbourhoodSelector({
  neighbourhoods,
  onStatusChange,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedZones, setCollapsedZones] = useState<Set<number>>(new Set());
  const [collapsedBoroughs, setCollapsedBoroughs] = useState<Set<string>>(
    new Set()
  );

  // Group by zone → borough → neighbourhoods
  const grouped = useMemo(() => {
    const zones: Record<
      number,
      Record<string, Neighbourhood[]>
    > = {};

    for (const n of neighbourhoods) {
      if (!zones[n.zone]) zones[n.zone] = {};
      if (!zones[n.zone][n.borough]) zones[n.zone][n.borough] = [];
      zones[n.zone][n.borough].push(n);
    }

    return zones;
  }, [neighbourhoods]);

  // Filter by search
  const filteredZones = useMemo(() => {
    if (!searchQuery.trim()) return grouped;

    const q = searchQuery.toLowerCase();
    const result: Record<number, Record<string, Neighbourhood[]>> = {};

    for (const [zone, boroughs] of Object.entries(grouped)) {
      for (const [borough, items] of Object.entries(boroughs)) {
        const matched = items.filter(
          (n) =>
            n.name.toLowerCase().includes(q) ||
            n.borough.toLowerCase().includes(q) ||
            n.postcodes.toLowerCase().includes(q)
        );
        if (matched.length > 0) {
          const z = Number(zone);
          if (!result[z]) result[z] = {};
          result[z][borough] = matched;
        }
      }
    }

    return result;
  }, [grouped, searchQuery]);

  const toggleZone = useCallback((zone: number) => {
    setCollapsedZones((prev) => {
      const next = new Set(prev);
      next.has(zone) ? next.delete(zone) : next.add(zone);
      return next;
    });
  }, []);

  const toggleBorough = useCallback((borough: string) => {
    setCollapsedBoroughs((prev) => {
      const next = new Set(prev);
      next.has(borough) ? next.delete(borough) : next.add(borough);
      return next;
    });
  }, []);

  function renderStatusButtons(neighbourhood: Neighbourhood) {
    return (
      <div className="flex gap-1">
        {(["yes", "no", "maybe"] as const).map((s) => (
          <button
            key={s}
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(
                neighbourhood.id,
                neighbourhood.status === s ? null : s
              );
            }}
            className={`rounded px-2 py-0.5 text-xs font-semibold border transition-opacity ${
              neighbourhood.status === s
                ? STATUS_COLORS[s]
                : "bg-gray-800 text-gray-500 border-gray-700 opacity-50 hover:opacity-80"
            }`}
          >
            {s[0].toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  const sortedZones = Object.keys(filteredZones)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="flex h-full w-[340px] flex-col border-r border-gray-800 bg-gray-950">
      {/* Search */}
      <div className="border-b border-gray-800 p-3">
        <input
          type="text"
          placeholder="Search areas, boroughs, postcodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto p-2">
        {sortedZones.length === 0 && (
          <p className="p-4 text-center text-sm text-gray-500">No results</p>
        )}

        {sortedZones.map((zone) => {
          const boroughs = filteredZones[zone];
          const isZoneCollapsed = collapsedZones.has(zone);

          return (
            <div key={zone} className="mb-2">
              <button
                onClick={() => toggleZone(zone)}
                className="flex w-full items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-300"
              >
                <span
                  className={`text-[10px] transition-transform ${
                    isZoneCollapsed ? "" : "rotate-90"
                  }`}
                >
                  ▶
                </span>
                Zone {zone}
              </button>

              {!isZoneCollapsed &&
                Object.entries(boroughs)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([borough, items]) => {
                    const isBoroughCollapsed = collapsedBoroughs.has(borough);

                    return (
                      <div key={borough} className="ml-2">
                        <button
                          onClick={() => toggleBorough(borough)}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800"
                        >
                          <span
                            className={`text-[10px] transition-transform ${
                              isBoroughCollapsed ? "" : "rotate-90"
                            }`}
                          >
                            ▶
                          </span>
                          <span className="flex-1 text-left">{borough}</span>
                        </button>

                        {!isBoroughCollapsed && (
                          <div className="ml-4 space-y-1 py-1">
                            {items
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((n) => (
                                <div
                                  key={n.id}
                                  className="flex items-center justify-between rounded-lg bg-gray-900 px-3 py-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm text-gray-200">
                                      {n.name}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                      <span className="font-mono">
                                        {n.postcodes}
                                      </span>
                                      {n.researchJobs?.[0]?.status === "running" && (
                                        <span className="text-blue-400">
                                          Researching...
                                        </span>
                                      )}
                                      {n.researchProfile && (
                                        <span className="text-blue-400">
                                          {n.researchProfile.fitScore.toFixed(1)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {renderStatusButtons(n)}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Copy GeoJSON to public directory for client-side fetch**

```bash
cp data/london_postcodes.json public/data/london_postcodes.json
```

(Create the `public/data/` directory if needed: `mkdir -p public/data`)

- [ ] **Step 4: Write the Map page**

Write `app/map/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import NeighbourhoodSelector from "@/components/NeighbourhoodSelector";

// Dynamic import to avoid SSR issues with Leaflet
const LondonMap = dynamic(() => import("@/components/LondonMap"), {
  ssr: false,
  loading: () => <div className="flex-1 bg-gray-900" />,
});

interface Neighbourhood {
  id: string;
  name: string;
  borough: string;
  zone: number;
  postcodes: string;
  status: string | null;
  researchProfile?: { fitScore: number } | null;
  researchJobs?: { status: string }[];
}

export default function MapPage() {
  const [neighbourhoods, setNeighbourhoods] = useState<Neighbourhood[]>([]);

  useEffect(() => {
    fetch("/api/neighbourhoods")
      .then((res) => res.json())
      .then(setNeighbourhoods);
  }, []);

  const handleStatusChange = useCallback(
    async (id: string, status: string | null) => {
      // Optimistic update
      setNeighbourhoods((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status } : n))
      );

      const res = await fetch("/api/neighbourhoods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      if (!res.ok) {
        // Revert on failure
        setNeighbourhoods((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, status: n.status } : n
          )
        );
        return;
      }

      // Auto-trigger research if status is yes or maybe
      if (status === "yes" || status === "maybe") {
        const neighbourhood = neighbourhoods.find((n) => n.id === id);
        if (neighbourhood && !neighbourhood.researchProfile) {
          fetch("/api/research", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ neighbourhoodId: id }),
          });
        }
      }
    },
    [neighbourhoods]
  );

  // Build selectedOptions for the map (postcode → status)
  const selectedOptions: Record<string, string> = {};
  for (const n of neighbourhoods) {
    if (n.status) {
      for (const pc of n.postcodes.split(",").map((s) => s.trim())) {
        selectedOptions[pc] = n.status;
      }
    }
  }

  // Build districts list for map tooltips
  const districts = neighbourhoods.map((n) => ({
    location: n.name,
    borough: n.borough,
    postcodeDistrict: n.postcodes,
  }));

  return (
    <div className="flex h-full">
      <NeighbourhoodSelector
        neighbourhoods={neighbourhoods}
        onStatusChange={handleStatusChange}
      />
      <div className="flex-1">
        <LondonMap selectedOptions={selectedOptions} districts={districts} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify the map page works**

```bash
npm run dev
```

Open http://localhost:3000/map — should show sidebar with neighbourhoods and the map. Clicking yes/no/maybe should colour the map polygons.

- [ ] **Step 6: Commit**

```bash
git add app/map/ components/LondonMap.tsx components/NeighbourhoodSelector.tsx public/data/
git commit -m "feat: add Map & Select view with sidebar and Leaflet map"
```

---

## Task 12: Research View — Profile Cards Grid

**Files:**
- Create: `app/research/page.tsx`, `components/ProfileCard.tsx`, `components/ScoreBar.tsx`

- [ ] **Step 1: Write the ScoreBar component**

Write `components/ScoreBar.tsx`:

```tsx
interface Props {
  label: string;
  score: number;
  weight?: string;
}

function scoreColor(score: number): string {
  if (score >= 7.5) return "bg-green-500";
  if (score >= 5) return "bg-yellow-500";
  return "bg-red-500";
}

function scoreTextColor(score: number): string {
  if (score >= 7.5) return "text-green-400";
  if (score >= 5) return "text-yellow-400";
  return "text-red-400";
}

export default function ScoreBar({ label, score, weight }: Props) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className={`font-semibold ${scoreTextColor(score)}`}>
          {score.toFixed(1)}/10
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-700">
        <div
          className={`h-full rounded-full ${scoreColor(score)}`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
      {weight && (
        <div className="mt-0.5 text-right text-[10px] text-gray-600">
          {weight}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the ProfileCard component**

Write `components/ProfileCard.tsx`:

```tsx
import Link from "next/link";
import ScoreBar from "./ScoreBar";
import type { ResearchProfileRow } from "@/lib/types";

interface Props {
  profile: ResearchProfileRow;
}

export default function ProfileCard({ profile }: Props) {
  const n = profile.neighbourhood;
  const status = n?.status;

  const statusBadge: Record<string, string> = {
    yes: "bg-green-500/20 text-green-400",
    no: "bg-red-500/20 text-red-400",
    maybe: "bg-yellow-500/20 text-yellow-400",
  };

  return (
    <Link
      href={`/research/${profile.neighbourhoodId}`}
      className="block rounded-xl border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-600"
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <div>
          <div className="font-semibold text-gray-200">{n?.name}</div>
          <div className="text-xs text-gray-500">
            {n?.borough} · Zone {n?.zone}
          </div>
        </div>
        <div className="rounded-lg bg-blue-600 px-3 py-1.5 text-lg font-bold text-white">
          {profile.fitScore.toFixed(1)}
        </div>
      </div>

      {/* Overview snippet */}
      <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-gray-400">
        {profile.overview}
      </p>

      {/* Mini scores */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <ScoreBar label="Commute" score={profile.transport.score} />
        <ScoreBar label="Safety" score={profile.safety.score} />
        <ScoreBar label="Rent" score={profile.rentValue.score} />
        <ScoreBar label="New Builds" score={profile.newBuilds.score} />
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {status && (
          <span
            className={`rounded px-2 py-0.5 text-[11px] ${statusBadge[status] ?? ""}`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        )}
        {profile.transport.lines.length > 0 && (
          <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-300">
            {profile.transport.lines.join(", ")}
          </span>
        )}
        <span className="rounded bg-gray-800 px-2 py-0.5 text-[11px] text-gray-400">
          {profile.transport.commuteMins} min
        </span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Write the Research list page**

Write `app/research/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import ProfileCard from "@/components/ProfileCard";
import type { ResearchProfileRow } from "@/lib/types";

type SortKey = "fitScore" | "commute" | "safety" | "rent";
type StatusFilter = "all" | "yes" | "maybe" | "no";

export default function ResearchPage() {
  const [profiles, setProfiles] = useState<ResearchProfileRow[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("fitScore");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [minScore, setMinScore] = useState(0);

  useEffect(() => {
    fetch("/api/research")
      .then((res) => res.json())
      .then(setProfiles);
  }, []);

  const filtered = useMemo(() => {
    let result = profiles.filter((p) => p.fitScore >= minScore);

    if (statusFilter !== "all") {
      result = result.filter((p) => p.neighbourhood?.status === statusFilter);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "fitScore":
          return b.fitScore - a.fitScore;
        case "commute":
          return a.transport.commuteMins - b.transport.commuteMins;
        case "safety":
          return b.safety.score - a.safety.score;
        case "rent":
          return a.rentValue.rangeLow - b.rentValue.rangeLow;
        default:
          return 0;
      }
    });

    return result;
  }, [profiles, sortBy, statusFilter, minScore]);

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-bold text-gray-100">Research Profiles</h1>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-200"
        >
          <option value="fitScore">Sort: Fit Score</option>
          <option value="commute">Sort: Commute</option>
          <option value="safety">Sort: Safety</option>
          <option value="rent">Sort: Rent (low)</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-200"
        >
          <option value="all">Status: All</option>
          <option value="yes">Yes</option>
          <option value="maybe">Maybe</option>
          <option value="no">No</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-400">
          Min score:
          <input
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-16 rounded bg-gray-800 px-2 py-1 text-gray-200"
          />
        </label>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="text-gray-500">
          No research profiles yet. Mark neighbourhoods as &quot;Yes&quot; or
          &quot;Maybe&quot; on the map to trigger research.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((profile) => (
            <ProfileCard key={profile.id} profile={profile} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify the research page renders**

```bash
npm run dev
```

Open http://localhost:3000/research — should show "No research profiles yet" message (or profile cards if any research has been triggered).

- [ ] **Step 5: Commit**

```bash
git add app/research/page.tsx components/ProfileCard.tsx components/ScoreBar.tsx
git commit -m "feat: add Research view with filterable profile cards grid"
```

---

## Task 13: Research View — Full Profile Page

**Files:**
- Create: `app/research/[id]/page.tsx`

- [ ] **Step 1: Write the full profile page**

Write `app/research/[id]/page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import ScoreBar from "@/components/ScoreBar";
import type { ResearchProfileRow } from "@/lib/types";
import { FIT_SCORE_WEIGHTS } from "@/lib/types";

const WEIGHT_LABELS: Record<string, string> = {
  transport: `${FIT_SCORE_WEIGHTS.transport * 100}%`,
  safety: `${FIT_SCORE_WEIGHTS.safety * 100}%`,
  rentValue: `${FIT_SCORE_WEIGHTS.rentValue * 100}%`,
  newBuilds: `${FIT_SCORE_WEIGHTS.newBuilds * 100}%`,
  amenities: `${FIT_SCORE_WEIGHTS.amenities * 100}%`,
  areaQuality: `${FIT_SCORE_WEIGHTS.areaQuality * 100}%`,
};

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState<ResearchProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/research/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleReResearch() {
    if (!profile) return;
    await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neighbourhoodId: profile.neighbourhoodId }),
    });
    // Reload after a delay to show updated data
    setTimeout(() => window.location.reload(), 2000);
  }

  if (loading) {
    return <div className="p-6 text-gray-400">Loading...</div>;
  }

  if (!profile) {
    return <div className="p-6 text-gray-400">Profile not found.</div>;
  }

  const n = profile.neighbourhood;

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Back link */}
      <button
        onClick={() => router.push("/research")}
        className="mb-4 text-sm text-gray-500 hover:text-gray-300"
      >
        ← Back to all profiles
      </button>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{n?.name}</h1>
          <p className="text-sm text-gray-500">
            {n?.borough} · Zone {n?.zone} · {n?.postcodes}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600 px-4 py-2 text-2xl font-bold text-white">
            {profile.fitScore.toFixed(1)}
          </div>
          <button
            onClick={handleReResearch}
            className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-400 hover:bg-gray-700"
          >
            Re-research
          </button>
        </div>
      </div>

      {/* Overview */}
      <div className="mb-4 rounded-lg bg-gray-800/50 p-4">
        <h2 className="mb-2 text-sm font-semibold text-blue-400">OVERVIEW</h2>
        <p className="text-sm leading-relaxed text-gray-300">
          {profile.overview}
        </p>
      </div>

      {/* Score details */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        {/* Transport */}
        <div className="rounded-lg bg-gray-800/50 p-4">
          <ScoreBar
            label="COMMUTE"
            score={profile.transport.score}
            weight={WEIGHT_LABELS.transport}
          />
          <div className="mt-2 space-y-1 text-xs text-gray-400">
            <p>Stations: {profile.transport.stations.join(", ")}</p>
            <p>Westminster: {profile.transport.commuteMins} mins</p>
            <p>Lines: {profile.transport.lines.join(", ")}</p>
            <p>Frequency: {profile.transport.frequency}</p>
          </div>
          <div className="mt-2 rounded bg-gray-900 p-2 text-[11px] text-gray-600">
            Sources: {profile.transport.sources.join(", ")}
          </div>
        </div>

        {/* Safety */}
        <div className="rounded-lg bg-gray-800/50 p-4">
          <ScoreBar
            label="SAFETY"
            score={profile.safety.score}
            weight={WEIGHT_LABELS.safety}
          />
          <p className="mt-2 text-xs leading-relaxed text-gray-400">
            {profile.safety.evidence}
          </p>
          <div className="mt-2 rounded bg-gray-900 p-2 text-[11px] text-gray-600">
            Sources: {profile.safety.sources.join(", ")}
          </div>
        </div>

        {/* Rent Value */}
        <div className="rounded-lg bg-gray-800/50 p-4">
          <ScoreBar
            label="RENT VALUE"
            score={profile.rentValue.score}
            weight={WEIGHT_LABELS.rentValue}
          />
          <div className="mt-2 space-y-1 text-xs text-gray-400">
            <p>
              Range: £{profile.rentValue.rangeLow.toLocaleString()} - £
              {profile.rentValue.rangeHigh.toLocaleString()}/month
            </p>
            <p>{profile.rentValue.analysis}</p>
          </div>
          <div className="mt-2 rounded bg-gray-900 p-2 text-[11px] text-gray-600">
            Sources: {profile.rentValue.sources.join(", ")}
          </div>
        </div>

        {/* New Builds */}
        <div className="rounded-lg bg-gray-800/50 p-4">
          <ScoreBar
            label="NEW BUILDS"
            score={profile.newBuilds.score}
            weight={WEIGHT_LABELS.newBuilds}
          />
          <div className="mt-2 space-y-1 text-xs text-gray-400">
            {profile.newBuilds.developments.map((d, i) => (
              <p key={i}>
                • {d.name} — {d.features.join(", ")} ({d.priceRange})
              </p>
            ))}
          </div>
          <div className="mt-2 rounded bg-gray-900 p-2 text-[11px] text-gray-600">
            Sources: {profile.newBuilds.sources.join(", ")}
          </div>
        </div>

        {/* Amenities */}
        <div className="rounded-lg bg-gray-800/50 p-4">
          <ScoreBar
            label="AMENITIES"
            score={profile.amenities.score}
            weight={WEIGHT_LABELS.amenities}
          />
          <p className="mt-2 text-xs leading-relaxed text-gray-400">
            {profile.amenities.details}
          </p>
          <div className="mt-2 rounded bg-gray-900 p-2 text-[11px] text-gray-600">
            Sources: {profile.amenities.sources.join(", ")}
          </div>
        </div>

        {/* Area Quality */}
        <div className="rounded-lg bg-gray-800/50 p-4">
          <ScoreBar
            label="AREA QUALITY"
            score={profile.areaQuality.score}
            weight={WEIGHT_LABELS.areaQuality}
          />
          <p className="mt-2 text-xs leading-relaxed text-gray-400">
            {profile.areaQuality.evidence}
          </p>
          <div className="mt-2 rounded bg-gray-900 p-2 text-[11px] text-gray-600">
            Sources: {profile.areaQuality.sources.join(", ")}
          </div>
        </div>
      </div>

      {/* Pros / Cons */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
          <h3 className="mb-2 text-sm font-semibold text-green-400">PROS</h3>
          <ul className="space-y-1 text-xs text-gray-300">
            {profile.pros.map((pro, i) => (
              <li key={i}>• {pro}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <h3 className="mb-2 text-sm font-semibold text-red-400">CONS</h3>
          <ul className="space-y-1 text-xs text-gray-300">
            {profile.cons.map((con, i) => (
              <li key={i}>• {con}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Metadata */}
      <p className="mt-4 text-[11px] text-gray-600">
        Researched: {new Date(profile.researchedAt).toLocaleString()} · Model:{" "}
        {profile.modelUsed}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify the profile page renders**

```bash
npm run dev
```

Navigate to a profile from /research — should show the full breakdown with all scores, evidence, pros/cons, and sources.

- [ ] **Step 3: Commit**

```bash
git add app/research/\[id\]/page.tsx
git commit -m "feat: add full research profile page with score breakdowns"
```

---

## Task 14: Compare View

**Files:**
- Create: `app/compare/page.tsx`, `components/CompareTable.tsx`

- [ ] **Step 1: Write the CompareTable component**

Write `components/CompareTable.tsx`:

```tsx
import type { ResearchProfileRow } from "@/lib/types";

interface Props {
  profiles: ResearchProfileRow[];
}

function scoreCell(score: number) {
  const color =
    score >= 7.5
      ? "text-green-400"
      : score >= 5
        ? "text-yellow-400"
        : "text-red-400";
  return <span className={`font-semibold ${color}`}>{score.toFixed(1)}</span>;
}

export default function CompareTable({ profiles }: Props) {
  if (profiles.length === 0) return null;

  const rows: {
    label: string;
    render: (p: ResearchProfileRow) => React.ReactNode;
  }[] = [
    {
      label: "Fit Score",
      render: (p) => (
        <span className="rounded-lg bg-blue-600 px-2 py-1 font-bold text-white">
          {p.fitScore.toFixed(1)}
        </span>
      ),
    },
    {
      label: "Commute",
      render: (p) => (
        <span>
          {p.transport.commuteMins} min · {scoreCell(p.transport.score)}
        </span>
      ),
    },
    { label: "Safety", render: (p) => scoreCell(p.safety.score) },
    {
      label: "Rent (1-bed)",
      render: (p) => (
        <span className="text-gray-300">
          £{p.rentValue.rangeLow.toLocaleString()}-£
          {p.rentValue.rangeHigh.toLocaleString()}
        </span>
      ),
    },
    { label: "New Builds", render: (p) => scoreCell(p.newBuilds.score) },
    { label: "Amenities", render: (p) => scoreCell(p.amenities.score) },
    { label: "Area Quality", render: (p) => scoreCell(p.areaQuality.score) },
    {
      label: "Status",
      render: (p) => {
        const s = p.neighbourhood?.status;
        const colors: Record<string, string> = {
          yes: "text-green-400",
          no: "text-red-400",
          maybe: "text-yellow-400",
        };
        return s ? (
          <span className={colors[s] ?? ""}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </span>
        ) : (
          <span className="text-gray-600">—</span>
        );
      },
    },
    {
      label: "Key Pro",
      render: (p) => (
        <span className="text-xs text-gray-300">{p.pros[0] ?? "—"}</span>
      ),
    },
    {
      label: "Key Con",
      render: (p) => (
        <span className="text-xs text-gray-300">{p.cons[0] ?? "—"}</span>
      ),
    },
    {
      label: "Lines",
      render: (p) => (
        <span className="text-xs text-blue-300">
          {p.transport.lines.join(", ")}
        </span>
      ),
    },
  ];

  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className="border-b border-gray-800 p-3 text-left text-gray-500"></th>
          {profiles.map((p) => (
            <th
              key={p.id}
              className="border-b border-gray-800 p-3 text-center font-semibold text-gray-200"
            >
              {p.neighbourhood?.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={row.label}
            className={i % 2 === 0 ? "bg-gray-800/30" : ""}
          >
            <td className="p-3 text-gray-400">{row.label}</td>
            {profiles.map((p) => (
              <td key={p.id} className="p-3 text-center">
                {row.render(p)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Write the Compare page**

Write `app/compare/page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import CompareTable from "@/components/CompareTable";
import type { ResearchProfileRow, NeighbourhoodRow } from "@/lib/types";

export default function ComparePage() {
  const [allProfiles, setAllProfiles] = useState<ResearchProfileRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<ResearchProfileRow[]>([]);

  useEffect(() => {
    fetch("/api/research")
      .then((res) => res.json())
      .then(setAllProfiles);
  }, []);

  useEffect(() => {
    if (selectedIds.length < 2) {
      setCompareData([]);
      return;
    }
    fetch(`/api/compare?ids=${selectedIds.join(",")}`)
      .then((res) => res.json())
      .then(setCompareData);
  }, [selectedIds]);

  function toggleSelection(neighbourhoodId: string) {
    setSelectedIds((prev) => {
      if (prev.includes(neighbourhoodId)) {
        return prev.filter((id) => id !== neighbourhoodId);
      }
      if (prev.length >= 3) return prev; // Max 3
      return [...prev, neighbourhoodId];
    });
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-bold text-gray-100">
        Compare Neighbourhoods
      </h1>

      {/* Selector */}
      <div className="mb-6">
        <p className="mb-2 text-sm text-gray-400">
          Select 2-3 researched neighbourhoods to compare:
        </p>
        <div className="flex flex-wrap gap-2">
          {allProfiles.map((p) => {
            const isSelected = selectedIds.includes(p.neighbourhoodId);
            return (
              <button
                key={p.id}
                onClick={() => toggleSelection(p.neighbourhoodId)}
                disabled={!isSelected && selectedIds.length >= 3}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  isSelected
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-30"
                }`}
              >
                {p.neighbourhood?.name} ({p.fitScore.toFixed(1)})
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      {compareData.length >= 2 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <CompareTable profiles={compareData} />
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          {allProfiles.length < 2
            ? "Research at least 2 neighbourhoods to start comparing."
            : "Select at least 2 neighbourhoods above."}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify the compare page works**

```bash
npm run dev
```

Open http://localhost:3000/compare — should show neighbourhood selector pills and comparison table when 2+ are selected.

- [ ] **Step 4: Commit**

```bash
git add app/compare/ components/CompareTable.tsx
git commit -m "feat: add Compare view with side-by-side neighbourhood table"
```

---

## Task 15: Journal View

**Files:**
- Create: `app/journal/page.tsx`, `components/JournalTimeline.tsx`, `components/JournalEntryForm.tsx`

- [ ] **Step 1: Write the JournalEntryForm component**

Write `components/JournalEntryForm.tsx`:

```tsx
"use client";

import { useState } from "react";

interface Neighbourhood {
  id: string;
  name: string;
  borough: string;
}

interface Props {
  neighbourhoods: Neighbourhood[];
  onSubmit: (entry: {
    neighbourhoodId: string | null;
    content: string;
    decision: string | null;
  }) => void;
}

export default function JournalEntryForm({ neighbourhoods, onSubmit }: Props) {
  const [content, setContent] = useState("");
  const [neighbourhoodId, setNeighbourhoodId] = useState<string>("");
  const [decision, setDecision] = useState<string>("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    onSubmit({
      neighbourhoodId: neighbourhoodId || null,
      content: content.trim(),
      decision: decision || null,
    });

    setContent("");
    setNeighbourhoodId("");
    setDecision("");
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="mb-3 flex gap-3">
        <select
          value={neighbourhoodId}
          onChange={(e) => setNeighbourhoodId(e.target.value)}
          className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-200"
        >
          <option value="">General note</option>
          {neighbourhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name} ({n.borough})
            </option>
          ))}
        </select>

        {neighbourhoodId && (
          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-200"
          >
            <option value="">No decision change</option>
            <option value="yes">Changed to Yes</option>
            <option value="no">Changed to No</option>
            <option value="maybe">Changed to Maybe</option>
          </select>
        )}
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What are you thinking? Why did you make this decision?"
        rows={3}
        className="mb-3 w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-500"
      />

      <button
        type="submit"
        disabled={!content.trim()}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
      >
        Add Entry
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Write the JournalTimeline component**

Write `components/JournalTimeline.tsx`:

```tsx
import type { JournalEntryRow } from "@/lib/types";

interface Props {
  entries: JournalEntryRow[];
}

const DOT_COLORS: Record<string, string> = {
  yes: "bg-green-500",
  no: "bg-red-500",
  maybe: "bg-yellow-500",
};

const BADGE_STYLES: Record<string, string> = {
  yes: "bg-green-500/20 text-green-400",
  no: "bg-red-500/20 text-red-400",
  maybe: "bg-yellow-500/20 text-yellow-400",
};

export default function JournalTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No journal entries yet. Add your first note above.
      </p>
    );
  }

  return (
    <div className="relative border-l-2 border-gray-800 pl-6">
      {entries.map((entry) => {
        const dotColor = entry.decision
          ? DOT_COLORS[entry.decision] ?? "bg-blue-500"
          : "bg-blue-500";

        return (
          <div key={entry.id} className="relative mb-6">
            {/* Dot */}
            <div
              className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full border-[3px] border-gray-900 ${dotColor}`}
            />

            <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              {/* Header */}
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {entry.decision && (
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${BADGE_STYLES[entry.decision] ?? ""}`}
                    >
                      Changed to {entry.decision.charAt(0).toUpperCase() + entry.decision.slice(1)}
                    </span>
                  )}
                  {!entry.decision && (
                    <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[11px] font-semibold text-blue-300">
                      Note
                    </span>
                  )}
                  <span className="font-semibold text-gray-200">
                    {entry.neighbourhood?.name ?? "General"}
                  </span>
                </div>
                <span className="text-xs text-gray-600">
                  {new Date(entry.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Content */}
              <p className="text-sm leading-relaxed text-gray-400">
                {entry.content}
              </p>

              {/* Tags */}
              {(entry.fitScoreSnapshot || entry.neighbourhood) && (
                <div className="mt-2 flex gap-2">
                  {entry.fitScoreSnapshot && (
                    <span className="rounded bg-gray-800 px-2 py-0.5 text-[11px] text-gray-500">
                      Fit: {entry.fitScoreSnapshot.toFixed(1)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Write the Journal page**

Write `app/journal/page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import JournalTimeline from "@/components/JournalTimeline";
import JournalEntryForm from "@/components/JournalEntryForm";
import type { JournalEntryRow } from "@/lib/types";

interface Neighbourhood {
  id: string;
  name: string;
  borough: string;
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntryRow[]>([]);
  const [neighbourhoods, setNeighbourhoods] = useState<Neighbourhood[]>([]);
  const [filterNeighbourhoodId, setFilterNeighbourhoodId] = useState<string>("");

  useEffect(() => {
    fetch("/api/neighbourhoods")
      .then((res) => res.json())
      .then((data: Neighbourhood[]) =>
        setNeighbourhoods(data.sort((a, b) => a.name.localeCompare(b.name)))
      );
  }, []);

  useEffect(() => {
    const url = filterNeighbourhoodId
      ? `/api/journal?neighbourhoodId=${filterNeighbourhoodId}`
      : "/api/journal";
    fetch(url)
      .then((res) => res.json())
      .then(setEntries);
  }, [filterNeighbourhoodId]);

  async function handleNewEntry(entry: {
    neighbourhoodId: string | null;
    content: string;
    decision: string | null;
  }) {
    // Get fit score snapshot if a neighbourhood is selected
    let fitScoreSnapshot: number | null = null;
    if (entry.neighbourhoodId) {
      try {
        const res = await fetch(`/api/research/${entry.neighbourhoodId}`);
        if (res.ok) {
          const profile = await res.json();
          fitScoreSnapshot = profile.fitScore;
        }
      } catch {
        // No profile yet — that's fine
      }
    }

    const res = await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, fitScoreSnapshot }),
    });

    if (res.ok) {
      const newEntry = await res.json();
      setEntries((prev) => [newEntry, ...prev]);

      // If a decision was made, also update the neighbourhood status
      if (entry.decision && entry.neighbourhoodId) {
        await fetch("/api/neighbourhoods", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: entry.neighbourhoodId,
            status: entry.decision,
          }),
        });
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-bold text-gray-100">Decision Journal</h1>

      {/* New entry form */}
      <div className="mb-6">
        <JournalEntryForm
          neighbourhoods={neighbourhoods}
          onSubmit={handleNewEntry}
        />
      </div>

      {/* Filter */}
      <div className="mb-4">
        <select
          value={filterNeighbourhoodId}
          onChange={(e) => setFilterNeighbourhoodId(e.target.value)}
          className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-200"
        >
          <option value="">All areas</option>
          {neighbourhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name} ({n.borough})
            </option>
          ))}
        </select>
      </div>

      {/* Timeline */}
      <JournalTimeline entries={entries} />
    </div>
  );
}
```

- [ ] **Step 4: Verify the journal page works**

```bash
npm run dev
```

Open http://localhost:3000/journal — should show the entry form and empty timeline. Add an entry and verify it appears.

- [ ] **Step 5: Commit**

```bash
git add app/journal/ components/JournalTimeline.tsx components/JournalEntryForm.tsx
git commit -m "feat: add Journal view with timeline and entry form"
```

---

## Task 16: End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Start the dev server and verify all views**

```bash
npm run dev
```

1. Open http://localhost:3000 — should redirect to /map
2. Verify sidebar shows 4 icons, clicking each navigates correctly
3. On /map: search for a neighbourhood, mark it "yes" — map should colour the postcode
4. On /research: should show "no profiles yet" or cards if research has completed
5. On /compare: should show neighbourhood pills for selection
6. On /journal: add an entry, verify it appears in timeline

- [ ] **Step 2: Run the full test suite**

```bash
npx jest --no-cache
```

Expected: All tests pass.

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit any fixes**

If any issues were found, fix and commit:

```bash
git add -A
git commit -m "fix: resolve issues found during end-to-end verification"
```
