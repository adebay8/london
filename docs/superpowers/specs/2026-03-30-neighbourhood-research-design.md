# London Neighbourhood Research Tool — Design Spec

## Problem

Searching for a 1-bedroom apartment in London with information scattered across multiple sources, no documented reasoning behind decisions, and no structured way to compare neighbourhoods against specific criteria.

## Solution

Evolve the existing London map selector into a full research and decision-making tool with four views: Map & Select, Research Profiles, Compare, and Decision Journal. Migrate from a React SPA to Next.js to support a backend for AI-powered research and SQLite persistence.

## User Criteria

- Budget: ~£1,900/month all-in (rent + bills)
- Property: 1-bedroom flat, preferably new build / modern development
- Location: Nice, safe, well-kept neighbourhood over zone proximity
- Commute: ≤45-60 mins to Westminster, Tube/DLR preferred over National Rail
- Lifestyle: Clean, modern environment > nightlife
- Nice-to-haves: gym, concierge, balcony, secure entry, lift
- Trade-offs: Willing to go further out for genuinely nicer area; avoiding "cheap but not a lifestyle upgrade" areas

## Tech Stack

- **Framework:** Next.js 15 (App Router), TypeScript
- **Styling:** Tailwind CSS
- **Map:** React-Leaflet
- **Database:** SQLite via Prisma
- **Research (data gathering):** Perplexity Sonar API
- **Research (analysis):** Claude Sonnet API

## App Structure & Navigation

Four views accessible via a slim icon sidebar:

1. **Map & Select** (`/map`) — The existing neighbourhood selector migrated to Next.js. Browse by zone, mark areas yes/no/maybe. Map shows colour-coded polygons with a "researching" status indicator for areas being profiled.

2. **Research** (`/research`) — Filterable grid of profile cards for all researched neighbourhoods. Each card shows: name, borough, zone, fit score, mini sub-scores, commute time, transport line, and yes/no/maybe status. Sort by fit score, filter by status or minimum score. Click a card to expand the full profile (`/research/[id]`).

3. **Compare** (`/compare`) — Pick 2-3 areas from your shortlist. Side-by-side table comparing every factor: fit score, commute time, safety score, rent range, new builds score, status, key pro, key con.

4. **Journal** (`/journal`) — Timestamped decision timeline. Colour-coded entries: green (changed to yes), red (changed to no), orange (changed to maybe), blue (general note). Auto-logged when status changes; user adds reasoning. Filter by area. Each entry snapshots the fit score at that moment.

## Database Schema

Four tables in SQLite via Prisma:

### neighbourhoods
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Unique identifier |
| name | TEXT | e.g. "Bermondsey" |
| borough | TEXT | e.g. "Southwark" |
| zone | INTEGER | Transport zone (1-5) |
| postcodes | TEXT | Comma-separated postcode districts |
| status | TEXT | yes / no / maybe / null |
| updated_at | DATETIME | Last status change |

### research_profiles
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Unique identifier |
| neighbourhood_id | TEXT FK | → neighbourhoods.id |
| overview | TEXT | Prose summary of the area |
| safety | JSON | { score, evidence, sources } |
| transport | JSON | { score, stations, commute_mins, lines, frequency } |
| rent_value | JSON | { score, range_low, range_high, analysis, sources } |
| new_builds | JSON | { score, developments: [{ name, features, price_range }] } |
| amenities | JSON | { score, details, sources } |
| area_quality | JSON | { score, evidence, sources } |
| pros | JSON | Array of strings |
| cons | JSON | Array of strings |
| fit_score | REAL | Computed weighted composite |
| raw_response | TEXT | Full LLM response for debugging |
| researched_at | DATETIME | When research was completed |
| model_used | TEXT | Model identifier for traceability |

### journal_entries
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Unique identifier |
| neighbourhood_id | TEXT FK | → neighbourhoods.id (nullable for general notes) |
| content | TEXT | User's note / reasoning |
| decision | TEXT | yes / no / maybe / null |
| fit_score_snapshot | REAL | Fit score at time of entry (nullable) |
| created_at | DATETIME | When the entry was created |

### research_jobs
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Unique identifier |
| neighbourhood_id | TEXT FK | → neighbourhoods.id |
| status | TEXT | pending / running / done / failed |
| started_at | DATETIME | When job started |
| completed_at | DATETIME | When job finished |
| error | TEXT | Error message if failed |

## Fit Score Calculation

Computed server-side from weighted sub-scores. Each sub-score is 1-10, justified with evidence by the LLM.

| Factor | Weight | How It's Scored |
|--------|--------|-----------------|
| Commute to Westminster | 25% | Minutes door-to-door, penalised for transfers and National Rail reliance |
| Safety | 25% | Crime stats relative to London average, area reputation, street-level quality |
| Rent value | 20% | What £1,900 gets you — can you afford a 1-bed new build with bills? |
| New build availability | 15% | Number and quality of managed developments with desired features |
| Amenities | 10% | Grocery, parks, gyms, general convenience |
| Area quality | 5% | Cleanliness, upkeep, modern feel of the neighbourhood |

**Formula:** `fit_score = Σ(sub_score × weight)` — simple weighted average, transparent and auditable.

The LLM must provide evidence for each sub-score. The score is computed by the server, not assigned by the LLM, to ensure consistency.

## Research Engine — Two-Phase Architecture

### Phase 1: Data Gathering (Perplexity Sonar API)

