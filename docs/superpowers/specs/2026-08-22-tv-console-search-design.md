# TV console search — design

**Date:** 2026-08-22
**Status:** approved, ready for planning
**Precedent:** the ottoman-bed search (`lib/beds/*`, `app/beds`, `scripts/beds-import.ts`)

## 1. Goal

Find a floor-standing TV console that physically accommodates a specific,
already-owned stack of kit, and rank the candidates the way `/beds` ranks
ottoman beds: research corpus → CSV → MongoDB → a decision workspace with
live scoring, filters and want/reject preferences.

Unlike the bed search, the binding constraint is not a single derived
boolean ("does a suitcase clear the cavity"). It is a **three-body geometry
problem**, and most of the market fails at least one of its gates.

## 2. The kit — measured, not assumed

Every requirement below is derived from these figures. They are recorded
here so the scoring model can be re-audited without re-researching.

| Item | Figure | Source |
|---|---|---|
| LG OLED55B56LA, with stand | 1228 × 772 × 235 mm (W×H×D) | LG UK product spec |
| LG OLED55B56LA, panel only | 1228 × 708 × 45.9 mm | LG UK product spec |
| Stand span (foot/base width) | ~1057 mm (41.6 in) | LG US spec sheet |
| TV weight with stand | ~14.5 kg (32.0 lb) | LG US spec sheet |
| LG S80TR soundbar, main unit | 998 × 63.5 × 134.6 mm (W×H×D) | LG / retailer specs |
| PS5 Slim (disc), lying flat | 358 × 96 × 216 mm (W×H×D) | Sony spec |

### 2.1 The clearance finding

Screen-bottom clearance above the tabletop is **not published**. It is
derived: `772 − 708 = 64 mm`.

The S80TR is **63.5 mm** tall. The margin is therefore ~0.5 mm — effectively
nil. Placing the bar in front of the TV is a flush fit that will graze the
bottom bezel and may shave the lowest row of picture.

**This is a derived figure and must be physically verified before purchase.**
It is recorded as a caveat in the UI, not as a scored criterion, because it
is a property of the TV and the bar — not of any console.

Mitigating context: the LG Magic Remote is Bluetooth, so a bar sitting in
the IR path does not break remote control the way it would on an older set.

The user's decision (2026-08-22) was to **keep the bar in front and filter
on top depth** rather than relocate it to a shelf.

## 3. Derived requirements

| # | Requirement | Value | Rationale |
|---|---|---|---|
| R1 | Top surface width | ≥ **1060 mm** hard; ≥ 1228 mm preferred | The stand span must land on the surface; below the TV's own width it looks wrong |
| R2 | Top surface depth | ≥ **370 mm** hard; ≥ 400 mm comfortable | TV base 235 mm + soundbar 135 mm, one behind the other, before any cable gap |
| R3 | Open bay, internal | ≥ **400 × 250 × 110 mm** (W×D×H) | PS5 Slim 358 × 216 × 96 mm plus airflow, rear cable run and horizontal feet |
| R4 | Top load rating | ≥ **25 kg** | TV ~14.5 kg + bar ~3.5 kg ≈ 19 kg, plus headroom |
| R5 | Ventilation | Open or ported back | A PS5 **and** an ethernet switch live inside; a sealed back cooks both |
| R6 | Closed storage | Real drawer/cupboard volume | Games, discs and controllers |
| R7 | Overall width | 1500–1800 mm | User's wall allowance |
| R8 | Mounting | Floor-standing only | User decision; no wall-load questions |
| R9 | Landed cost | ≤ **£500** | Item + delivery + assembly, per the `/beds` convention |

Books were raised and explicitly deferred — the user may buy a separate
bookshelf. Book storage is **not** a criterion.

## 4. Non-goals

- Wall-mounted or floating units.
- Housing the S80TR subwoofer (406 mm tall) or rear satellites — those are
  floor/shelf items and sit outside the console.
- Relocating the soundbar to an internal shelf. Scored fit is "bar on top,
  behind-the-TV depth", per §2.1.
- Any change to `/beds` behaviour beyond the finance module move in §8.

## 5. Data model

A new `Console` model mirroring `Bed`, plus `ConsolePref` mirroring
`BedPref` exactly (want/reject, cascade delete).

### 5.1 The `bays` column

A bed has no compartments; a console has *N* of differing sizes. Modelling
that as flat scalars would need ~15 more columns and walk straight back into
the Atlas 50-stage aggregation-pipeline limit that `lib/beds/store.ts`
already documents.

So compartments are **one JSON column**:

```ts
interface Bay {
  kind: "open" | "door" | "glass-door" | "drawer";
  count: number;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
}
```

`bays: string` (JSON), parsed/serialised at the store boundary exactly as
`extra` and `finance` already are. Largest-open-bay and closed-storage
volume are **derived in code**, never persisted.

### 5.2 Promoted scalars

Top surface: `topWidthCm`, `topDepthCm`, `topLoadKg`.
Overall: `overallWidthCm`, `overallDepthCm`, `overallHeightCm`.
Build: `frameMaterial`, `finishMaterial`, `backPanel` (`open` | `ported` |
`solid` | null), `cableManagement`, `legStyle`, `colourwayShown`, `colourwaysAvailable`.
Commerce, service and evidence fields carry over from `Bed` unchanged:
landed-cost trio, `arrivesAssembled`, warranty, returns, lead time, reviews,
`finance`, `notes`, `extra`.

