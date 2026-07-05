# Flat-search → DB + Next.js page (design)

**Date:** 2026-07-06
**Status:** approved (user: "use your best judgement, just go")

## Goal
Retire the file-based flat-search store (`flat-search/listings.json` + self-contained `flats.html`). Make the app's SQLite DB (`london.db`, Prisma 7 / better-sqlite3) the **single source of truth**. When the `beaufort-flats` skill runs it reconciles into the DB via a committed sync script. A new `/flats` tab in the existing Next.js app renders the data, reusing the app's design system and the (tested) view-logic.

## Decisions
- **DB is sole source of truth.** `listings.json` and `flats.html` retire after a one-time import.
- **Standalone `Flat*` tables** — no coupling to `Neighbourhood`/`ApartmentBuilding` (different domain).
- **Want/reject → `FlatPref` table** + a tiny API route (persists cross-device); replaces the localStorage layer.
- **Dates stay ISO strings** (`"2026-07-05"`), not `DateTime`, so view-logic semantics are unchanged and there's no TZ drift.
- **Global config in the existing `Setting` table** as JSON (`flat.budget`, `flat.staleThresholds`, `flat.moveTiming`, `flat.lastRun`), not a new near-empty table.
- **`budgetTier` is stored** (derivable from price+scheme, handy for queries). **Timing + staleness are never stored** — recomputed live at render, as today.

## Data model (Prisma, all `@@map` snake_case)
- **FlatArea**: `id` String @id (e.g. `wembley-park`), `name`, `borough`, `zone`, `tier` (`anchor`|`1`|`2`), `expectedBand`, `sortOrder` Int, JSON-string cols: `buildingRoster`, `phaseYears`, `btrOperators`, `operatorPortals`, `searchUrls`, `flags`. Has many `FlatListing`.
- **FlatListing**: `id` String @id (existing stable kebab id), `areaId` → FlatArea, `building`, `street?`, `phaseYear? Int`, `phaseLabel?`, `price Int`, `budgetTier`, `furnished Bool`, `available?`, `availableNow Bool`, `availableDate?` (ISO), `listedDate?` (ISO), `epc?`, `sizeSqft? Int`, `scheme`, `operator?`, `schemeConfidence`, `schemeSource`, `firstSeen` (ISO), `lastSeen` (ISO), `lastConfirmed?` (ISO), `status`, `goneReason?`, `unconfirmed Bool @default(false)`, `isNew Bool @default(false)`, `imageUrl?`, `note?`. `@@index([areaId])`. Has many `FlatListingSource`, has one `FlatPref?`.
- **FlatListingSource**: `id` cuid, `listingId` → FlatListing (cascade), `platform`, `url`, `agent?`. `@@unique([listingId, url])`.
- **FlatPref**: `listingId` String @id → FlatListing (cascade), `pref` (`want`|`reject`), `updatedAt`.
- **Setting** (existing): keys `flat.budget`, `flat.staleThresholds`, `flat.moveTiming`, `flat.lastRun` — JSON string values.

## Modules
- **`lib/flat-search/view-logic.ts`** — TS port of `flat-search/viewer-logic.mjs` (budgetTier, daysOnMarket, staleTier, timing floor/deadline, timingFit/timingRank, compareListings, groupByArea). Pure, unit-tested.
- **`lib/flat-search/types.ts`** — shared TS types (Area, Listing, Source, Pref, Config, view row).
- **`lib/flat-search/reconcile.ts`** — pure reconciliation core (kebab id, budgetTier, apply reconfirm verdicts live/removed/let-agreed/blocked, upsert candidates w/ revival + source merge + isNew). Reused by sync script and tests.
- **`scripts/flat-search-sync.ts`** (tsx) — input: agent results JSON (`[{area, reconfirm[], candidates[]}]`, same shape the skill already produces). Loads current DB state, runs reconcile core, writes back via Prisma in a transaction, updates `flat.lastRun`. Prints a per-area summary.
- **`scripts/flat-search-migrate.ts`** (tsx, one-time) — imports `flat-search/listings.json` into the new tables + Setting keys; asserts counts (114 listings). Idempotent (upsert).

## App
- **`app/flats/page.tsx`** — server component. Reads FlatArea + FlatListing (incl. sources, pref) + Setting globals via `prisma`, serialises to plain objects, passes to the client view.
- **`components/flats/FlatsView.tsx`** — client. Sub-tabs **Summary / Homes / Operators** (mirrors flats.html), responsive filter rail, "Top picks only" toggle. Applies view-logic live (budget banding, timing chips, staleness, want/reject ordering). Cards show image, price, area/tier, scheme badge, timing + staleness chips.
- **Sub-components:** `FlatCard`, `FilterRail`, `AreaGroup`, `SummaryPanel`, `OperatorsPanel` — styled with existing CSS-var tokens (`--bg-primary`, `--status-*`, etc.), dark-first + light.
- **`app/api/flats/pref/route.ts`** — `POST {listingId, pref}` upserts FlatPref; `DELETE {listingId}` clears. FlatsView calls it optimistically.
- **Sidebar:** add `{ href: "/flats", label: "Flats", icon: "🔑" }` to `NAV_ITEMS`.

## Testing
- Jest (existing `ts-jest` setup) unit tests: `view-logic` (port existing assertions: budget/sort/group/staleness/timing) and `reconcile` (dedupe, isNew, gone removed/let-agreed, blocked→unconfirmed, revival clears goneReason, source merge).
- Replace `scripts/verify-flat-search.mjs` (which asserted `flats.html` embedding) with the jest suites; drop the HTML-embedding assertion.

## Skill change (`beaufort-flats`)
Steps 1–6 (fetch/reconcile-decisions per area) unchanged. Step 7 becomes: **run `npx tsx scripts/flat-search-sync.ts <results.json>`** to reconcile into the DB (instead of writing listings.json + regenerating flats.html). Step 8 report reads from the DB. SKILL.md updated to describe the DB store, the `Flat*` tables, and the sync script; file-store references removed.

## Constraints
- **Next.js 16 breaking changes** — read `node_modules/next/dist/docs/01-app/**` before writing `page.tsx`/`route.ts` (async `params`/`searchParams`, route handler signatures, dynamic APIs). Per AGENTS.md.
- Keep listing `id`s stable so imported history + prefs survive.

## Migration / rollout
1. Add models, `prisma migrate` (or db push) against `london.db`.
2. Run migrate script; verify 114 listings + 10 areas + config imported.
3. Build page + API + sidebar; verify render in the running app.
4. Update skill; wire sync script; smoke-test a no-op sync.
5. Archive `flat-search/listings.json` + `flats.html` (git history retains them); remove from the skill flow.
