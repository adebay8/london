# Buying: weighted ranking, and towns split from homes

Date: 2026-11-13 · Status: awaiting approval

## Why

On /buying the first filter is "town", but nothing says which town is best,
so the user doesn't know where to start. "Best" isn't fixed: some days it's
"fastest into London", other days speed *and* price together, or several
things at once. Today you can sort by only one thing at a time, so there's no
way to see how the order changes when criteria are combined.

The user also mixes two kinds of use on one page:
- **Look-up material** (town overview, map, research notes and gaps): useful,
  checked occasionally, and they want to know where it lives.
- **The working list** (the homes): revisited day after day with different
  filters, sorting and weights.

NN/g ([compensatory vs noncompensatory decisions](https://www.nngroup.com/articles/compensatory-noncompensatory-decisions/)):
dealbreakers are handled by **filters** (eliminate); trade-offs need
**weighing** (a strength offsets a weakness). Filter first, then weigh. Show
pros *and* cons so the user can see why something ranks where it does.

## Goals

1. Rank **towns** by the user's weights.
2. Rank **homes** by the same weights, plus home-level factors.
3. Every ranked item explains itself: a short "why" (what helps, what hurts).
4. Presets so the user never starts from blank sliders.
5. The homes page remembers the last filters, sort and weights between visits.
6. Look-up material has one clear home (the towns page).

## Non-goals

- Compare view (up to 5 saved homes side by side). Agreed as "later".
- No new scraping fields. Use what's stored, except train frequency (below).
- No change to the existing filters' behaviour. They stay as dealbreakers.

## Anti-goals (a failure even if it works)

- Homes with sparse listings rank low just because data is missing.
- Scores that jump around when a filter changes (the same home must keep the
  same score whatever else is on screen).
- A score with no explanation: a number the user can't argue with.
- Losing information the page shows today. The user explicitly values it.

## Structure (agreed)

| Route | Nav label | Contents |
|---|---|---|
| `/buying/towns` (new) | Towns | Pick tiles; weights panel; towns ranked by score with "why"; the map (`WhereToBuy`); per-town research notes and gaps (today's "to do" list and `TownPanel` content). Clicking a town opens `/buying?town=<id>`. |
| `/buying` | Homes for sale | The working list: existing toolbar and filters, new **Recommended** sort (default), same weights panel (collapsible), "why" line on each card. Town-level sections move to Towns; see the table below. |

### Nothing is lost: where each piece of today's page goes

The user asked for this explicitly. Every section of today's /buying keeps a
home; nothing is deleted. Town-level things live on Towns, home-level things on
Homes, and anything that bridges the two is reachable from both.

| Today on /buying | Goes to | Notes |
|---|---|---|
| Header line ("N homes for sale, £200k–£500k, near N of 17 stations") | Both | Towns: "17 towns, N with homes". Homes: unchanged. |
| Pick tiles: Quickest train, Cheapest house, Most houses | Towns (top) | Still one click to the filtered homes list. |
| "Price against train time" map | Towns | Unchanged; clicking a town selects it on Towns (shows its panel), with a "See its N homes" link. |
| Town ranking table (train, homes, typical, houses, typical house) | Towns | Kept, with a new **Score** column and why line; the existing columns stay sortable. |
| Empty towns line ("no homes yet: …") | Towns | Unchanged. |
| Town research panel (`TownPanel`: searched, gap, policy, leads) | **Both** | Towns: when a town is selected. Homes: when filtered to one town, as today, so context is next to the list. |
| Research to-do list ("Decide: …", next actions) | Towns (bottom) | Unchanged. |
| Toolbar: search, sort, filters, toggles | Homes | Unchanged; sort gains **Recommended**. |
| Count line, Clear filters, brief note | Homes | Unchanged. |
| Home cards, "Show N more" | Homes | Cards gain a why line and score. |
| Load error, loading skeleton, empty state | Both | Empty state on Homes points to the Towns research panel instead of "above". |

On Homes, a one-line link sits above the toolbar: "Not sure which town?
See the town ranking →".

`lib/nav.ts`: Buying project pages become `[{ /buying/towns, "Towns" }, { /buying, "Homes for sale" }]`.
Towns comes first because it's the starting point.

## Weights

One shared set of weights (0–3 each: off, a little, matters, a lot), used by
both pages, stored in `localStorage` (`buying.weights`). The Homes page also
stores its filters and sort (`buying.view`). *My call: localStorage, not the
database, because it's one person on one device and Save/Hide already cover
what needs to persist across devices.*

### Criteria

Each is scored 0–1 on a **fixed scale taken from the brief**, not relative to
what's on screen, so a filter never changes a score.

| Criterion | Level | Scale (1 = best) | Data coverage |
|---|---|---|---|
| Train time | town | 15 min → 1, 45 min → 0 | 17/17 (approx., `stations.ts`) |
| Train frequency | town | peak trains/hour into London: 12+ → 1, 2 → 0 | **to add**: 17 values |
| Price | home | £200k → 1, £500k → 0 | 100% |
| Price per bedroom | home | £80k → 1, £230k → 0 | 100% |
| Walk to station | home | ≤0.25 mi → 1, 1 mi → 0 | 100% |
| House over flat | home | house 1, maisonette 0.6, flat 0.3, new-build block 0 | 100% (`homeKind`, `isNewBuildBlock`) |
| Garden | home | yes 1, no 0 | 30% |
| Floor area | home | 900 sq ft → 1, 500 → 0 | 20% |
| Ownership costs | home | freehold 1; else lease ≥125y and service charge ≤£1k → 1, sliding to lease 90y / £2.5k → 0 | ~35% |
| Bedrooms | home | 3 → 1, 2 → 0 | 100% |
| Bathrooms | home | 2+ → 1, 1 → 0 | 98% |

**Unknowns score 0.5 (neutral)** and appear in the "why" as "garden unknown".
Each criterion's weight panel row shows its coverage ("known for 30%").

**Town score** = weighted mean of town criteria, plus the **median** of each
home-level criterion across that town's live homes (so "price" means typical
price there). A town with fewer than 5 live homes is shown but marked "too few
homes to judge". **Home score** = weighted mean over all criteria with weight
greater than 0, using the home's town for town-level criteria. Shown as 0–100.

### Presets (my call, from the user's situation)

| Preset | Weights a lot (3) | Matters (2) | A little (1) |
|---|---|---|---|
| Balanced (default) | — | train time, price, house, walk | frequency, price/bed, garden, beds |
| Easy commute | train time, frequency | walk | price |
| Most home for the money | price per bedroom | house, garden, floor area | price |
| Cheapest to own | ownership costs, price | house over flat | — |
| Room to grow | bedrooms, house | garden, bathrooms | floor area |

Picking a preset sets the sliders; touching a slider shows "Custom". "Best
deals" was considered and dropped: it's a filter ("Reduced"), not a trade-off.

### The "why" line

Top two contributors and the worst one, in words, for example:
"Fast train (20 min) · cheap for 3 beds · but 0.9 mi walk". Unknowns with
weight ≥ 2 are listed: "garden unknown". On Towns the same, with medians.

## Train frequency data

Add `peakPerHour` to each entry in `lib/homes/stations.ts`: weekday 07:00–09:00
trains per hour to the London terminus already listed there, from the
operators' published timetables. Note the source in a comment, and mark values
as approximate like the train times.

## Code layout (builder's call within this)

- `lib/homes/score.ts` (new, pure): `CRITERIA`, `PRESETS`, `scoreHome`,
  `scoreTown`, `why`. Unit-tested in `__tests__/lib/homes.test.ts`: fixed-scale
  stability, unknown = neutral, preset values, why-line wording.
- `components/homes/WeightsPanel.tsx` (new): presets as a segmented control,
  sliders as 4-step selects (pill style, like the toolbar), coverage per row.
- `app/buying/towns/page.tsx` (new). It reuses `/api/homes` (now 0.6 s).
- `app/buying/page.tsx`: add the Recommended sort, persistence, read
  `?town=`, and remove the map and research sections (moved).
- Design system: Throughline tokens only (`globals.css`); no new colours.

## Left to the builder

Exact copy, layout of the weights panel, mobile behaviour (panel collapses to
a "Weights: Balanced" button), whether Towns shows a small score bar.

## Done when

Both pages render with real data; changing a preset reorders both; each card
and town shows a why line; reload keeps settings; `npx jest` and `tsc` pass;
checked in the browser at desktop and mobile widths.
