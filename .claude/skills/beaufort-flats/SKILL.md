---
name: beaufort-flats
description: Run the user's repeatable London 1-bed flat search across multiple areas (Beaufort Park/Colindale anchor + Zone-3 NW/W developments) on Zoopla + Rightmove, dedupe against the saved store, mark genuinely new listings, and reconcile the results into the app database (rendered at the /flats page). Use when the user says "run my flat search", "check flats", "beaufort flats", or invokes /beaufort-flats.
---

# London multi-area flat search

Repeatable rental search across several areas. Re-runs the same criteria per area, **accumulates** results into a persistent store (only adds genuinely new flats), marks what's new, flags what disappeared, and reconciles into the app's SQLite DB. Areas are **tiered**: `anchor` (Beaufort Park/Colindale, the baseline) → Tier 1 (established Zone-3 master-planned) → Tier 2 (newer/compromise Zone-3 developments).

## Store — the app database (`london.db`, Prisma)
The store is the DB, **not** a JSON file. Tables (Prisma models, see `prisma/schema.prisma`): `FlatArea` (area roster/config), `FlatListing` (one row per flat, stable kebab `id`), `FlatListingSource` (`{platform,url,agent}` per listing), `FlatPref` (the ✓/✗ want/reject layer). Global config (budget, staleThresholds, moveTiming, lastRun) lives in the existing `settings` table under keys `flat.budget` / `flat.staleThresholds` / `flat.moveTiming` / `flat.lastRun`. Dates are ISO strings; **timing + staleness are never stored** — recomputed live at render.

