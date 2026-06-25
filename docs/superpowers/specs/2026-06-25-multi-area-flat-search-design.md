# Multi-area flat search — design

**Date:** 2026-06-25
**Status:** Approved design (pending spec review)
**Supersedes:** single-area behaviour of `.claude/skills/beaufort-flats/SKILL.md`
**Companion research:** `docs/flat-search/2026-06-25-area-expansion-research.md`

## Goal
Generalise the `beaufort-flats` skill from one hardcoded area (Beaufort Park + Colindale Gardens, NW9) to a **multi-area, tiered** search, while keeping every piece of existing Beaufort domain knowledge. New areas are Zone-3 NW/W developments matching the "Beaufort archetype", selected in the research dossier.

## Final area roster

| id | Area | Zone | Tier | Flags |
|---|---|---|---|---|
| `beaufort-colindale` | Beaufort Park + Colindale Gardens (NW9) | 4 | **anchor** | home/baseline |
| `ealing-broadway` | Ealing Broadway — Dickens Yard / Filmworks | 3 | **1** | — |
| `acton-gardens` | Acton Gardens / South Acton | 3 | **1** | — |
| `grand-union` | Grand Union, Alperton | 3/4 | **2** | zoneCaveat |
| `north-acton` | North Acton / Portal Way | 2/3 | **2** | mostlyOverBudget (BTR) |
| `cricklewood` | Cricklewood / Brent Cross West | 2/3 | **2** | natRail |
| `hendon-waterside` | Hendon Waterside / West Hendon | 3/4 | **2** | safetyCaution, natRail |
| `brent-cross-town` | Brent Cross Town | 3 | **2** | brandNew, mostlyOverBudget, natRail |

Anchor renders first (baseline). Within everything else: Tier 1 above Tier 2.

## Architecture

Three artefacts, same as today, all under `flat-search/`:
- `listings.json` — canonical store (source of truth).
- `flats.html` — self-contained viewer with an embedded `/*DATA_START*/…/*DATA_END*/` data block.
- `.claude/skills/beaufort-flats/SKILL.md` — the procedure.

### 1. Area config — `meta.areas[]`
Replaces the single `meta.criteria.area` + two top-level `searchUrls`. Each entry:
```jsonc
{
  "id": "ealing-broadway",
  "name": "Ealing Broadway — Dickens Yard / Filmworks",
  "borough": "Ealing", "zone": "3", "tier": 1,
  "buildingRoster": ["Dickens Yard", "Filmworks", ...],
  "phaseYears": { "Dickens Yard": 2016, "Filmworks": 2021 },   // best-known; refine live
  "btrOperators": ["Berkeley/St George", "Land Securities"],
  "operatorPortals": ["https://www.berkeleygroup.co.uk/...", ...],
  "searchUrls": { "zoopla": "...", "rightmove": "..." },
  "expectedBand": "over",          // "in" | "over" | "out" — guidance only, not a filter
  "flags": []                       // "safetyCaution" | "zoneCaveat" | "natRail" | "brandNew" | "mostlyOverBudget"
}
```
The `beaufort-colindale` entry preserves the full existing roster, phase-year table, and BTR building-map (Curtiss House, The Draper, Colindale Gardens etc.) verbatim — nothing is dropped.

### 2. Global budget — `meta.budget`
```jsonc
"budget": { "min": 1600, "inMax": 1850, "searchMax": 2000 }
```
- Search/fetch ceiling = `searchMax` (£2,000).
- `min`–`inMax` (£1,600–1,850) = **in budget**.
- `inMax`–`searchMax` (£1,851–2,000) = **overbudget** → kept, **collapsed** in viewer.
- `> searchMax` → dropped at fetch (out of range), as today's `< min` drop.

### 3. Listing shape changes
Each listing gains:
- `area` — the area `id` it belongs to.
- identity `id` = `area` + "-" + kebab(building) + "-" + price (was building+price). Prevents cross-area collisions (e.g. a "Foxglove House" in two areas).
- new budget classifier `budgetTier`: `"in" | "over"` (derived from price vs `meta.budget`; recomputed live by viewer too).

Existing 11 Beaufort listings are backfilled with `area:"beaufort-colindale"` and re-keyed. The reconcile step (firstSeen/lastSeen/status/isNew) is unchanged.

### 4. Ranking
Sort key (stable, top-to-bottom):
1. tier rank: anchor(0) < tier1(1) < tier2(2)
2. within group: scheme (BTR first — existing pref) → `phaseYear` desc (newest block) → price asc.
Budget tier does **not** reorder; over-budget rows are collapsed but stay in their area/sort position.

### 5. Viewer — `flats.html` (tabbed)
- **Tab bar**: `All` + one tab per area (anchor first, then Tier 1, then Tier 2). Each area tab header shows zone badge + tier label + caveat chips (⚠ safety, ⚠ Zone 3/4, 🚂 NatRail).
- **Area tab**: that area's listings, current grouping/cards reused, over-budget + problem + gone rows collapsed by default with a "show N hidden" toggle.
- **All tab**: single flat list across every area with:
  - **Search** box (building / street / agent substring).
  - **Filters**: area (multi), tier, budget (in / include over), scheme (BTR/private), hide-gone, hide-stale.
  - Sortable by the ranking key above; each row shows an area badge.
- Self-contained (no build step): vanilla JS, data from the embedded block. daysOnMarket still recomputed live from `listedDate` + `availableNow`.

## Procedure changes (SKILL.md)
The fetch → dedupe → staleness → BTR-tag → reconcile → write pipeline is kept, but **iterates `meta.areas`**:
1. For each area: fetch its `searchUrls.zoopla` + `searchUrls.rightmove`; keep only buildings in that area's roster; drop `<min` or `>searchMax`.
2. Dedupe within area (identity key now area-scoped); capture `listedDate`/`availableNow` per existing rules.
3. BTR-vs-private tagging per existing trust model, using each area's `btrOperators`/`operatorPortals`.
4. BTR-discovery sweep extended with new operator portals (UNCLE Acton, AWOL/One West Point, Akelius, Berkeley/St George, JOHNS&CO) alongside the existing NW9 ones.
5. Reconcile against store; set `area`, `budgetTier`; write `listings.json`; regenerate the `flats.html` data block.
6. Report: per-area new/gone counts + the top newest-in-budget pick **per tier**.

## What is explicitly out of scope (YAGNI)
- No integration into the Next.js app (user chose skill-only).
- No live re-scoring of areas (the dossier rubric scores are reference, not recomputed each run).
- No automated zone/commute lookups in the skill — those are baked into `meta.areas` from the dossier.

## Testing / verification
- Backfill migration: existing 11 listings still render under the Beaufort tab, none lost, ids re-keyed.
- One dry run per new area: confirm search URLs return the right buildings and roster-filtering works.
- Viewer: tabs switch; All-tab search + filters work; over-budget rows collapse; daysOnMarket recomputes.

## Risks
- Roster-filtering false-negatives in new areas (building names vary by agent) — mitigate with generous roster aliases + area keyword in the Rightmove URL.
- New-area phase-years are approximate — flagged; refined as live listings reveal completion dates.
