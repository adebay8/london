---
name: beaufort-flats
description: Run the user's repeatable London 1-bed flat search across multiple areas (Beaufort Park/Colindale anchor + Zone-3 NW/W developments) on Zoopla + Rightmove, dedupe against the saved store, mark genuinely new listings, and regenerate the standalone tabbed HTML viewer. Use when the user says "run my flat search", "check flats", "beaufort flats", or invokes /beaufort-flats.
---

# London multi-area flat search

Repeatable rental search across several areas. Re-runs the same criteria per area, **accumulates** results into a persistent store (only adds genuinely new flats), marks what's new, flags what disappeared, and regenerates a standalone tabbed HTML viewer. Areas are **tiered**: `anchor` (Beaufort Park/Colindale, the baseline) → Tier 1 (established Zone-3 master-planned) → Tier 2 (newer/compromise Zone-3 developments).

## Files (all under `flat-search/`)
- `flat-search/listings.json` — canonical store. **Read first, write last.** `meta.areas[]` is the area roster; `meta.budget` is the global budget.
- `flat-search/viewer-logic.mjs` — pure view logic (budget/sort/group/staleness). Source of truth for the viewer's logic.
- `flat-search/flats.html` — self-contained tabbed viewer. Embeds the store between `/*DATA_START*/…/*DATA_END*/` and an exact copy of `viewer-logic.mjs` (minus `export `) between `/*LOGIC_START*/…/*LOGIC_END*/`. It also carries a **client-side want/reject layer** (✓/✗ buttons per card, saved in `localStorage` key `flatPrefs.v1`, keyed by listing id; want pins to top, reject strikes out & sinks). This is plain HTML/CSS/JS outside both marker blocks — regen only swaps DATA (and LOGIC if changed), so it is preserved. Keep listing `id`s stable so saved prefs survive.
- `scripts/verify-flat-search.mjs` — run `node --test scripts/verify-flat-search.mjs` after any edit.

Background: `docs/flat-search/2026-06-25-area-expansion-research.md` (area dossier + sources); `docs/superpowers/specs/2026-06-25-multi-area-flat-search-design.md` (design).

## Criteria
- **1 bed, 1 bath min, furnished.** Exclude retirement / shared / student.
- **Budget (`meta.budget`):** search to £2,000; **in budget £1,600–1,850**; **over budget £1,851–2,000** (kept, collapsed in viewer); drop `<£1,600` or `>£2,000`.
- **Priority:** anchor first (baseline), then Tier 1, then Tier 2; within an area, BTR first, then newest block (`phaseYear` desc), then cheapest.
- **Areas:** defined entirely in `meta.areas[]`. New areas must be Zone 3 (Zone 2 only if 1-beds land ≤£2,000). Each area carries its own roster, phase-years, BTR operators, operator portals, search URLs, and `flags`.

## Procedure

### 1. Load the store
Read `flat-search/listings.json`. Iterate `meta.areas`. For each area run steps 2–4 using that area's `searchUrls`, `buildingRoster`, `btrOperators`, `operatorPortals`.

### 2. Fetch both platforms (WebFetch), per area
- Fetch `area.searchUrls.zoopla` and `area.searchUrls.rightmove` (both already carry `price_max=2000`).
- Ask each fetch to list every listing with: building, street, price, furnished, available date, EPC, listing URL, agent.
- **Keep only buildings in `area.buildingRoster`** (match on normalised name; allow the area keyword in the Rightmove URL to pre-filter). Drop `<£1,600` or `>£2,000`, and anything outside the roster.
- Optionally WebFetch a few detail pages to fill EPC / sqft / availability.

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
The user is on a periodic tenancy that needs **two whole rent periods of notice**, so their earliest move-out is a step function (see `docs/superpowers/specs/2026-06-26-move-timing-window-design.md`). Config lives in `meta.moveTiming` (`rentPeriodAnchorDay` 14, `noticePeriodsRequired` 2, `overlapIdealDays` 7, `overlapMaxDays` 14, `noticeServedDate` null=rolling). You **store only `availableDate`** (step 3) — the viewer recomputes the move-out floor, notice deadline, and per-listing `timingFit` (`ideal`/`workable`/`early`/`late`/`unknown`) live each render via `viewer-logic.mjs`. **Nothing is dropped or re-tiered on timing** — it's a chip + sort only (over-budget pattern). Because the listing horizon (~4–6 wk) sits behind the user's lead time (~2.5–3.5 mo), expect almost everything to read `early` for now; well-timed (Sep-dated) stock surfaces from ~August. BTR is the bridge — operators let you pick a future start date, so an `early` BTR unit is reachable where a private immediate-let isn't.

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

### 7. Write the store, then regenerate the viewer
- Write the full updated object back to `flat-search/listings.json`.
- In `flat-search/flats.html`, replace everything between `/*DATA_START*/` and `/*DATA_END*/` with the new store (a trimmed copy; agent names may be shortened). Single Edit; do not touch the rest of the HTML/CSS/JS.
- If `flat-search/viewer-logic.mjs` changed, re-inline its body (minus `export `) between `/*LOGIC_START*/…/*LOGIC_END*/`.
- Run `node --test scripts/verify-flat-search.mjs` — must pass before reporting.

### 8. Report
Summarise per area: active count, **how many NEW this run** (name them), how many newly **delisted** (split removed vs let-agreed) and how many kept active but **unconfirmed**, and the top newest-in-budget pick **per tier** (anchor / Tier 1 / Tier 2). Tell the user to open `flat-search/flats.html`.
- **Timing line:** state the current move-out floor + notice deadline (days left), and the best **well-timed** (`ideal`/`workable`) pick per tier — *separately* from the newest-in-budget pick. If nothing is well-timed yet, say so plainly ("all live stock is too early; Sep-dated stock expected from ~August — hold or negotiate a BTR start date") rather than implying no options.

## Maintaining areas
- **Add an area:** append an object to `meta.areas[]` (id, name, borough, zone, tier, buildingRoster, phaseYears, btrOperators, operatorPortals, searchUrls with `price_max=2000`, expectedBand, flags) and run. No code change needed.
- **Flags** drive viewer chips: `safetyCaution`, `zoneCaveat`, `natRail`, `brandNew`, `mostlyOverBudget`.
- New areas must be Zone 3 (Zone 2 only if 1-beds ≤£2,000). Keep the anchor (`beaufort-colindale`, Zone 4) unchanged.