## Scripts & modules
- **`npx tsx scripts/flat-search-dump.ts`** — read-only. Prints `{ config, areas, active }` JSON: the roster/config plus every active listing (id, area, building, price, scheme, source URLs). **Run this FIRST** to drive the per-area fetches and re-confirms (replaces "read listings.json").
- **`npx tsx scripts/flat-search-sync.ts <results.json> [--today YYYY-MM-DD]`** — reconciles a run into the DB and stamps `flat.lastRun`. `results.json` is the array of `{area, reconfirm[], candidates[]}` you assemble (schemas below). This is the **only** write step (replaces writing JSON + regenerating HTML).
- `lib/flat-search/` — `view-logic.ts` (budget/sort/staleness/timing, pure), `reconcile.ts` (the dedupe/isNew/gone/revival core the sync script runs), `store.ts` (DB↔object), `view-model.ts` (page derivation), `types.ts`.
- **Rendering:** the `/flats` page (`app/flats/page.tsx` + `components/flats/*`, served by the Next app) reads `GET /api/flats` and renders Summary / Homes / Operators tabs with the design system. Want/reject persist via `POST /api/flats/pref` → `FlatPref` (cross-device; no more localStorage). Keep listing `id`s stable so prefs survive.
- **Verify:** `npx jest flat-search` (view-logic + reconcile suites) — must pass after any logic change. The old `flat-search/` files and `scripts/verify-flat-search.mjs` are retired.
- **Fresh DB / rebuild:** `london.db` is gitignored (local-only, like the app's other data). `npx tsx scripts/flat-search-seed.ts` bootstraps the flat store from the committed baseline `data/flat-search-seed.json` (skips if listings already exist; `--force` to overwrite). Running the search then advances the live DB from there.

Background: `docs/flat-search/2026-06-25-area-expansion-research.md` (area dossier + sources); `docs/superpowers/specs/2026-06-26-multi-area-flat-search-design.md` and `docs/superpowers/specs/2026-07-06-flat-search-db-migration-design.md` (designs).

## Criteria
- **1 bed, 1 bath min, furnished.** Exclude retirement / shared / student.
- **Budget (`meta.budget`):** **in budget £1,600–1,850**; **over budget (private) £1,851–2,000** (kept, collapsed); **BTR band £1,851–`btrMax` (2,150)** — BTR only, surfaced in the MAIN list (not collapsed), badged "BTR band". Drop `<£1,600`, private `>£2,000`, or BTR `>£2,150`. `budgetTier(price, budget, scheme)` returns `in`|`btr`|`over` (scheme-aware — pass the listing's `scheme`).
- **Priority:** anchor first (baseline), then Tier 1, then Tier 2; within an area, BTR first, then newest block (`phaseYear` desc), then cheapest.
- **Areas:** defined entirely in `meta.areas[]`. New areas must be Zone 3 (Zone 2 only if 1-beds land ≤£2,000). Each area carries its own roster, phase-years, BTR operators, operator portals, search URLs, and `flags`.

## Procedure

### 1. Load the store
Run `npx tsx scripts/flat-search-dump.ts` and parse its JSON. Iterate `areas`. For each area run steps 2–4 using that area's `searchUrls`, `buildingRoster`, `btrOperators`, `operatorPortals`. Use the `active` list (id, area, building, price, sources) to build the per-area re-confirm sets (step 5). `config` carries the budget, staleThresholds, and moveTiming.

### 2. Fetch both platforms (WebFetch), per area
- Fetch `area.searchUrls.zoopla` and `area.searchUrls.rightmove` (both already carry `price_max=2000`).
- Ask each fetch to list every listing with: building, street, price, furnished, available date, EPC, listing URL, agent.
- **Keep only buildings in `area.buildingRoster`** (match on normalised name; allow the area keyword in the Rightmove URL to pre-filter). Drop `<£1,600`; drop **private** `>£2,000` and **BTR** `>£2,150`; drop anything outside the roster.
- Optionally WebFetch a few detail pages to fill EPC / sqft / availability.

### 2a. Fetch operator portals for BTR (BTR hides from Zoopla/Rightmove)
BTR is structurally under-listed on the aggregators — operators drive renters to their own sites — so portal fetches are the ONLY reliable way to surface BTR. For each area, also WebFetch `area.operatorPortals` (and BTR aggregators: `buildtorentdirectory.co.uk`, `rightnowresidential.co.uk`, `lovetorent.co.uk`). Extract building, 1-bed price, availability, furnished. Tag `scheme:"btr"`, `operator`, `schemeConfidence:"confirmed"` (operator site = primary source). Keep BTR up to `budget.btrMax` (£2,150), not just `searchMax`. Major operators: Quintain Living (quintainliving.com — Wembley Park), UNCLE (uncle.co.uk — Colindale/Wembley/Acton), Way of Life (The Draper), Savills (Curtiss House), Get Living, Greystar, Grainger, Vertus, Dandi, L&Q PRS. Expect BTR 1-beds to cluster **£1,900–2,150** — that band is why `btrMax` exists. **Wembley Park is the priority Tier-1 fallback** (it's the user's preferred move-target — fast Jubilee/Met, densest in-band BTR) — search it as a MULTI-development area, not one operator: Quintain Living (newest blocks Solar & Luna 2025) **plus** Fulton & Fifth (Regal London, in-band 1-beds ~£1,700–1,900), UNCLE, Dandi, Vonder. Don't keyword-filter the portal/aggregator search to a single operator — that hides the others. Note availability: BTR lets you pick a future start date, so an "early"-timed BTR unit is reachable where a private immediate-let isn't.

### 3. Capture listing date + staleness signal (per listing)
WebFetch each kept listing's detail page; extract the listed/added date:
- **Zoopla:** `"datePosted":"YYYY-MM-DDThh:mm:ss"` in the JSON-LD schema → `listedDate`. Ask: *"What is datePosted in the schema? What is the availability date? Does it say Reduced?"*
- **Rightmove:** "Added on DD/MM/YYYY" or "Reduced on" (Reduced resets the clock → use as effective `listedDate`).
- Fallback: lower listing-ID magnitude = older.
- `availableNow` = true only if availability is "now"/immediate/a past date. A FUTURE date → false.
- `availableDate` = the concrete availability date as ISO `"YYYY-MM-DD"` when the page gives one (e.g. "Available 5 Aug 2026" → `"2026-08-05"`); `null` for "now"/"immediate"/"Ask agent"/unknown (no extra fetch — it's on the same detail page). This feeds the move-timing fit (step 3b). Prefer an exact date; don't guess.
- **Staleness rule:** a long-listed flat is a red flag ONLY when `availableNow` is true. Future-dated availability = early marketing, never flag.
- Thresholds in `meta.staleThresholdsDays` (slow 45 / stale 90 / problem 150). The viewer recomputes daysOnMarket live — store only `listedDate` + `availableNow`.
- Watch evergreen/placeholder listings (on-site dev agents keep standing listings live for months → availableNow + very high dom → buried in the problem tier).

### 3b. Move-timing fit (the user's notice window)
The user is on a periodic tenancy that needs **two whole rent periods of notice**, so their earliest move-out is a step function (see `docs/superpowers/specs/2026-06-26-move-timing-window-design.md`). Config lives in `config.moveTiming` (`settings` key `flat.moveTiming`: `rentPeriodAnchorDay` 14, `noticePeriodsRequired` 2, `overlapIdealDays` 7, `overlapMaxDays` 14, `noticeServedDate` null=rolling). You **store only `availableDate`** (step 3) — the `/flats` page recomputes the move-out floor, notice deadline, and per-listing `timingFit` (`ideal`/`workable`/`early`/`late`/`unknown`) live each render via `lib/flat-search/view-logic.ts`. **Nothing is dropped or re-tiered on timing** — it's a chip + sort only (over-budget pattern). Because the listing horizon (~4–6 wk) sits behind the user's lead time (~2.5–3.5 mo), expect almost everything to read `early` for now; well-timed (Sep-dated) stock surfaces from ~August. BTR is the bridge — operators let you pick a future start date, so an `early` BTR unit is reachable where a private immediate-let isn't.

### 3c. Capture the listing image → `imageUrl` (card thumbnail)
From the **same** detail-page fetch as step 3 (no extra request), grab one photo URL into `imageUrl`. The viewer shows it at the top of each card; a missing/absent `imageUrl` just renders a graceful no-image card, and a broken link hides itself via `onerror`.
- **Zoopla:** the `og:image` meta tag → `https://lid.zoocdn.com/u/480/360/<hash>.jpg`. Store the `480/360` form as-is; the viewer upscales `/u/480/360/` → `/u/720/540/` for crispness.
- **Rightmove:** has **no** `og:image` — take the **first property photo**: `https://media.rightmove.co.uk/dir/property-photo/<dir>/<listingId>/<hash>_max_656x437.jpeg` (it embeds the listing id, so confirm it matches; may end `.png`).
- Add to the step-3 fetch prompt: *"Also output the og:image URL (Zoopla), or the first https://media.rightmove.co.uk property-photo URL (Rightmove)."*
- Both CDNs hotlink from the static page (verified, incl. no-referrer). A **404 on the detail page** = listing likely delisted → handle via step 6 status logic and leave `imageUrl` absent.

### 4. Tag the letting scheme (BTR vs private)
Set `scheme` = `"btr"|"private"|"unknown"`, plus `operator`. Decide in order:
1. **Per-area building map / operators** — use `area.btrOperators`. **Anchor (Beaufort Park) is MIXED-tenure** — institutions run BTR pockets alongside many private-landlord blocks. Confirmed BTR there: The Draper/Duxford Tower (Way of Life, usually >£2,100); Curtiss House (Savills, 1-beds can be in budget, pull from Savills/newbuildhomes). Private blocks: Beaufort Square (Capri/Goldhawk/Golding/Fairbank/Fermont/Argent), Caversham Road (Castleton/Cornelia/Celeste), Boulevard Drive (Amelia/Allard), Bute Close (Grevillea). Treat Folio @ Beaufort Park as `unverified` → default private unless a live Folio listing appears.
2. **Operator-brand match on the lister** → tag `btr` + operator. Known NW/W operators: Way of Life, UNCLE, AWOL, Akelius, Get Living, Greystar, Quintain Living, Essential Living, Fizzy, Folio, Vertus, Grainger, Moda, Apo, Dandi, Allsop, Atlas, Berkeley/St George, Related Argent, L&Q PRS.
3. **BTR text signals:** "built for renters", "no/zero deposit", "no agency/admin fees", "on-site management", "resident app", "flexible/rolling tenancy", "by [brand]".
4. **Private signals:** high-street letting agent (Benham & Reeves, Dexters, EGRE, Romans & Partners, LDM, Foxtons…); standard AST + 5-week deposit. Same building across several DIFFERENT agents → fragmented private ownership, never BTR.
5. Else `unknown`. Store `schemeConfidence` ("confirmed"|"likely"|"unverified") and `schemeSource`. A BTR tag is `confirmed` only with the operator's own site OR a live operator-branded listing.

### 4b. BTR discovery sweep (directories are leads, not truth)
Aggregators MISS most BTR. Each run, also sweep:
- Directories: buildtorentdirectory.co.uk, rightnowresidential.co.uk, HomeViews, newbuildhomes.org, Foxtons BTR, the BPF BTR map.
- Operator portals (from each `area.operatorPortals`): e.g. **UNCLE Acton** (uncle.co.uk/acton), **One West Point / AWOL** (onewestpoint.com), **Akelius** (Cricklewood), **Berkeley/St George** (Grand Union, Dickens Yard), **Related Argent** (Brent Cross Town / themaplenw2.com), plus the anchor's Way of Life / Savills / UNCLE Colindale / L&Q.
- **Trust rule:** a directory entry is a LEAD only. Tag `btr` `confirmed` only when the operator's own site lists the building today OR a live operator-branded listing exists. Trust operator site / live listing over the directory.

### 5. Reconcile against the store (dedupe over time)
**Identity key** `id` = `area` + "-" + kebab(building) + "-" + price (area-scoped, so the same building name in two areas never collides). Across platforms/agents, same area+building+price = the SAME flat → merge into one entry with multiple `sources[]` (`{platform,url,agent}`).
- Already in store (same id): keep `firstSeen`; `lastSeen` = today; `status` = "active"; `isNew` = **false**. Update price/availability/sources if changed.
- Not in store: add. `firstSeen` = `lastSeen` = today; `status` = "active"; `isNew` = **true**.
- In store but NOT found this run → **verify the link before delisting — NEVER assume "not found in search" = gone** (search fetches are noisy and miss live listings). WebFetch the listing's saved `sources[].url`(s) and decide:
  - Page is **removed / 404 / "no longer on the market" / "this property has been removed"** → `status` = "gone", `goneReason` = "removed", `isNew` = false. **Do not delete** (kept for history).
  - Page shows **"Let Agreed" / "Let" / tenancy agreed** → `status` = "gone", `goneReason` = "let-agreed", `isNew` = false.
  - Page **still renders live** (full active details, no removal/let-agreed banner) → keep `status` = "active", `isNew` = false, clear any `unconfirmed`, set `lastConfirmed` = today.
  - Fetch **blocked / ambiguous / can't tell** → keep `status` = "active", `isNew` = false, set `unconfirmed` = true, leave `lastSeen` unchanged. **Never delist on a failed or inconclusive check.**
  - A previously-`unconfirmed` listing that reappears in a later run's search → clear `unconfirmed`, set `lastConfirmed`/`lastSeen` = today.
- Set `area` and `budgetTier` (`"over"` if `price > meta.budget.inMax`, else `"in"`) on every listing.
- Listing status fields: `status` ("active"|"gone"), `goneReason` ("removed"|"let-agreed"|absent), `unconfirmed` (true when kept active but the link couldn't be re-confirmed), `lastConfirmed` (date the link was last verified live). The viewer renders `unconfirmed` as an active card with a dashed "unconfirmed" chip; `gone` shows a "removed" or "let agreed" label in the collapsed history section.
- Set `meta.lastRun` = today (from environment/system context — do not invent).

### 6. Assign block age (newest-first ranking)
Use `area.phaseYears[building]` where present (higher year = newer = ranks first). For the anchor, the full Beaufort/Colindale phase map lives there (Duxford Tower 2025 … Adrienne 2007). When a block isn't listed: EPC B ≈ newer (2018+), EPC C ≈ older; prefer documented launch dates over EPC. Refine new-area phase-years as live listings reveal completion dates.
- **Pin the specific BLOCK, not the street.** Some streets host multiple blocks of very different ages — e.g. Lismore Boulevard / Colindale Gardens spans **Newington House (2018) → Reverence House (2021)**. Extract the actual building name from the listing title/detail page and use `phaseYears[building]`; only fall back to the street-keyed year (e.g. `Lismore Boulevard` 2021) when the block name is genuinely absent. Confirmed Colindale Gardens block years: Newington 2018, Grevillea 2019, Florence 2020, Reverence 2021, Genista & Gladness 2022, Dianthus (Dahlia/Diascia/Darmera) 2025. We only need exact years for blocks that actually appear as listings — don't chase years for blocks with no live listing.

### 7. Reconcile into the DB (the only write step)
Assemble a `results.json` array — one entry per area — then run the sync script. **Don't hand-edit the DB;** the reconcile core (dedupe, isNew, gone removed/let-agreed, blocked→unconfirmed, revival + source-merge, price-change re-tier) runs inside the script. Shape:
```jsonc
[ { "area": "<area id>",
    "reconfirm": [ { "id": "<listing id>", "verdict": "live|removed|let-agreed|blocked",
                     "newPrice": 1800, "note": "..." } ],   // newPrice/note optional
    "candidates": [ { "building": "", "street": "", "price": 0, "furnished": true,
                      "scheme": "btr|private|unknown", "operator": null,
                      "schemeConfidence": "confirmed|likely|unverified", "schemeSource": "",
                      "available": "", "availableNow": false, "availableDate": null,
                      "listedDate": null, "epc": null, "sizeSqft": null,
                      "sources": [ { "platform": "", "url": "", "agent": "" } ],
                      "imageUrl": null, "note": "" } ] } ]
```
Candidate `id` is derived (`area-kebab(building)-price`); a candidate whose id already exists updates/​revives it and merges sources (not "new"). Then:
- `npx tsx scripts/flat-search-sync.ts results.json` (add `--today YYYY-MM-DD` only if the environment date must be overridden). It writes all changes and stamps `flat.lastRun`.
- `npx jest flat-search` — must pass before reporting.

### 8. Report
Summarise per area: active count, **how many NEW this run** (name them), how many newly **delisted** (split removed vs let-agreed) and how many kept active but **unconfirmed**, and the top newest-in-budget pick **per tier** (anchor / Tier 1 / Tier 2). Tell the user to open the **/flats** page in the app (Flats tab in the sidebar).
- **Timing line:** state the current move-out floor + notice deadline (days left), and the best **well-timed** (`ideal`/`workable`) pick per tier — *separately* from the newest-in-budget pick. If nothing is well-timed yet, say so plainly ("all live stock is too early; Sep-dated stock expected from ~August — hold or negotiate a BTR start date") rather than implying no options.

## Maintaining areas
- **Add an area:** insert a `FlatArea` row (id, name, borough, zone, tier, buildingRoster, phaseYears, btrOperators, operatorPortals, searchUrls with `price_max=2000`, expectedBand, flags, sortOrder) — e.g. a one-off `tsx` script calling `upsertAreas` from `lib/flat-search/store.ts`, then run. No app-code change needed.
- **Flags** drive viewer chips: `safetyCaution`, `zoneCaveat`, `natRail`, `brandNew`, `mostlyOverBudget`.
- New areas must be Zone 3 (Zone 2 only if 1-beds ≤£2,000). Keep the anchor (`beaufort-colindale`, Zone 4) unchanged.
