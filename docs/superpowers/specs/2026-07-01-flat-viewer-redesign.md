# Flat viewer redesign — Summary / Homes / Operators

Date: 2026-07-01
Status: approved (user delegated remaining detail: "use your best judgement and get to work")

## Problem
`flat-search/flats.html` opens on a wall of 10 tabs + 4 dropdowns + 3 checkboxes and a
flat list, burying the meaningful signal. The user wants: (1) a low-noise landing that shows
the best-fit flats first, (2) a dedicated BTR operators/developers directory (filter by area,
links to their sites), (3) criteria-first defaults with progressive filters, and (4) a calmer,
responsive filter UX instead of tabs+checkboxes.

## Constraints (must preserve)
- Single self-contained `flats.html`. The `/beaufort-flats` skill regenerates it by swapping only
  the `/*DATA_START*/…/*DATA_END*/` block (and the `/*LOGIC_START*/…/*LOGIC_END*/` block iff
  `viewer-logic.mjs` changed). The redesign lives entirely in the HTML/CSS/JS **outside** those
  two marker blocks, so regen preserves it.
- `viewer-logic.mjs` is unchanged → the inlined LOGIC block stays byte-identical (verify test #13).
- Want/reject layer stays: `localStorage` key `flatPrefs.v1`, keyed by stable listing `id`.
- All views read from `window.FLAT_DATA`. No new fields added to the store.
- `node --test scripts/verify-flat-search.mjs` must pass (13 tests).

## Architecture — single file, hash router
Top nav shell + a router that renders one view into a single `#view` container based on
`location.hash`: `#/summary` (default), `#/homes`, `#/operators`. Nav highlights the active
route; back/forward + bookmarks work. The move-timing banner is part of the **shell** (always
visible, above the view).

## View 1 — Summary (`#/summary`, default landing)
- Stat strip: in-budget count · BTR-in-budget · well-timed · new this run.
- **Best-timed pick**: highest-ranked `ideal`/`workable` in-budget active flat. If none well-timed
  (current reality), show an honest note + the closest flat instead (never imply zero options).
- **Top picks**: in-budget active flats sorted by existing order (wanted → well-timed → BTR →
  newest phaseYear → cheapest), capped at 6; ✓-wanted flats pin to the top. Each links into Homes.
- **New this run**: the `isNew` flats as compact one-liners.
- CTAs: “See all homes” → `#/homes`; “Browse operators” → `#/operators`.

## View 2 — Homes (`#/homes`)
- Responsive filter surface: sticky **left rail** on desktop (≥820px), collapsing to a top
  **“Filters” drawer** on mobile. One consistent surface; the 10 area tabs are removed.
- Defaults on open: show `in` + `btr` budget tiers (over-budget hidden), well-timed-first sort on,
  gone hidden. So the good stuff shows first.
- Rail controls: search (building/street/agent); Budget (include over-budget toggle); Scheme
  (all / BTR / private); Timing (well-timed-first toggle + timing filter); Area (multi-check, all
  by default); New-only toggle; Show-gone toggle. Active state reflected; a mobile chip line
  summarises what’s applied.
- Main: stat strip (showing / well-timed / new / BTR) + responsive card grid reusing the existing
  `card()` renderer (image, badges, timing chip, scheme, over/BTR-band, sources, ✓/✗).
- Sort: `comparePref` with the timing context (wanted first, then well-timed, tier, scheme,
  phase, price).
- **Top picks integration:** a “⭐ Top picks only” rail toggle narrows the grid to the curated
  shortlist (`topPickIdSet()` — same set the Summary shows). Summary pick rows deep-link to
  `#/homes?pick=<id>`, which scrolls the matching card into view and flashes it (`.card-hl`).

## View 3 — Operators (`#/operators`)
- Operator registry derived at render time by merging: (a) every `area.btrOperators` entry with its
  area membership (so newly-added operators with no live listing still appear), and (b) listings’
  `operator`/`scheme`/`area`/`price`/`building`.
- Per-operator card: name + BTR badge; areas covered (chips); website/portal link(s) ↗ (from a
  curated `OPERATOR_SITES` map in the viewer JS, plus any `platform:"operator"` source URLs and the
  area `operatorPortals` as fallback); stats — buildings tracked, listings in-budget, 1-bed band
  (£min–£max from their listings, or “—” when none live yet); a “start dates negotiable” note for BTR.
- Top area-filter chips (All + each area) filter the grid. Sorted by in-budget count desc, then name.

## Non-goals (YAGNI)
- No map view (the store has no coordinates; the Next.js app owns the map).
- No new store fields; `OPERATOR_SITES` is presentation-only metadata in the viewer.
- No separate HTML files; no server.

## Testing
- Existing verify suite must stay green (DATA valid + 9 areas; LOGIC byte-identical).
- Manual: the three routes render; defaults show in-budget+well-timed; want/reject persists across
  route switches and regen; operator links open.
