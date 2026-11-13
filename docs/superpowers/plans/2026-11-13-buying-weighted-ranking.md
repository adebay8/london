# Buying: weighted ranking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rank towns and homes by user-set weights, split /buying into Towns and Homes for sale, and lose nothing from today's page.

**Architecture:** A pure scoring module (`lib/homes/score.ts`) turns each home into 0–1 factor values on fixed scales from the brief and combines them with weights. A tiny localStorage store shares weights between pages. A shared data hook feeds both pages from `/api/homes`.

**Tech Stack:** Next.js 16 App Router (client pages), React 19, Tailwind v4 + Throughline tokens, Jest.

**Spec:** `docs/superpowers/specs/2026-11-13-buying-weighted-ranking-design.md`

## Global Constraints

- Throughline tokens only (`--paper --surface --sunk --line --line-control --ink/-2/-3 --focus --focus-wash --warn --bad`); no new colours.
- Fixed scales from the spec; a filter never changes a score.
- Unknown factor = 0.5 (neutral), and it's named in the why line when its weight ≥ 2.
- Weight values 0–3; presets exactly as the spec's table.
- Nothing from today's /buying is removed (spec's inventory table).
- Run tests with `npx jest`; typecheck with `npx tsc --noEmit -p .`.

## Review Focus

1. All weights set to 0 → score is `null`, cards show no score, and Recommended falls back to "Best match" order.
2. A town with no homes → still listed (unscored home-level factors), never crashes the map or table.
3. localStorage holds old or garbled JSON → defaults used, with no crash (test `readWeights` with bad input).
4. `/buying?town=x&kind=house` → those filters applied over the stored view.
5. Saving a Pick tile link with a town that has no houses → homes page shows the existing empty state.

---

### Task 1: Train frequency
**Files:** Modify `lib/homes/stations.ts`.
- [ ] Add `peakPerHour: number` to `StationInfo` and each station: croydon 20, slough 10, st-albans 10, hatfield 6, stevenage 6, woking 14, reading 14, high-wycombe 5, luton 8, dartford 10, harlow 4, chelmsford 10, milton-keynes 8, guildford 8, medway 8, bedford 8, basingstoke 6. Comment: approximate weekday 07:00–09:00 trains per hour into any London terminus; verify before deciding.

### Task 2: Scoring module
**Files:** Create `lib/homes/score.ts`; test in `__tests__/lib/homes.test.ts` ("weighted ranking" suite).

**Produces:**
- `type CriterionId = "trainTime"|"frequency"|"price"|"pricePerBed"|"walk"|"kind"|"garden"|"floorArea"|"ownership"|"beds"|"baths"`
- `type Weight = 0|1|2|3; type Weights = Record<CriterionId, Weight>`
- `CRITERIA: { id; label; level: "town"|"home"; hint }[]` (display order)
- `PRESETS: { id: PresetId; label; question; weights: Weights }[]`, `PresetId = "balanced"|"commute"|"value"|"own"|"grow"`; `presetOf(w): PresetId | null`
- `homeFactors(l: HomeListing): Record<CriterionId, number|null>`
- `scoreFactors(f, w): number|null` (0–100, weighted mean, null → 0.5; null when all weights are 0)
- `scoreHome(l, w): number|null`
- `townFactors(townId, homes): Record<CriterionId, number|null>` (town factors from the station; home factors = **mean** of known values, my call over median since several are yes/no)
- `explain(f, w, l?: HomeListing, townId?): { pros: string[]; cons: string[]; unknown: string[] }`: up to two pros (v ≥ 0.6, ranked by w·(v−0.5)), one con (v ≤ 0.4, worst), unknowns with w ≥ 2
- `readWeights(json: string|null): Weights` (validates; falls back to Balanced)

- [ ] Tests:
  - house, £200k, 3 bed, 15 min → `homeFactors` price 1, kind 1, beds 1, trainTime 1
  - £500k → price 0; 0.25 mi → walk 1; 1 mi → walk 0
  - new-build block → kind 0
  - garden null → `scoreFactors` treats it as 0.5
  - all-zero weights → null
  - same home, same score whatever other homes exist
  - `presetOf(PRESETS[i].weights) === PRESETS[i].id`
  - `readWeights("garbage")` deep-equals the Balanced weights
  - `explain` names "garden unknown" when the garden weight is 2 and the value is null
- [ ] Implement; run `npx jest homes` → PASS.

### Task 3: Shared state
**Files:** Create `lib/homes/useWeights.ts` (`useWeights(): [Weights, (w: Weights) => void]` via `useSyncExternalStore`, localStorage key `buying.weights`, server snapshot = Balanced) and `lib/homes/useHomes.ts` (fetch, retry, setPref, townById, dupes, hiddenDupes, live, stats: lifted from `app/buying/page.tsx`).

### Task 4: Weights panel
**Files:** Create `components/homes/WeightsPanel.tsx`: `({ weights, onChange, coverage?: Partial<Record<CriterionId, number>> })`. Presets as a radio group of pills, showing "Custom" when `presetOf` is null; one row per criterion with a 4-step segmented control (Off / A little / Matters / A lot) and "known for N%" when coverage < 95%.

### Task 5: Towns page
**Files:** Create `app/buying/towns/page.tsx` and `components/homes/Pick.tsx` (moved from page, `href` instead of `onClick`). Modify `components/homes/WhereToBuy.tsx`: optional `scores?: Map<string, { score: number|null; why: Why }>`; when given, add a Score column, a why line under the town name, and sort by score. Sortable column headers: Score, Train, Homes, Typical, Houses, Typical house. Modify `lib/nav.ts`: Buying pages `[Towns /buying/towns, Homes for sale /buying (exact)]`, with `exact?: boolean` on `NavPage` honoured by `isPageActive`.
Page order: header → Pick tiles → WeightsPanel → map + ranked table → selected `TownPanel` + "See its N homes →" → research to-do list. Towns with fewer than 5 live homes are marked "too few homes to judge".

### Task 6: Homes page
**Files:** Modify `app/buying/page.tsx`, `components/homes/HomeCard.tsx`.
- Remove the Pick tiles, map and research list (now on Towns); keep `TownPanel` when filtered to a town.
- Add the link "Not sure which town? See the town ranking →".
- Add the "Weights: <preset>" collapsible panel.
- Sort gains `recommended` (default, first): score desc, then the match order.
- HomeCard gets `score?: number|null` and `why?`, rendered as one line under the price.
- Persist filters in `buying.view`; `?town=` and `?kind=` override on load.

### Task 7: Verify
- [ ] `npx tsc --noEmit -p .` clean; `npx jest` all pass.
- [ ] Browser, desktop and mobile:
  - each preset reorders both pages;
  - reload keeps the settings;
  - Pick tiles land on filtered homes;
  - nav highlights one item.