## 6. The fit engine — `lib/consoles/fit.ts`

The heart of the feature, and the piece with no bed equivalent.

```ts
type Verdict = "pass" | "fail" | "unknown";

interface Fit {
  tv: Verdict;      // R1 + top depth ≥ 235 mm
  soundbar: Verdict; // R2
  ps5: Verdict;      // R3, against the largest open bay
  overall: Verdict;  // fail if any fail; unknown if any unknown; else pass
  notes: string[];   // human-readable, e.g. "38cm deep — 1cm short for the bar"
}
```

**Tri-state is load-bearing.** Retailers publish external dimensions and
almost never publish internal bay dimensions. A binary pass/fail would
delete most of the corpus on absent evidence, which is precisely the failure
mode `lib/beds/score.ts` was written to avoid: *a missing spec must never be
scored as a bad spec*.

Default filter: **hide confirmed failures, keep unknowns visible and
flagged.** The user can switch to "confirmed fits only" or "show everything".

## 7. Scoring — `lib/consoles/score.ts`

Same machinery as beds: per-criterion `evaluate` returning `number | null`,
nulls excluded from the average rather than zeroed, `rawScore` +
`confidence`, and Bayesian shrinkage toward the corpus median with the same
`SHRINKAGE_K = 25`.

| Criterion | Weight | Note |
|---|---|---|
| PS5 bay fit | 18 | Graduated: comfortable > tight > fail |
| Top depth | 16 | ≥400 mm full marks, 370–400 partial, <370 fails R2 |
| Frame/carcass material | 12 | Solid & ply over MDF over chipboard, as in beds |
| Landed value | 12 | Saturating against the £500 cap |
| Ventilation & cable routing | 8 | Open/ported back, grommets, cut-outs |
| Load rating | 8 | Against the ~19 kg real load |
| Width & proportion | 8 | Against the 1228 mm TV, within the 1500–1800 mm allowance |
| Closed storage | 8 | Drawer/cupboard volume for games and discs |
| Assembly service | 6 | Carried over from beds |
| Warranty & returns | 4 | |

Total 100. Ventilation earns real weight because a PS5 *and* a switch share
the enclosure.

## 8. Finance — shared, not copied

`lib/beds/finance.ts` is retailer-level policy logic containing nothing
bed-specific but its type signature. It is promoted to
**`lib/retail/finance.ts`**, generic over `{ landedCostGbp, finance }`, with
`lib/beds/finance.ts` reduced to a re-export so `/beds` is behaviourally
untouched. Finance stays **out of the recommendation score** for the same
reason as beds: it changes how you pay, not how good the console is.

## 9. Research corpus

`~/Documents/console-search/tv-consoles.csv`, mirroring the bed CSV's
convention: one row per model, promoted columns plus a long tail preserved
verbatim into `extra`.

Retailer targets: IKEA, Argos/Habitat, John Lewis, Wayfair, Dunelm, Next,
Furniture Village, Oak Furnitureland, Very, B&Q, Cult Furniture,
La Redoute, Barker & Stonehouse, Costco.

Retailer-level finance policy is researched once per retailer into
`rows/finance.jsonl`, exactly as the bed import consumes it.

**Known-hard problem:** internal bay dimensions. Bed retailers advertised
storage depth because it sells the bed; nobody sells a TV unit on "fits a
PS5". Expect heavier reliance on assembly-manual PDFs (IKEA publishes
these), dimension diagrams and customer Q&A, and expect materially lower
confidence scores than the bed corpus.

## 10. Surface area

- `scripts/consoles-import.ts` — CSV → MongoDB, idempotent, preserves prefs,
  drops stale rows. Direct port of `beds-import.ts`.
- `GET /api/consoles`, `POST|DELETE /api/consoles/pref`.
- `app/consoles/page.tsx` — filter rail, card grid, detail drawer,
  URL-encoded view state, saved-only toggle. Sorts: recommended, best
  measured, cheapest, deepest top, biggest PS5 bay, best reviewed, best
  finance.
- `components/consoles/{ConsoleCard,ConsoleDetail,ConsoleFilterRail,FitDiagram}.tsx`
- Sidebar entry: `{ href: "/consoles", label: "TV unit", icon: "📺" }`.

### 10.1 FitDiagram

A small to-scale inline SVG in the detail drawer: the top surface in
cross-section with the TV base and soundbar drawn on it, and the target bay
with a PS5 in it. Makes "37 cm isn't enough" legible at a glance in a way a
spec row is not. Renders partial state when dimensions are unknown.

## 11. Risks

1. **Sparse internal dimensions** (§9) — mitigated by tri-state fit and the
   shrinkage model; monitored via corpus-wide confidence.
2. **The 64 mm clearance is derived, not published** (§2.1) — surfaced as a
   standing caveat; needs physical verification before purchase.
3. **Depth thins the market.** Many 55"-marketed consoles are 350–400 mm
   deep. If the R2-passing corpus is too small, the fallback is to relax to
   ≥370 mm and rank on the remainder — not to silently drop R2.

## 12. Success criteria

- A populated corpus where every row's fit verdict is computed, not asserted.
- Default view shows only consoles that take the TV, the bar in front, and a
  horizontal PS5 — with unknowns visible and labelled rather than hidden.
- `/beds` is unchanged in behaviour after the finance move.