5 focused queries per neighbourhood:

1. `"Current 1-bed new build rental prices in {area}, London 2025-2026"`
2. `"Transport links and commute time from {area} to Westminster London"`
3. `"Crime rates and safety in {area} London neighbourhood"`
4. `"New build developments with concierge gym in {area} London"`
5. `"What is {area} London like to live in, amenities, lifestyle"`

Perplexity returns cited, factual results. Cost: ~£0.01 per neighbourhood.

### Phase 2: Analysis & Scoring (Claude Sonnet API)

Single call with all Phase 1 data plus user criteria. Claude returns structured JSON:

```json
{
  "overview": "string",
  "safety": { "score": 7.0, "evidence": "...", "sources": ["..."] },
  "transport": { "score": 8.5, "stations": ["..."], "commute_mins": 22, "lines": ["Jubilee"], "frequency": "..." },
  "rent_value": { "score": 6.5, "range_low": 1650, "range_high": 1900, "analysis": "...", "sources": ["..."] },
  "new_builds": { "score": 8.0, "developments": [{ "name": "...", "features": ["..."], "price_range": "..." }] },
  "amenities": { "score": 7.5, "details": "...", "sources": ["..."] },
  "area_quality": { "score": 6.0, "evidence": "...", "sources": ["..."] },
  "pros": ["..."],
  "cons": ["..."]
}
```

Cost: ~£0.02-0.04 per neighbourhood. Total: ~£0.03-0.05 per neighbourhood, ~£1-2 for 30 areas.

### Research Trigger

- **Automatic:** When a neighbourhood status changes to "yes" or "maybe", a research job is created automatically if no profile exists.
- **Manual:** "Re-research" button on any profile to refresh stale data.
- **Status tracking:** Research jobs have status (pending/running/done/failed) shown in the UI.

## Project Structure

```
london/
├── app/
│   ├── layout.tsx              # Shell + sidebar nav
│   ├── page.tsx                # Redirect → /map
│   ├── map/
│   │   └── page.tsx            # Map & Select view
│   ├── research/
│   │   ├── page.tsx            # Profile cards grid
│   │   └── [id]/
│   │       └── page.tsx        # Full profile view
│   ├── compare/
│   │   └── page.tsx            # Side-by-side compare
│   ├── journal/
│   │   └── page.tsx            # Decision timeline
│   └── api/
│       ├── neighbourhoods/
│       │   └── route.ts        # GET (list), PATCH (update status)
│       ├── research/
│       │   ├── route.ts        # POST (trigger), GET (list)
│       │   └── [id]/
│       │       └── route.ts    # GET (profile)
│       ├── compare/
│       │   └── route.ts        # GET (compare data)
│       └── journal/
│           └── route.ts        # GET (list), POST (create)
├── lib/
│   ├── db.ts                   # Prisma SQLite connection
│   ├── research-engine.ts      # Orchestrates Phase 1 + Phase 2
│   ├── scoring.ts              # Weighted fit score calculation
│   └── prompts.ts              # LLM prompt templates
├── components/
│   ├── Sidebar.tsx             # Icon navigation sidebar
│   ├── LondonMap.tsx           # Leaflet map (migrated)
│   ├── ProfileCard.tsx         # Research card component
│   ├── ScoreBar.tsx            # Score visualisation bar
│   ├── CompareTable.tsx        # Side-by-side comparison grid
│   ├── JournalEntry.tsx        # Timeline entry component
│   └── NeighbourhoodSelector.tsx  # Zone/borough/location selector (migrated)
├── data/
│   ├── districts.json          # Existing location data (519 locations)
│   ├── districts_zones.json    # Existing zone mapping (33 boroughs)
│   └── london_postcodes.json   # Existing GeoJSON (177 postcode polygons)
├── prisma/
│   └── schema.prisma           # SQLite schema definition
└── london.db                   # SQLite database file
```

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/neighbourhoods` | List all neighbourhoods with status |
| PATCH | `/api/neighbourhoods` | Update neighbourhood status (triggers research if yes/maybe) |
| POST | `/api/research` | Manually trigger research for a neighbourhood |
| GET | `/api/research` | List all research profiles |
| GET | `/api/research/[id]` | Get full research profile for one neighbourhood |
| GET | `/api/compare` | Get comparison data for selected neighbourhood IDs |
| GET | `/api/journal` | List journal entries (filterable by neighbourhood) |
| POST | `/api/journal` | Create a journal entry |

## Migration from Current App

The existing React SPA data files carry over as-is:
- `districts.json` → `data/districts.json`
- `districts_zones.json` → `data/districts_zones.json`
- `london_postcodes.json` → `data/london_postcodes.json`

The existing map and selector components are migrated to the Next.js structure. localStorage selections are replaced by SQLite persistence. The existing UI logic for zone/borough/location hierarchy and map colouring is preserved.

## Environment Variables

```
PERPLEXITY_API_KEY=     # Perplexity Sonar API key
ANTHROPIC_API_KEY=      # Claude API key
DATABASE_URL=file:./london.db
```

## Cost Estimate

| Item | Cost |
|------|------|
| Perplexity (5 queries × neighbourhood) | ~£0.01 per area |
| Claude Sonnet (1 analysis call × neighbourhood) | ~£0.02-0.04 per area |
| Total per neighbourhood | ~£0.03-0.05 |
| Total for 30 areas | ~£1-2 |
| Re-research (same cost per area) | On-demand |
