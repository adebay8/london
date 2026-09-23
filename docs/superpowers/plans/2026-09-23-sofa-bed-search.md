# Sofa Bed Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a sofa bed search vertical — corpus, ranking and workspace page — that finds a 3-seat sofa bed sitting like the Raft Loft and opening to at least a small double, for £1,200 landed.

**Architecture:** An exact mirror of the existing sofa vertical (`lib/sofas/*`, `app/sofas/`, `components/sofas/`, `scripts/sofas-import.ts`). A `SofaBed` Prisma model, four pure library modules (`types`, `fit`, `score`, `store`), a CSV import script fed by five parallel research agents, two API routes, one page, three components, and the three-place navigation change. Every dimension is tri-state — pass / fail / **unknown**, where unknown means the retailer did not publish it and never that the item is unsuitable.

**Tech Stack:** Next.js 16 App Router (Server Components), TypeScript, Prisma + MongoDB Atlas, Jest (`next/jest`), Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-23-sofa-bed-search-design.md`

## Global Constraints

- **Budget cap:** £1,200 landed (item + delivery). Over-budget rows are kept and flagged, never dropped.
- **Gates (spec §2):** seats ≥ 3 · folded width 200–250cm, **both ends** · bed width ≥ 120cm.
- **Scored, never gated:** sitting comfort, depth, seat depth, leg rest, mattress quality, bedding storage, style match.
- **A missing spec is never a bad spec.** Criteria return `null` with no evidence; `null` is excluded from the average rather than counted as zero; the score is shrunk toward the corpus median by how little evidence backs it. `SHRINKAGE_K = 25`.
- **Condition is out of the score.** `new` | `ex-display` | `clearance` | `second-hand` is a filter and a badge only.
- **Sanity bounds (spec §8), all treated as `unknown`, never as a good value:** body depth > 130cm is an L-shape footprint · seat depth > 90cm is a chaise length · **bed width > 185cm is a bed length** · bed length outside 170–230cm is not a length.
- **Never guess a dimension.** Empty CSV cell = unpublished.
- **`npx jest` is the test runner.** There is no `npm test` script in `package.json`; do not add one.
- Naming, fixed: model `SofaBed` / `SofaBedPref`, lib `lib/sofabeds/`, components `components/sofabeds/`, route `/sofa-beds`, API `/api/sofa-beds`, corpus `docs/sofa-bed-search/`, import `scripts/sofabeds-import.ts`.

## Ordering note

**Task 8 (research) shares no state with Tasks 1–7.** Its five agents take a long time and only write CSVs into `docs/sofa-bed-search/`. Dispatch them at the *start* of Task 1 and collect them at Task 8. Tasks 1–7 build the machine that reads those files.

---

### Task 1: Domain types and fit gates

**Files:**
- Create: `lib/sofabeds/types.ts`
- Create: `lib/sofabeds/fit.ts`
- Test: `__tests__/lib/sofabed-fit.test.ts`

**Interfaces:**
- Consumes: `FinancePolicy`, `NO_FINANCE` from `@/lib/retail/finance` (existing).
- Produces: `SofaBed`, `Mechanism`, `LegRest`, `MattressType`, `Condition`, `Filling`, `ChaiseSide`, `Pref`, all the `*_CM` / `*_GBP` constants; `bodyDepthOf`, `seatDepthOf`, `bedWidthOf`, `bedLengthOf`, `hasSuspectDepth`, `hasSuspectBedSize`, `fitFor`, `fitLabel`, `Fit`, `Verdict`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/sofabed-fit.test.ts`:

```ts
import {
  bedLengthOf, bedWidthOf, bodyDepthOf, fitFor, fitLabel,
  hasSuspectBedSize, seatDepthOf,
} from "@/lib/sofabeds/fit";
import { NO_FINANCE, type SofaBed } from "@/lib/sofabeds/types";

const base: SofaBed = {
  id: "x", retailer: "R", brand: "B", model: "M", productUrl: "u",
  imageUrl: null, colourwayShown: null,
  priceGbp: 900, rrpGbp: null, deliveryCostGbp: null, deliveryIncluded: true,
  landedCostGbp: 900, overBudget: false,
  condition: "new", inStock: true, oneOff: false,
  seats: 3, seatCushions: 2,
  mechanism: "fold-out", separateMattress: true,
  bedWidthCm: 140, bedLengthCm: 190,
  mattressType: "sprung", mattressThicknessCm: 14, beddingStorage: false,
  legRest: "none", chaiseSide: null, modular: null,
  overallWidthCm: 220, overallDepthCm: 105, overallHeightCm: 85,
  extendedDepthCm: 200, seatDepthCm: null, seatHeightCm: null,
  armStyle: null, fabric: null, easyClean: null, removableCovers: null,
  seatFilling: null, frameMaterial: null,
  warranty: null, returnsWindow: null, deliveryLeadTime: null,
  reviewScore: null, reviewCount: null,
  finance: { ...NO_FINANCE }, notes: null, extra: {}, pref: null,
};

const s = (over: Partial<SofaBed> = {}): SofaBed => ({ ...base, ...over });

describe("bedWidthOf — the 185cm bound exists to catch a bed length", () => {
  it("reads a real bed width", () => {
    expect(bedWidthOf(s({ bedWidthCm: 140 }))).toBe(140);
    expect(bedWidthOf(s({ bedWidthCm: 180 }))).toBe(180);
  });

  it("rejects 190 — that is the standard UK bed LENGTH in the width column", () => {
    // The whole reason the bound is 185 and not 200.
    expect(bedWidthOf(s({ bedWidthCm: 190 }))).toBeNull();
    expect(hasSuspectBedSize(s({ bedWidthCm: 190 }))).toBe(true);
  });

  it("returns null when unpublished, without flagging it as suspect", () => {
    expect(bedWidthOf(s({ bedWidthCm: null }))).toBeNull();
    expect(hasSuspectBedSize(s({ bedWidthCm: null, bedLengthCm: null }))).toBe(false);
  });
});

describe("bedLengthOf — under 170 is a width filed wrongly", () => {
  it("reads a real bed length", () => {
    expect(bedLengthOf(s({ bedLengthCm: 190 }))).toBe(190);
  });

  it("rejects a width in the length column", () => {
    expect(bedLengthOf(s({ bedLengthCm: 140 }))).toBeNull();
    expect(hasSuspectBedSize(s({ bedLengthCm: 140 }))).toBe(true);
  });

  it("rejects an implausibly long bed", () => {
    expect(bedLengthOf(s({ bedLengthCm: 260 }))).toBeNull();
  });
});

describe("depth guards carry over from the sofa corpus", () => {
  it("discards an L-shape footprint sitting in the depth column", () => {
    expect(bodyDepthOf(s({ overallDepthCm: 112 }))).toBe(112);
    expect(bodyDepthOf(s({ overallDepthCm: 165 }))).toBeNull();
  });

  it("discards a chaise length sitting in the seat depth column", () => {
    expect(seatDepthOf(s({ seatDepthCm: 62 }))).toBe(62);
    expect(seatDepthOf(s({ seatDepthCm: 140 }))).toBeNull();
  });
});

describe("fitFor — R1 seats, R2 width band, R3 bed width", () => {
  it("passes a sofa bed that meets all three", () => {
    const f = fitFor(s());
    expect(f.seats).toBe("pass");
    expect(f.width).toBe("pass");
    expect(f.bed).toBe("pass");
    expect(f.overall).toBe("pass");
  });

  it("fails a 2-seater — capacity is gated at 3", () => {
    const f = fitFor(s({ seats: 2 }));
    expect(f.seats).toBe("fail");
    expect(f.overall).toBe("fail");
  });

  it("fails a sofa that is too NARROW — the floor is the point of this search", () => {
    // 190cm is a compact 2-seater wearing a 3-seat label. The sofa search had
    // no floor and this is the gate that was added for it.
    const f = fitFor(s({ overallWidthCm: 190 }));
    expect(f.width).toBe("fail");
    expect(f.notes.join(" ")).toMatch(/narrow|small/i);
  });

  it("fails a sofa that is too wide", () => {
    expect(fitFor(s({ overallWidthCm: 265 })).width).toBe("fail");
  });

  it("fails a bed under the small-double floor", () => {
    expect(fitFor(s({ bedWidthCm: 110 })).bed).toBe("fail");
  });

  it("is unknown, not failed, when a measurement is unpublished", () => {
    expect(fitFor(s({ overallWidthCm: null })).width).toBe("unknown");
    expect(fitFor(s({ seats: null })).seats).toBe("unknown");
    expect(fitFor(s({ bedWidthCm: null })).bed).toBe("unknown");
    expect(fitFor(s({ seats: null })).overall).toBe("unknown");
  });

  it("treats a suspect bed width as unknown rather than as a pass", () => {
    // 190 in the width column must not be read as a generous double.
    expect(fitFor(s({ bedWidthCm: 190 })).bed).toBe("unknown");
  });

  it("records the mechanism route and whether you sleep apart from the seat", () => {
    const f = fitFor(s({ mechanism: "fold-out", separateMattress: true }));
    expect(f.mechanismRoute).toBe("fold-out");
    expect(f.sleepsApart).toBe(true);

    const c = fitFor(s({ mechanism: "click-clack", separateMattress: false }));
    expect(c.sleepsApart).toBe(false);
    expect(c.overall).toBe("pass"); // scored, never gated
  });

  it("leaves sleepsApart null when the listing does not make it clear", () => {
    expect(fitFor(s({ mechanism: null, separateMattress: null })).sleepsApart).toBeNull();
  });
});

describe("fitLabel", () => {
  it("names the route when it passes", () => {
    expect(fitLabel(fitFor(s()))).toMatch(/3 seats/);
  });

  it("lists what failed", () => {
    expect(fitLabel(fitFor(s({ seats: 1, bedWidthCm: 90 })))).toMatch(/Doesn't meet/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest sofabed-fit`
Expected: FAIL — `Cannot find module '@/lib/sofabeds/fit'`.

- [ ] **Step 3: Write `lib/sofabeds/types.ts`**

```ts
// Shared types for the sofa bed search. Mirrors the `SofaBed` Prisma model.
//
// This is the sofa search's brief with a bed bolted on, not a different brief:
// the buyer ends up with a sofa OR a sofa bed, never both. So the Raft Loft is
// still the reference and depth still matters — see the spec, §1.
import type { FinancePolicy } from "@/lib/retail/finance";

export type Pref = "want" | "reject";

/** Out of the recommendation score on purpose — it changes what you are
 *  buying and what protection comes with it, not how good the sofa bed is. */
export type Condition = "new" | "ex-display" | "clearance" | "second-hand";

/** How the bed comes out. Recorded per row; all three routes are in scope.
 *  `fold-out` and `pull-out` hide a separate mattress in the frame;
 *  `click-clack` and `futon` make you sleep on the seat itself. */
export type Mechanism = "fold-out" | "pull-out" | "click-clack" | "futon";

/** The sofa search's vocabulary plus `storage-chaise` — a chaise that lifts
 *  to swallow the bedding, which satisfies leg rest, bed and storage at once. */
export type LegRest = "chaise" | "storage-chaise" | "footstool" | "both" | "none";

export type ChaiseSide = "left" | "right" | "reversible";

export type MattressType = "pocket-sprung" | "sprung" | "memory" | "foam" | "fibre";

export type Filling = "feather" | "feather-blend" | "foam" | "fibre" | "mixed";

// --- The reference: Raft Loft Modular, unchanged from the sofa search -----
export const TARGET_DEPTH_CM = 112;
/** Below this you sit upright with your feet on the floor. Scored hard,
 *  never gated — gating would empty the corpus at this budget. */
export const MIN_USEFUL_DEPTH_CM = 100;

// --- Requirements (spec §2) ----------------------------------------------
/** R1: three people, not three cushions. */
export const MIN_SEATS = 3;
/** R2, floor. The gate this search added: "two seats" in the sofa search
 *  always meant two CUSHIONS, and read as capacity it let in exactly the
 *  compact models with the worst mechanisms. */
export const MIN_WIDTH_CM = 200;
/** R2, ceiling. The wall allowance, unchanged from the sofa search. */
export const MAX_WIDTH_CM = 250;
/** R3: a small double. */
export const MIN_BED_WIDTH_CM = 120;
/** A full UK double — scored above the floor, not gated. */
export const FULL_DOUBLE_WIDTH_CM = 135;
/** R4: landed = item + delivery. */
export const BUDGET_CAP_GBP = 1200;

// --- Sanity bounds (spec §8) ---------------------------------------------
//
// Retailers file the right number in the wrong column, and an unguarded
// figure ranks the corpus backwards. Every bound below yields UNKNOWN, which
// is not the same as a failure.

/** Above this, an "overall depth" is an L-shape footprint, not a body depth. */
export const MAX_PLAUSIBLE_BODY_DEPTH_CM = 130;
/** Above this, a "seat depth" is a chaise length. */
export const MAX_PLAUSIBLE_SEAT_DEPTH_CM = 90;
/** Above this, a "bed width" is a bed LENGTH.
 *
 *  This bound is 185 and not 200 for one specific reason: a super king is
 *  180cm wide, and the number most often filed wrongly in this column is
 *  190 — the standard UK bed length. A 200cm bound waves it through as a
 *  magnificent bed and floats the row to the top of the ranking. */
export const MAX_PLAUSIBLE_BED_WIDTH_CM = 185;
/** Below this, a "bed length" is a bed width. */
export const MIN_PLAUSIBLE_BED_LENGTH_CM = 170;
export const MAX_PLAUSIBLE_BED_LENGTH_CM = 230;

/** Seat depth that supports the thigh of someone around 5'11". */
export const GOOD_SEAT_DEPTH_CM = 60;
export const LOUNGE_SEAT_DEPTH_CM = 75;

/** Under this the mattress is a token gesture; at or above REAL it is a
 *  mattress you could sleep on repeatedly. */
export const TOKEN_MATTRESS_CM = 10;
export const REAL_MATTRESS_CM = 14;

export interface SofaBed {
  id: string;
  retailer: string;
  brand: string;
  model: string;
  productUrl: string;
  imageUrl: string | null;
  colourwayShown: string | null;

  priceGbp: number;
  rrpGbp: number | null;
  deliveryCostGbp: number | null;
  deliveryIncluded: boolean;
  landedCostGbp: number;
  overBudget: boolean;

  condition: Condition;
  /** Null when no availability is published. False means the listing says
   *  sold out — a hard exclusion from recommendation, not a penalty. */
  inStock: boolean | null;
  oneOff: boolean;

  /** People it seats. R1 gates on this. */
  seats: number | null;
  /** Seat cushions across that width. Two across 200cm+ is the Raft Loft
   *  look — a style attribute (spec §6), never a gate. */
  seatCushions: number | null;

  mechanism: Mechanism | null;
  /** THE field. Is the thing you sleep on a different object from the thing
   *  you sit on? Null when the listing does not make it unambiguous —
   *  inferring it from a marketing name would corrupt the score's main axis. */
  separateMattress: boolean | null;

  bedWidthCm: number | null;
  bedLengthCm: number | null;
  mattressType: MattressType | null;
  mattressThicknessCm: number | null;
  beddingStorage: boolean | null;

  legRest: LegRest | null;
  chaiseSide: ChaiseSide | null;
  modular: boolean | null;

  overallWidthCm: number | null;
  overallDepthCm: number | null;
  overallHeightCm: number | null;
  /** How far it reaches into the room when open. Recorded on every row and
   *  gated on nothing — the buyer is still flat-hunting and does not know the
   *  floor clearance yet. It becomes a filter the day they do. */
  extendedDepthCm: number | null;
  seatDepthCm: number | null;
  seatHeightCm: number | null;

  armStyle: string | null;
  fabric: string | null;
  easyClean: boolean | null;
  removableCovers: boolean | null;
  seatFilling: Filling | null;
  frameMaterial: string | null;

  warranty: string | null;
  returnsWindow: string | null;
  deliveryLeadTime: string | null;
  reviewScore: number | null;
  reviewCount: number | null;

  finance: FinancePolicy;

  notes: string | null;
  extra: Record<string, string>;

  pref: Pref | null;
}

export type { FinancePolicy, FinanceTier, FinanceType } from "@/lib/retail/finance";
export { NO_FINANCE } from "@/lib/retail/finance";
```

- [ ] **Step 4: Write `lib/sofabeds/fit.ts`**

```ts
// Does this sofa bed meet the brief: seats three, fits the 200-250cm band,
// and makes at least a small double?
//
// Same tri-state discipline as lib/sofas/fit.ts — pass / fail / unknown, where
// unknown means the retailer did not publish the measurement, never that the
// sofa bed is unsuitable.
import {
  MAX_PLAUSIBLE_BED_LENGTH_CM,
  MAX_PLAUSIBLE_BED_WIDTH_CM,
  MAX_PLAUSIBLE_BODY_DEPTH_CM,
  MAX_PLAUSIBLE_SEAT_DEPTH_CM,
  MAX_WIDTH_CM,
  MIN_BED_WIDTH_CM,
  MIN_PLAUSIBLE_BED_LENGTH_CM,
  MIN_SEATS,
  MIN_WIDTH_CM,
  type Mechanism,
  type SofaBed,
} from "./types";

/** Body depth, or null when the figure is really an L-shape footprint. */
export function bodyDepthOf(s: Pick<SofaBed, "overallDepthCm">): number | null {
  const d = s.overallDepthCm;
  if (d == null || d > MAX_PLAUSIBLE_BODY_DEPTH_CM) return null;
  return d;
}

/** Usable seat depth, or null when the figure is really a chaise length. */
export function seatDepthOf(s: Pick<SofaBed, "seatDepthCm">): number | null {
  const d = s.seatDepthCm;
  if (d == null || d > MAX_PLAUSIBLE_SEAT_DEPTH_CM) return null;
  return d;
}

/** Bed width, or null when the figure is really a bed length. See the note on
 *  MAX_PLAUSIBLE_BED_WIDTH_CM: 190 is the number this guard exists to catch. */
export function bedWidthOf(s: Pick<SofaBed, "bedWidthCm">): number | null {
  const w = s.bedWidthCm;
  if (w == null || w > MAX_PLAUSIBLE_BED_WIDTH_CM) return null;
  return w;
}

/** Bed length, or null when the figure is really a width. */
export function bedLengthOf(s: Pick<SofaBed, "bedLengthCm">): number | null {
  const l = s.bedLengthCm;
  if (l == null || l < MIN_PLAUSIBLE_BED_LENGTH_CM || l > MAX_PLAUSIBLE_BED_LENGTH_CM) return null;
  return l;
}

export function hasSuspectDepth(s: Pick<SofaBed, "overallDepthCm" | "seatDepthCm">): boolean {
  return (
    (s.overallDepthCm != null && s.overallDepthCm > MAX_PLAUSIBLE_BODY_DEPTH_CM) ||
    (s.seatDepthCm != null && s.seatDepthCm > MAX_PLAUSIBLE_SEAT_DEPTH_CM)
  );
}

export function hasSuspectBedSize(s: Pick<SofaBed, "bedWidthCm" | "bedLengthCm">): boolean {
  return (
    (s.bedWidthCm != null && s.bedWidthCm > MAX_PLAUSIBLE_BED_WIDTH_CM) ||
    (s.bedLengthCm != null &&
      (s.bedLengthCm < MIN_PLAUSIBLE_BED_LENGTH_CM || s.bedLengthCm > MAX_PLAUSIBLE_BED_LENGTH_CM))
  );
}

export type Verdict = "pass" | "fail" | "unknown";

export interface Fit {
  /** R1: seats three people. */
  seats: Verdict;
  /** R2: inside the 200-250cm band. Both ends are gates. */
  width: Verdict;
  /** R3: opens to a small double or bigger. */
  bed: Verdict;
  overall: Verdict;
  /** Which mechanism delivers the bed, when the listing says. */
  mechanismRoute: Mechanism | null;
  /** Whether you sleep on something other than the seat. Null when unclear. */
  sleepsApart: boolean | null;
  notes: string[];
}

export function fitFor(s: SofaBed): Fit {
  const notes: string[] = [];

  // --- R1 ---
  let seats: Verdict;
  if (s.seats == null) {
    seats = "unknown";
  } else if (s.seats >= MIN_SEATS) {
    seats = "pass";
  } else {
    seats = "fail";
    notes.push(`Seats ${s.seats} — the brief is ${MIN_SEATS}`);
  }

  // --- R2: a band, not a ceiling ---
  let width: Verdict;
  const w = s.overallWidthCm;
  if (w == null) {
    width = "unknown";
  } else if (w < MIN_WIDTH_CM) {
    width = "fail";
    notes.push(`${w}cm wide — too narrow, that is a small sofa`);
  } else if (w > MAX_WIDTH_CM) {
    width = "fail";
    notes.push(`${w}cm wide — ${Math.round(w - MAX_WIDTH_CM)}cm over the wall allowance`);
  } else {
    width = "pass";
  }

  // --- R3 ---
  let bed: Verdict;
  const bw = bedWidthOf(s);
  if (bw == null) {
    bed = "unknown";
    if (s.bedWidthCm != null) {
      notes.push("Published bed width looks like a bed length, not a width");
    }
  } else if (bw >= MIN_BED_WIDTH_CM) {
    bed = "pass";
  } else {
    bed = "fail";
    notes.push(`Opens to ${bw}cm — narrower than a small double`);
  }

  // --- Routes: recorded, never gated (spec §3, §4) ---
  const mechanismRoute = s.mechanism;
  const sleepsApart = s.separateMattress;
  if (sleepsApart === true) {
    notes.push("Separate mattress — you don't sleep on the seat cushions");
  } else if (sleepsApart === false) {
    notes.push("The seat is the mattress — sits firmer");
  }
  if (s.legRest === "storage-chaise") {
    notes.push("Storage chaise — leg rest that swallows the bedding");
  }

  const all = [seats, width, bed];
  const overall: Verdict = all.includes("fail") ? "fail" : all.includes("unknown") ? "unknown" : "pass";

  return { seats, width, bed, overall, mechanismRoute, sleepsApart, notes };
}

export function fitLabel(f: Fit): string {
  if (f.overall === "pass") {
    const bedBit = f.sleepsApart === true ? "separate mattress" : f.mechanismRoute ?? "bed";
    return `3 seats + ${bedBit}`;
  }
  if (f.overall === "unknown") return "Spec incomplete";
  const failed = [f.seats === "fail" && "seats", f.width === "fail" && "width", f.bed === "fail" && "bed size"]
    .filter(Boolean)
    .join(", ");
  return `Doesn't meet: ${failed}`;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest sofabed-fit`
Expected: PASS, all suites green.

- [ ] **Step 6: Commit**

```bash
git add lib/sofabeds/types.ts lib/sofabeds/fit.ts __tests__/lib/sofabed-fit.test.ts
git commit -m "feat(sofa-beds): domain types and the three fit gates

Width becomes a band rather than a ceiling — the 200cm floor is the
gate this search adds, because 'two seats' in the sofa search always
meant two cushions and read as capacity it admitted exactly the
compact models with the worst mechanisms.

The bed-width guard sits at 185 and not 200 so that 190 — the standard
UK bed length, and the number most often filed in the width column by
mistake — reads as unknown instead of as a magnificent bed."
```

---

### Task 2: The ranking

**Files:**
- Create: `lib/sofabeds/score.ts`
- Test: `__tests__/lib/sofabed-score.test.ts`

**Interfaces:**
- Consumes: `fitFor`, `bodyDepthOf`, `seatDepthOf`, `bedWidthOf`, `Fit` from `./fit`; all constants and `SofaBed` from `./types`.
- Produces: `scoreAll(rows: SofaBed[]): ScoredSofaBed[]`, `scoreSofaBed(s: SofaBed, prior?: number): ScoredSofaBed`, `ScoredSofaBed` (extends `SofaBed` with `score`, `rawScore`, `confidence`, `reasons`, `gaps`, `fit`, `styleMatch`), `ScoreReason`, `CRITERIA`, `TOTAL_WEIGHT`.

Criteria and weights, summing to 100. `sitting` leads because spec §4 says the axis is not a dimension:

| key | label | weight |
|---|---|---|
| `sitting` | Sitting comfort | 20 |
| `depth` | Depth | 18 |
| `bedSize` | Bed size | 14 |
| `mattress` | Mattress | 12 |
| `seatDepth` | Seat depth | 10 |
| `value` | Value | 10 |
| `legRest` | Leg rest | 8 |
| `frame` | Frame | 8 |

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/sofabed-score.test.ts`:

```ts
import { scoreAll, scoreSofaBed, CRITERIA, TOTAL_WEIGHT } from "@/lib/sofabeds/score";
import { NO_FINANCE, type SofaBed } from "@/lib/sofabeds/types";

const base: SofaBed = {
  id: "x", retailer: "R", brand: "B", model: "M", productUrl: "u",
  imageUrl: null, colourwayShown: null,
  priceGbp: 900, rrpGbp: null, deliveryCostGbp: null, deliveryIncluded: true,
  landedCostGbp: 900, overBudget: false,
  condition: "new", inStock: true, oneOff: false,
  seats: 3, seatCushions: 2,
  mechanism: "fold-out", separateMattress: true,
  bedWidthCm: 140, bedLengthCm: 190,
  mattressType: "sprung", mattressThicknessCm: 14, beddingStorage: false,
  legRest: "none", chaiseSide: null, modular: null,
  overallWidthCm: 220, overallDepthCm: 105, overallHeightCm: 85,
  extendedDepthCm: 200, seatDepthCm: null, seatHeightCm: null,
  armStyle: null, fabric: null, easyClean: null, removableCovers: null,
  seatFilling: null, frameMaterial: null,
  warranty: null, returnsWindow: null, deliveryLeadTime: null,
  reviewScore: null, reviewCount: null,
  finance: { ...NO_FINANCE }, notes: null, extra: {}, pref: null,
};

const s = (over: Partial<SofaBed> = {}): SofaBed => ({ ...base, ...over });

describe("the weights", () => {
  it("sum to 100, with sitting comfort the heaviest", () => {
    expect(TOTAL_WEIGHT).toBe(100);
    const heaviest = [...CRITERIA].sort((a, b) => b.weight - a.weight)[0];
    expect(heaviest.key).toBe("sitting");
  });
});

describe("sitting comfort is the axis, and it is a boolean not a dimension", () => {
  it("ranks a separate mattress above a seat-is-the-mattress at equal everything else", () => {
    const apart = scoreSofaBed(s({ separateMattress: true, mechanism: "fold-out" }));
    const onSeat = scoreSofaBed(s({ separateMattress: false, mechanism: "click-clack" }));
    expect(apart.score).toBeGreaterThan(onSeat.score);
  });

  it("does not punish an unclear listing — it scores it as unknown", () => {
    const unclear = scoreSofaBed(s({ separateMattress: null, mechanism: null }));
    expect(unclear.gaps).toContain("Sitting comfort");
    // Excluded from the average, NOT counted as zero.
    const onSeat = scoreSofaBed(s({ separateMattress: false, mechanism: "click-clack" }));
    expect(unclear.rawScore).toBeGreaterThan(onSeat.rawScore);
  });
});

describe("a missing spec is never a bad spec", () => {
  it("gives a sparse row lower confidence, not a lower raw score", () => {
    const full = scoreSofaBed(s({ seatDepthCm: 62, frameMaterial: "solid hardwood" }));
    const sparse = scoreSofaBed(s({ seatDepthCm: null, frameMaterial: null }));
    expect(sparse.confidence).toBeLessThan(full.confidence);
  });

  it("shrinks a low-confidence score toward the corpus prior", () => {
    const rows = [
      s({ id: "a" }), s({ id: "b" }), s({ id: "c" }),
      s({ id: "sparse", seatDepthCm: null, frameMaterial: null, mattressType: null,
          mattressThicknessCm: null, separateMattress: null, mechanism: null,
          overallDepthCm: null, bedWidthCm: null }),
    ];
    const scored = scoreAll(rows);
    const sparse = scored.find((r) => r.id === "sparse")!;
    expect(sparse.confidence).toBeLessThan(0.4);
    expect(sparse.score).toBeGreaterThan(0);
  });
});

describe("bed size is scored above the floor, not just gated at it", () => {
  it("ranks a full double above a small double", () => {
    expect(scoreSofaBed(s({ bedWidthCm: 140 })).score)
      .toBeGreaterThan(scoreSofaBed(s({ bedWidthCm: 120 })).score);
  });

  it("refuses to reward a bed width that is really a length", () => {
    const suspect = scoreSofaBed(s({ bedWidthCm: 190 }));
    const real = scoreSofaBed(s({ bedWidthCm: 140 }));
    expect(suspect.score).toBeLessThanOrEqual(real.score);
    expect(suspect.gaps).toContain("Bed size");
  });
});

describe("depth still matters — this is the same buyer and the same reference", () => {
  it("rewards the reference depth", () => {
    expect(scoreSofaBed(s({ overallDepthCm: 112 })).score)
      .toBeGreaterThan(scoreSofaBed(s({ overallDepthCm: 92 })).score);
  });
});

describe("the leg rest is scored, not gated", () => {
  it("ranks a storage chaise top and 'none' bottom, without failing either", () => {
    const storage = scoreSofaBed(s({ legRest: "storage-chaise" }));
    const none = scoreSofaBed(s({ legRest: "none" }));
    expect(storage.score).toBeGreaterThan(none.score);
    expect(none.fit.overall).toBe("pass");
  });
});

describe("styleMatch", () => {
  it("is reported separately from the score", () => {
    const r = scoreSofaBed(s({ overallDepthCm: 112, seatCushions: 2, armStyle: "wide square" }));
    expect(r.styleMatch).toBeGreaterThan(0.5);
    expect(r.styleMatch).toBeLessThanOrEqual(1);
  });

  it("rewards two cushions across a 3-seat width — the Raft Loft look", () => {
    const two = scoreSofaBed(s({ seatCushions: 2, overallWidthCm: 220 }));
    const three = scoreSofaBed(s({ seatCushions: 3, overallWidthCm: 220 }));
    expect(two.styleMatch).toBeGreaterThan(three.styleMatch);
  });

  it("does not consider filling — no sofa bed has feather cushions", () => {
    const a = scoreSofaBed(s({ seatFilling: "foam" }));
    const b = scoreSofaBed(s({ seatFilling: null }));
    expect(a.styleMatch).toBe(b.styleMatch);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest sofabed-score`
Expected: FAIL — `Cannot find module '@/lib/sofabeds/score'`.

- [ ] **Step 3: Write `lib/sofabeds/score.ts`**

```ts
// The recommendation ranking behind the default sort on /sofa-beds.
//
// DESIGN RULE, inherited from lib/sofas/score.ts: a missing spec must never be
// scored as a bad spec. Criteria return null when there is no evidence, null
// is excluded from the average rather than counted as zero, and the reported
// score is shrunk toward the corpus median in proportion to how little
// evidence backs it.
//
// The heaviest criterion here is not a dimension. Spec §4: the mechanism sits
// in the seat box, so what predicts how a sofa bed SITS is whether the thing
// you sleep on is a different object from the thing you sit on.
import { bedWidthOf, bodyDepthOf, fitFor, seatDepthOf, type Fit } from "./fit";
import {
  BUDGET_CAP_GBP,
  FULL_DOUBLE_WIDTH_CM,
  GOOD_SEAT_DEPTH_CM,
  LOUNGE_SEAT_DEPTH_CM,
  MIN_BED_WIDTH_CM,
  MIN_USEFUL_DEPTH_CM,
  MIN_WIDTH_CM,
  REAL_MATTRESS_CM,
  TARGET_DEPTH_CM,
  TOKEN_MATTRESS_CM,
  type SofaBed,
} from "./types";

export interface ScoreReason {
  label: string;
  tone: "good" | "bad" | "unknown";
}

export interface ScoredSofaBed extends SofaBed {
  score: number;
  rawScore: number;
  confidence: number;
  reasons: ScoreReason[];
  gaps: string[];
  fit: Fit;
  /** How closely it reads like the Raft Loft. Separate from the score — a
   *  sofa bed can be excellent and look nothing like the reference. */
  styleMatch: number;
}

const SHRINKAGE_K = 25;
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

const SOLID = /solid (hardwood|beech|birch|pine|oak|timber)|hardwood|kiln[- ]dried/i;
const CHIPBOARD = /chipboard|particle\s*board/i;

interface Criterion {
  key: string;
  label: string;
  weight: number;
  evaluate: (s: SofaBed, fit: Fit, out: ScoreReason[]) => number | null;
}

const CRITERIA: Criterion[] = [
  {
    key: "sitting",
    label: "Sitting comfort",
    weight: 20,
    // Spec §4. Not a dimension — a boolean.
    evaluate: (s, _f, out) => {
      if (s.separateMattress == null) return null;
      if (s.separateMattress) {
        out.push({ label: "Sleeps on its own mattress — the seat stays a seat", tone: "good" });
        return s.mechanism === "pull-out" ? 1 : 0.92;
      }
      out.push({ label: "You sit on the mattress — firm, bench-like", tone: "bad" });
      return 0.25;
    },
  },
  {
    key: "depth",
    label: "Depth",
    weight: 18,
    // Same buyer, same 5'11", same reference as the sofa search.
    evaluate: (s, _f, out) => {
      const d = bodyDepthOf(s);
      if (d == null) {
        if (s.overallDepthCm != null) {
          out.push({ label: "Published depth is an L-shape footprint, not the sofa's depth", tone: "unknown" });
        }
        return null;
      }
      if (d >= TARGET_DEPTH_CM) {
        out.push({ label: `${d}cm deep — matches the Raft you liked`, tone: "good" });
        return 1;
      }
      if (d >= 105) {
        out.push({ label: `${d}cm deep — close to the reference`, tone: "good" });
        return 0.85;
      }
      if (d >= MIN_USEFUL_DEPTH_CM) {
        out.push({ label: `${d}cm deep — deep, but short of the 112cm you liked`, tone: "unknown" });
        return 0.6;
      }
      out.push({ label: `${d}cm deep — a standard settee, no thigh support`, tone: "bad" });
      return 0.15;
    },
  },
  {
    key: "bedSize",
    label: "Bed size",
    weight: 14,
    evaluate: (s, _f, out) => {
      const w = bedWidthOf(s);
      if (w == null) {
        if (s.bedWidthCm != null) {
          out.push({ label: "Published bed width is really a bed length", tone: "unknown" });
        }
        return null;
      }
      if (w >= FULL_DOUBLE_WIDTH_CM) {
        out.push({ label: `Opens to ${w}cm — a full double`, tone: "good" });
        return 1;
      }
      if (w >= MIN_BED_WIDTH_CM) {
        out.push({ label: `Opens to ${w}cm — a small double`, tone: "good" });
        return 0.7;
      }
      out.push({ label: `Opens to ${w}cm — under a small double`, tone: "bad" });
      return 0.2;
    },
  },
  {
    key: "mattress",
    label: "Mattress",
    weight: 12,
    evaluate: (s, _f, out) => {
      const bits: number[] = [];
      if (s.mattressType != null) {
        const byType: Record<string, number> = {
          "pocket-sprung": 1, sprung: 0.8, memory: 0.65, foam: 0.5, fibre: 0.25,
        };
        bits.push(byType[s.mattressType] ?? 0.5);
        out.push({
          label: `${s.mattressType} mattress`,
          tone: bits[bits.length - 1] >= 0.8 ? "good" : bits[bits.length - 1] <= 0.3 ? "bad" : "unknown",
        });
      }
      if (s.mattressThicknessCm != null) {
        const t = s.mattressThicknessCm;
        bits.push(clamp01((t - TOKEN_MATTRESS_CM) / (REAL_MATTRESS_CM - TOKEN_MATTRESS_CM)));
        if (t < TOKEN_MATTRESS_CM) {
          out.push({ label: `${t}cm mattress — a token gesture`, tone: "bad" });
        } else if (t >= REAL_MATTRESS_CM) {
          out.push({ label: `${t}cm mattress — a real one`, tone: "good" });
        }
      }
      if (!bits.length) return null;
      return bits.reduce((a, b) => a + b, 0) / bits.length;
    },
  },
  {
    key: "seatDepth",
    label: "Seat depth",
    weight: 10,
    // Rarely published; when it is, it beats overall depth as evidence.
    evaluate: (s, _f, out) => {
      const d = seatDepthOf(s);
      if (d == null) return null;
      if (d >= LOUNGE_SEAT_DEPTH_CM) {
        out.push({ label: `${d}cm seat — you lounge rather than sit`, tone: "good" });
        return 1;
      }
      if (d >= GOOD_SEAT_DEPTH_CM) {
        out.push({ label: `${d}cm seat — supports your legs`, tone: "good" });
        return 0.8;
      }
      out.push({ label: `${d}cm seat — no support past the knee`, tone: "bad" });
      return 0.3;
    },
  },
  {
    key: "value",
    label: "Value",
    weight: 10,
    evaluate: (s, _f, out) => {
      const c = s.landedCostGbp;
      if (c == null) return null;
      if (c > BUDGET_CAP_GBP) {
        out.push({ label: `£${Math.round(c)} landed — £${Math.round(c - BUDGET_CAP_GBP)} over budget`, tone: "bad" });
        return clamp01(1 - (c - BUDGET_CAP_GBP) / BUDGET_CAP_GBP) * 0.4;
      }
      out.push({ label: `£${Math.round(c)} landed — inside budget`, tone: "good" });
      return clamp01(0.6 + 0.4 * (1 - c / BUDGET_CAP_GBP));
    },
  },
  {
    key: "legRest",
    label: "Leg rest",
    weight: 8,
    // Spec §5: scored, never gated. A storage chaise answers leg rest, bed
    // and bedding storage at once, so it tops this criterion on merit.
    evaluate: (s, _f, out) => {
      if (s.legRest == null) return null;
      if (s.legRest === "storage-chaise") {
        out.push({ label: "Storage chaise — legs up, bedding hidden", tone: "good" });
        return 1;
      }
      if (s.legRest === "both") {
        out.push({ label: "Chaise and a footstool", tone: "good" });
        return 0.95;
      }
      if (s.legRest === "chaise") {
        out.push({
          label: s.chaiseSide === "reversible" ? "Reversible chaise — you choose the side" : "Built-in chaise",
          tone: "good",
        });
        return 0.85;
      }
      if (s.legRest === "footstool") {
        out.push({ label: "Separate footstool — movable, doubles as a seat", tone: "good" });
        return 0.75;
      }
      out.push({ label: "Nowhere to put your legs up", tone: "bad" });
      return 0.25;
    },
  },
  {
    key: "frame",
    label: "Frame",
    weight: 8,
    evaluate: (s, _f, out) => {
      const m = s.frameMaterial;
      if (!m) return null;
      if (CHIPBOARD.test(m)) {
        out.push({ label: `${m} frame — won't survive being folded nightly`, tone: "bad" });
        return 0.2;
      }
      if (SOLID.test(m)) {
        out.push({ label: `${m} frame`, tone: "good" });
        return 1;
      }
      return 0.6;
    },
  },
];

const TOTAL_WEIGHT = CRITERIA.reduce((a, c) => a + c.weight, 0);

/** 0-1, how closely this reads like the Raft Loft.
 *
 *  Filling is deliberately absent, unlike the sofa search's style score:
 *  feather over a bed mechanism is close to nonexistent, so scoring it would
 *  mark every row in the corpus down for a property the category cannot have. */
function styleMatchOf(s: SofaBed): number {
  const bits: number[] = [];
  const bd = bodyDepthOf(s);
  if (bd != null) bits.push(clamp01((bd - 85) / (TARGET_DEPTH_CM - 85)));
  if (s.seatCushions != null && s.overallWidthCm != null) {
    // Two big cushions across a 3-seat width IS the look.
    bits.push(s.seatCushions <= 2 && s.overallWidthCm >= MIN_WIDTH_CM ? 1 : 0.4);
  }
  if (s.modular != null) bits.push(s.modular ? 1 : 0.5);
  if (s.armStyle) bits.push(/square|track|block|wide/i.test(s.armStyle) ? 1 : 0.3);
  if (s.removableCovers != null) bits.push(s.removableCovers ? 1 : 0.6);
  if (s.colourwayShown || s.fabric) {
    const t = `${s.colourwayShown ?? ""} ${s.fabric ?? ""}`;
    bits.push(/cream|ivory|natural|linen|oat|stone|sand|ecru|beige|bone|putty/i.test(t) ? 1 : 0.4);
  }
  if (!bits.length) return 0.5;
  return bits.reduce((a, b) => a + b, 0) / bits.length;
}

interface Measured {
  rawScore: number;
  confidence: number;
  reasons: ScoreReason[];
  gaps: string[];
  fit: Fit;
}

function measure(s: SofaBed): Measured {
  const reasons: ScoreReason[] = [];
  const gaps: string[] = [];
  const fit = fitFor(s);
  let sum = 0;
  let known = 0;
  for (const c of CRITERIA) {
    const v = c.evaluate(s, fit, reasons);
    if (v == null) {
      gaps.push(c.label);
      continue;
    }
    sum += v * c.weight;
    known += c.weight;
  }
  return { rawScore: known > 0 ? sum / known : 0.5, confidence: known / TOTAL_WEIGHT, reasons, gaps, fit };
}

const TONE_RANK = { good: 0, bad: 1, unknown: 2 } as const;

function finalise(s: SofaBed, m: Measured, prior: number): ScoredSofaBed {
  const knownWeight = m.confidence * TOTAL_WEIGHT;
  const shrunk = (m.rawScore * knownWeight + prior * SHRINKAGE_K) / (knownWeight + SHRINKAGE_K);
  return {
    ...s,
    score: Math.round(shrunk * 1000) / 10,
    rawScore: Math.round(m.rawScore * 1000) / 10,
    confidence: Math.round(m.confidence * 100) / 100,
    reasons: m.reasons.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]),
    gaps: m.gaps,
    fit: m.fit,
    styleMatch: Math.round(styleMatchOf(s) * 100) / 100,
  };
}

function corpusPrior(measured: Measured[]): number {
  const solid = measured.filter((m) => m.confidence >= 0.5).map((m) => m.rawScore);
  const pool = solid.length >= 5 ? solid : measured.map((m) => m.rawScore);
  if (!pool.length) return 0.5;
  const a = [...pool].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

export function scoreAll(rows: SofaBed[]): ScoredSofaBed[] {
  const measured = rows.map(measure);
  const prior = corpusPrior(measured);
  return rows.map((s, i) => finalise(s, measured[i], prior));
}

export function scoreSofaBed(s: SofaBed, prior = 0.5): ScoredSofaBed {
  return finalise(s, measure(s), prior);
}

export { TOTAL_WEIGHT, CRITERIA };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest sofabed-score`
Expected: PASS.

- [ ] **Step 5: Run the whole suite — nothing else may break**

Run: `npx jest`
Expected: PASS, including the eight pre-existing suites.

- [ ] **Step 6: Commit**

```bash
git add lib/sofabeds/score.ts __tests__/lib/sofabed-score.test.ts
git commit -m "feat(sofa-beds): ranking, led by sitting comfort

The heaviest criterion is a boolean, not a dimension. The mechanism
lives in the seat box, so what predicts how one of these SITS is
whether you sleep on a different object from the one you sit on.

Filling drops out of the style score: feather over a bed mechanism
barely exists, so scoring it would mark the whole corpus down for a
property the category cannot have."
```

---

### Task 3: Prisma model and the store boundary

**Files:**
- Modify: `prisma/schema.prisma` (append two models, after `SofaPref`)
- Create: `lib/sofabeds/store.ts`

**Interfaces:**
- Consumes: `PrismaClient` from `@prisma/client`; `NO_FINANCE`, `FinancePolicy` from `@/lib/retail/finance`; the types from `./types`.
- Produces: `loadSofaBeds(prisma): Promise<SofaBed[]>`, `saveSofaBed(prisma, s): Promise<void>`, `setSofaBedPref(prisma, sofaBedId, pref): Promise<void>`.

- [ ] **Step 1: Append the models to `prisma/schema.prisma`**

```prisma
model SofaBed {
  id             String  @id @map("_id") // kebab: retailer-model
  retailer       String
  brand          String
  model          String
  productUrl     String
  imageUrl       String?
  colourwayShown String?

  priceGbp         Float
  rrpGbp           Float?
  deliveryCostGbp  Float?
  deliveryIncluded Boolean @default(false)
  landedCostGbp    Float
  overBudget       Boolean @default(false)

  /// "new" | "ex-display" | "clearance" | "second-hand". Out of the score.
  condition String  @default("new")
  oneOff    Boolean @default(false)

  /// Null when no availability is published. False means sold out.
  inStock Boolean?

  seats        Int?
  seatCushions Int?

  /// "fold-out" | "pull-out" | "click-clack" | "futon"
  mechanism String?
  /// Whether you sleep on a different object from the one you sit on.
  /// Null when the listing is not unambiguous — this is the score's main
  /// axis and must never be inferred from a marketing name.
  separateMattress Boolean?

  bedWidthCm          Float?
  bedLengthCm         Float?
  /// "pocket-sprung" | "sprung" | "memory" | "foam" | "fibre"
  mattressType        String?
  mattressThicknessCm Float?
  beddingStorage      Boolean?

  /// "chaise" | "storage-chaise" | "footstool" | "both" | "none"
  legRest    String?
  chaiseSide String?
  modular    Boolean?

  overallWidthCm  Float?
  overallDepthCm  Float?
  overallHeightCm Float?
  /// How far it reaches into the room when open. Recorded, never gated.
  extendedDepthCm Float?
  seatDepthCm     Float?
  seatHeightCm    Float?

  armStyle        String?
  fabric          String?
  easyClean       Boolean?
  removableCovers Boolean?
  seatFilling     String?
  frameMaterial   String?

  warranty         String?
  returnsWindow    String?
  deliveryLeadTime String?
  reviewScore      Float?
  reviewCount      Int?

  finance String @default("{}")

  notes String?
  extra String @default("{}")

  pref SofaBedPref?

  @@index([retailer])
  @@map("sofa_beds")
}

model SofaBedPref {
  id        String   @id @default(cuid()) @map("_id")
  sofaBedId String   @unique
  pref      String // "want" | "reject"
  updatedAt DateTime @default(now()) @updatedAt

  sofaBed SofaBed @relation(fields: [sofaBedId], references: [id], onDelete: Cascade)

  @@map("sofa_bed_prefs")
}
```

- [ ] **Step 2: Regenerate the client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client". If it fails, stop — every later task depends on `prisma.sofaBed` existing.

- [ ] **Step 3: Write `lib/sofabeds/store.ts`**

```ts
// DB <-> plain-object mapping for the sofa bed store. Same boundary discipline
// as lib/sofas/store.ts: the JSON-string columns are parsed and serialised
// here, and nothing derived is ever persisted.
import type { PrismaClient } from "@prisma/client";
import { NO_FINANCE, type FinancePolicy } from "@/lib/retail/finance";
import type {
  ChaiseSide, Condition, Filling, LegRest, MattressType, Mechanism, Pref, SofaBed,
} from "./types";

type PC = PrismaClient;

const CONDITIONS: Condition[] = ["new", "ex-display", "clearance", "second-hand"];
const MECHANISMS: Mechanism[] = ["fold-out", "pull-out", "click-clack", "futon"];
const LEG_RESTS: LegRest[] = ["chaise", "storage-chaise", "footstool", "both", "none"];
const SIDES: ChaiseSide[] = ["left", "right", "reversible"];
const MATTRESS_TYPES: MattressType[] = ["pocket-sprung", "sprung", "memory", "foam", "fibre"];
const FILLINGS: Filling[] = ["feather", "feather-blend", "foam", "fibre", "mixed"];

const oneOf = <T extends string>(allowed: T[], v: string | null): T | null =>
  v != null && (allowed as string[]).includes(v) ? (v as T) : null;

function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    const v = JSON.parse(s) as unknown;
    return v && typeof v === "object" ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function parseFinance(s: string | null | undefined): FinancePolicy {
  const v = parseJson<Partial<FinancePolicy>>(s, {});
  return {
    ...NO_FINANCE,
    ...v,
    tiers: Array.isArray(v.tiers) ? v.tiers.filter((t) => t && typeof t.minSpend === "number") : [],
  };
}

export async function loadSofaBeds(prisma: PC): Promise<SofaBed[]> {
  const rows = await prisma.sofaBed.findMany({ include: { pref: true }, orderBy: { landedCostGbp: "asc" } });
  return rows.map(
    (s): SofaBed => ({
      id: s.id,
      retailer: s.retailer,
      brand: s.brand,
      model: s.model,
      productUrl: s.productUrl,
      imageUrl: s.imageUrl,
      colourwayShown: s.colourwayShown,

      priceGbp: s.priceGbp,
      rrpGbp: s.rrpGbp,
      deliveryCostGbp: s.deliveryCostGbp,
      deliveryIncluded: s.deliveryIncluded,
      landedCostGbp: s.landedCostGbp,
      overBudget: s.overBudget,

      condition: (oneOf(CONDITIONS, s.condition) ?? "new") as Condition,
      inStock: s.inStock,
      oneOff: s.oneOff,

      seats: s.seats,
      seatCushions: s.seatCushions,

      mechanism: oneOf(MECHANISMS, s.mechanism),
      separateMattress: s.separateMattress,

      bedWidthCm: s.bedWidthCm,
      bedLengthCm: s.bedLengthCm,
      mattressType: oneOf(MATTRESS_TYPES, s.mattressType),
      mattressThicknessCm: s.mattressThicknessCm,
      beddingStorage: s.beddingStorage,

      legRest: oneOf(LEG_RESTS, s.legRest),
      chaiseSide: oneOf(SIDES, s.chaiseSide),
      modular: s.modular,

      overallWidthCm: s.overallWidthCm,
      overallDepthCm: s.overallDepthCm,
      overallHeightCm: s.overallHeightCm,
      extendedDepthCm: s.extendedDepthCm,
      seatDepthCm: s.seatDepthCm,
      seatHeightCm: s.seatHeightCm,

      armStyle: s.armStyle,
      fabric: s.fabric,
      easyClean: s.easyClean,
      removableCovers: s.removableCovers,
      seatFilling: oneOf(FILLINGS, s.seatFilling),
      frameMaterial: s.frameMaterial,

      warranty: s.warranty,
      returnsWindow: s.returnsWindow,
      deliveryLeadTime: s.deliveryLeadTime,
      reviewScore: s.reviewScore,
      reviewCount: s.reviewCount,

      finance: parseFinance(s.finance),

      notes: s.notes,
      extra: parseJson<Record<string, string>>(s.extra, {}),
      pref: (s.pref?.pref as Pref | undefined) ?? null,
    }),
  );
}

export async function saveSofaBed(prisma: PC, s: SofaBed): Promise<void> {
  const data = {
    retailer: s.retailer,
    brand: s.brand,
    model: s.model,
    productUrl: s.productUrl,
    imageUrl: s.imageUrl ?? null,
    colourwayShown: s.colourwayShown ?? null,

    priceGbp: s.priceGbp,
    rrpGbp: s.rrpGbp ?? null,
    deliveryCostGbp: s.deliveryCostGbp ?? null,
    deliveryIncluded: s.deliveryIncluded,
    landedCostGbp: s.landedCostGbp,
    overBudget: s.overBudget,

    condition: s.condition,
    inStock: s.inStock ?? null,
    oneOff: s.oneOff,

    seats: s.seats ?? null,
    seatCushions: s.seatCushions ?? null,

    mechanism: s.mechanism ?? null,
    separateMattress: s.separateMattress ?? null,

    bedWidthCm: s.bedWidthCm ?? null,
    bedLengthCm: s.bedLengthCm ?? null,
    mattressType: s.mattressType ?? null,
    mattressThicknessCm: s.mattressThicknessCm ?? null,
    beddingStorage: s.beddingStorage ?? null,

    legRest: s.legRest ?? null,
    chaiseSide: s.chaiseSide ?? null,
    modular: s.modular ?? null,

    overallWidthCm: s.overallWidthCm ?? null,
    overallDepthCm: s.overallDepthCm ?? null,
    overallHeightCm: s.overallHeightCm ?? null,
    extendedDepthCm: s.extendedDepthCm ?? null,
    seatDepthCm: s.seatDepthCm ?? null,
    seatHeightCm: s.seatHeightCm ?? null,

    armStyle: s.armStyle ?? null,
    fabric: s.fabric ?? null,
    easyClean: s.easyClean ?? null,
    removableCovers: s.removableCovers ?? null,
    seatFilling: s.seatFilling ?? null,
    frameMaterial: s.frameMaterial ?? null,

    warranty: s.warranty ?? null,
    returnsWindow: s.returnsWindow ?? null,
    deliveryLeadTime: s.deliveryLeadTime ?? null,
    reviewScore: s.reviewScore ?? null,
    reviewCount: s.reviewCount ?? null,

    finance: JSON.stringify(s.finance ?? NO_FINANCE),

    notes: s.notes ?? null,
    extra: JSON.stringify(s.extra ?? {}),
  };
  // Explicit branch rather than upsert — Atlas rejects the long aggregation
  // pipeline Prisma compiles an upsert into on a model this wide. See
  // lib/beds/store.ts for the full note.
  const existing = await prisma.sofaBed.findUnique({ where: { id: s.id }, select: { id: true } });
  if (existing) await prisma.sofaBed.update({ where: { id: s.id }, data });
  else await prisma.sofaBed.create({ data: { id: s.id, ...data } });
}

export async function setSofaBedPref(prisma: PC, sofaBedId: string, pref: Pref | null): Promise<void> {
  if (pref == null) {
    await prisma.sofaBedPref.deleteMany({ where: { sofaBedId } });
    return;
  }
  await prisma.sofaBedPref.upsert({ where: { sofaBedId }, create: { sofaBedId, pref }, update: { pref } });
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `prisma.sofaBed` is not found, Step 2 did not run.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma lib/sofabeds/store.ts
git commit -m "feat(sofa-beds): SofaBed model and the store boundary

Explicit find-then-update rather than upsert, for the same reason as
every other wide model here: Atlas rejects the aggregation pipeline
Prisma compiles an upsert into."
```

---

### Task 4: CSV column contract and the import script

**Files:**
- Create: `docs/sofa-bed-search/COLUMNS.md`
- Create: `scripts/sofabeds-import.ts`
- Test: `__tests__/lib/sofabed-import.test.ts`

**Interfaces:**
- Consumes: `saveSofaBed` from `@/lib/sofabeds/store`; types and `BUDGET_CAP_GBP` from `@/lib/sofabeds/types`.
- Produces: `parseCsv(text: string): Record<string, string>[]` and `toSofaBed(r: Record<string, string>): SofaBed | null`, both **exported** so they can be tested without a database. (`scripts/sofas-import.ts` does not export these; this script does, deliberately.)

- [ ] **Step 1: Write `docs/sofa-bed-search/COLUMNS.md`**

````markdown
# sofa bed CSV column contract

One row per model/configuration. Header, exactly:

retailer,brand,model,product_url,image_url,colourway_shown,price_gbp,rrp_gbp,delivery_cost_gbp,landed_cost_gbp,over_budget,condition,one_off,in_stock,seats,seat_cushions,mechanism,separate_mattress,bed_width_cm,bed_length_cm,mattress_type,mattress_thickness_cm,bedding_storage,leg_rest,chaise_side,modular,overall_width_cm,overall_depth_cm,overall_height_cm,extended_depth_cm,seat_depth_cm,seat_height_cm,arm_style,fabric,easy_clean,removable_covers,seat_filling,frame_material,warranty,returns_window,delivery_lead_time,review_score,review_count,notes

Rules:
- Leave a cell EMPTY when the retailer does not publish it. NEVER guess a
  dimension. Empty means "unpublished" and the app handles it correctly;
  a guessed number silently corrupts the ranking.
- `landed_cost_gbp` = price + delivery. If delivery is free/included, put
  "included" in delivery_cost_gbp and landed = price.
- `condition`: new | ex-display | clearance | second-hand
- `one_off`: yes when the stock cannot be reordered (most ex-display, all
  second-hand)
- `seats` is how many PEOPLE it seats. `seat_cushions` is how many cushions
  span that width. They are different numbers and both are wanted — two
  cushions across a 3-seat width is the look being searched for.
- `mechanism`: fold-out | pull-out | click-clack | futon
- `separate_mattress`: yes when a mattress is stored inside the frame and you
  do NOT sleep on the seat cushions; no when the seat IS the sleeping surface.
  **Leave EMPTY when the listing does not make this unambiguous.** Do not
  infer it from the product name — this is the single field the ranking leans
  on hardest, and a guess corrupts it.
- `bed_width_cm` is the width of the bed when open; `bed_length_cm` is its
  length. A UK double is 135 x 190. Putting 190 in the width column is the
  most common error in this corpus — check which way round you have it.
- `mattress_type`: pocket-sprung | sprung | memory | foam | fibre
- `mattress_thickness_cm`: the mattress only, not the folded sofa.
- `bedding_storage`: yes when there is a compartment for duvet and pillows.
- `leg_rest`: chaise | storage-chaise | footstool | both | none
  (`storage-chaise` = a chaise that lifts to store bedding)
- `chaise_side`: left | right | reversible  (as you look at the sofa)
- `modular`, `easy_clean`, `removable_covers`: yes | no
- `seat_filling`: feather | feather-blend | foam | fibre | mixed
- `overall_depth_cm` is the FULL front-to-back depth when CLOSED.
  `extended_depth_cm` is how far it reaches into the room when OPEN.
  `seat_depth_cm` is the usable seat only. Three different numbers — do not
  put one in another's column.
- SECOND-HAND ROWS: a used sofa bed comes with a used MATTRESS, which is a
  different proposition from a used sofa. In `notes`, say whether the mattress
  is included and what condition it is in. Replacing one is a real cost and the
  buyer needs it priced in, not discovered on collection day.
````

- [ ] **Step 2: Write the failing test**

Create `__tests__/lib/sofabed-import.test.ts`:

```ts
import { parseCsv, toSofaBed } from "@/scripts/sofabeds-import";

const HEADER =
  "retailer,brand,model,product_url,price_gbp,delivery_cost_gbp,condition,seats,seat_cushions," +
  "mechanism,separate_mattress,bed_width_cm,bed_length_cm,mattress_type,leg_rest,overall_width_cm,notes";

const row = (cells: string) => parseCsv(`${HEADER}\n${cells}`)[0];

describe("parseCsv", () => {
  it("keeps commas inside quoted fields", () => {
    const r = row(`IKEA,IKEA,FRIHETEN,https://x,699,included,new,3,2,fold-out,no,140,200,foam,storage-chaise,230,"Deep, roomy, and cheap"`);
    expect(r.notes).toBe("Deep, roomy, and cheap");
    expect(r.model).toBe("FRIHETEN");
  });
});

describe("toSofaBed", () => {
  it("drops a row with no price or no url", () => {
    expect(toSofaBed(row(`IKEA,IKEA,X,,,,new,3,2,fold-out,no,140,190,foam,none,230,`))).toBeNull();
  });

  it("treats 'included' delivery as landed = price", () => {
    const s = toSofaBed(row(`IKEA,IKEA,FRIHETEN,https://x,699,included,new,3,2,fold-out,no,140,200,foam,storage-chaise,230,`))!;
    expect(s.deliveryIncluded).toBe(true);
    expect(s.landedCostGbp).toBe(699);
    expect(s.overBudget).toBe(false);
  });

  it("flags over-budget rather than dropping the row", () => {
    const s = toSofaBed(row(`W&H,W&H,Chaise,https://x,1800,included,new,3,2,fold-out,yes,140,190,pocket-sprung,storage-chaise,230,`))!;
    expect(s.overBudget).toBe(true);
  });

  it("leaves separateMattress NULL when the cell is empty — never false", () => {
    // The score's main axis. An empty cell means unknown, not "no".
    const s = toSofaBed(row(`DFS,DFS,Y,https://x,900,included,new,3,2,fold-out,,140,190,foam,none,230,`))!;
    expect(s.separateMattress).toBeNull();
  });

  it("reads yes/no into a real boolean", () => {
    expect(toSofaBed(row(`DFS,DFS,Y,https://x,900,included,new,3,2,fold-out,yes,140,190,foam,none,230,`))!.separateMattress).toBe(true);
    expect(toSofaBed(row(`DFS,DFS,Y,https://x,900,included,new,3,2,fold-out,no,140,190,foam,none,230,`))!.separateMattress).toBe(false);
  });

  it("rejects a vocabulary it does not know instead of coercing it", () => {
    const s = toSofaBed(row(`DFS,DFS,Y,https://x,900,included,new,3,2,recliner,yes,140,190,marshmallow,none,230,`))!;
    expect(s.mechanism).toBeNull();
    expect(s.mattressType).toBeNull();
  });

  it("keeps storage-chaise, which the sofa corpus had no word for", () => {
    expect(toSofaBed(row(`IKEA,IKEA,FRIHETEN,https://x,699,included,new,3,2,fold-out,no,140,200,foam,storage-chaise,230,`))!.legRest)
      .toBe("storage-chaise");
  });

  it("builds a stable kebab id from retailer and model", () => {
    const s = toSofaBed(row(`John Lewis & Partners,JL,Sofa Bed 3,https://x,900,included,new,3,2,fold-out,yes,140,190,foam,none,230,`))!;
    expect(s.id).toBe("john-lewis-and-partners-sofa-bed-3");
  });

  it("files unrecognised columns into extra rather than dropping them", () => {
    const r = parseCsv(`retailer,brand,model,product_url,price_gbp,mystery\nIKEA,IKEA,X,https://x,699,wombat`)[0];
    expect(toSofaBed(r)!.extra.mystery).toBe("wombat");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest sofabed-import`
Expected: FAIL — `Cannot find module '@/scripts/sofabeds-import'`.

- [ ] **Step 4: Write `scripts/sofabeds-import.ts`**

Copy `scripts/sofas-import.ts` and change exactly what follows. Keep `parseCsv`, `str`, `num`, `yes`, `isIncluded`, `pick` and `makeId` byte-for-byte — they are shared, proven parsing, and re-deriving them invites a new bug.

Changes:
1. Header comment and default dir:

```ts
// Import the sofa bed research CSVs into the `sofa_beds` collection.
// Idempotent — re-running upserts by id and leaves want/reject prefs intact.
//
//   npx tsx scripts/sofabeds-import.ts [dir-or-file]
//
// Default: every .csv under docs/sofa-bed-search/.
const DEFAULT_DIR = path.join(process.cwd(), "docs", "sofa-bed-search");
```

2. **Export** `parseCsv` and `toSofaBed` (`export function parseCsv`, `export function toSofaBed`) so Task 4's test can reach them without a database.
3. Guard the CLI entry point so importing the module does not connect to Mongo:

```ts
if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
```

4. `PROMOTED` becomes exactly the COLUMNS.md header set:

```ts
const PROMOTED = new Set([
  "retailer", "brand", "model", "product_url", "image_url", "colourway_shown",
  "price_gbp", "rrp_gbp", "delivery_cost_gbp", "landed_cost_gbp", "over_budget",
  "condition", "one_off", "in_stock", "seats", "seat_cushions",
  "mechanism", "separate_mattress", "bed_width_cm", "bed_length_cm",
  "mattress_type", "mattress_thickness_cm", "bedding_storage",
  "leg_rest", "chaise_side", "modular",
  "overall_width_cm", "overall_depth_cm", "overall_height_cm", "extended_depth_cm",
  "seat_depth_cm", "seat_height_cm",
  "arm_style", "fabric", "easy_clean", "removable_covers", "seat_filling", "frame_material",
  "warranty", "returns_window", "delivery_lead_time", "review_score", "review_count", "notes",
]);
```

5. Vocabularies:

```ts
const CONDITIONS = ["new", "ex-display", "clearance", "second-hand"] as const;
const MECHANISMS = ["fold-out", "pull-out", "click-clack", "futon"] as const;
const LEG_RESTS = ["chaise", "storage-chaise", "footstool", "both", "none"] as const;
const SIDES = ["left", "right", "reversible"] as const;
const MATTRESS_TYPES = ["pocket-sprung", "sprung", "memory", "foam", "fibre"] as const;
const FILLINGS = ["feather", "feather-blend", "foam", "fibre", "mixed"] as const;
```

6. `toSofa` becomes `toSofaBed`, returning the new shape. The bed block in full:

```ts
export function toSofaBed(r: Record<string, string>): SofaBed | null {
  const retailer = str(r.retailer);
  const model = str(r.model);
  const url = str(r.product_url);
  const price = num(r.price_gbp);
  if (!retailer || !model || !url || price == null) return null;

  const deliveryIncluded = isIncluded(r.delivery_cost_gbp);
  const delivery = deliveryIncluded ? null : num(r.delivery_cost_gbp);
  const landed = num(r.landed_cost_gbp) ?? price + (delivery ?? 0);

  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    if (!PROMOTED.has(k) && str(v) != null) extra[k] = v;
  }

  return {
    id: makeId(retailer, model),
    retailer,
    brand: str(r.brand) ?? retailer,
    model,
    productUrl: url,
    imageUrl: str(r.image_url),
    colourwayShown: str(r.colourway_shown),

    priceGbp: price,
    rrpGbp: num(r.rrp_gbp),
    deliveryCostGbp: delivery,
    deliveryIncluded,
    landedCostGbp: landed,
    overBudget: landed > BUDGET_CAP_GBP,

    condition: (pick(CONDITIONS, r.condition) ?? "new") as Condition,
    inStock: yes(r.in_stock),
    oneOff: yes(r.one_off) ?? false,

    seats: num(r.seats),
    seatCushions: num(r.seat_cushions),

    mechanism: pick(MECHANISMS, r.mechanism) as Mechanism | null,
    // yes() already returns null for an empty cell — which is what an
    // unpublished mechanism must be. Never coerce it to false.
    separateMattress: yes(r.separate_mattress),

    bedWidthCm: num(r.bed_width_cm),
    bedLengthCm: num(r.bed_length_cm),
    mattressType: pick(MATTRESS_TYPES, r.mattress_type) as MattressType | null,
    mattressThicknessCm: num(r.mattress_thickness_cm),
    beddingStorage: yes(r.bedding_storage),

    legRest: pick(LEG_RESTS, r.leg_rest) as LegRest | null,
    chaiseSide: pick(SIDES, r.chaise_side) as ChaiseSide | null,
    modular: yes(r.modular),

    overallWidthCm: num(r.overall_width_cm),
    overallDepthCm: num(r.overall_depth_cm),
    overallHeightCm: num(r.overall_height_cm),
    extendedDepthCm: num(r.extended_depth_cm),
    seatDepthCm: num(r.seat_depth_cm),
    seatHeightCm: num(r.seat_height_cm),

    armStyle: str(r.arm_style),
    fabric: str(r.fabric),
    easyClean: yes(r.easy_clean),
    removableCovers: yes(r.removable_covers),
    seatFilling: pick(FILLINGS, r.seat_filling) as Filling | null,
    frameMaterial: str(r.frame_material),

    warranty: str(r.warranty),
    returnsWindow: str(r.returns_window),
    deliveryLeadTime: str(r.delivery_lead_time),
    reviewScore: num(r.review_score),
    reviewCount: num(r.review_count),

    finance: { ...NO_FINANCE },

    notes: str(r.notes),
    extra,
    pref: null,
  };
}
```

7. In `main()`, call `saveSofaBed(prisma, s)` and log `sofa beds` rather than `sofas`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest sofabed-import`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/sofa-bed-search/COLUMNS.md scripts/sofabeds-import.ts __tests__/lib/sofabed-import.test.ts
git commit -m "feat(sofa-beds): CSV contract and importer

parseCsv and toSofaBed are exported, unlike the sofa importer's, so the
coercion rules can be tested without a database. The rule that earns
the test: an empty separate_mattress cell stays null and never becomes
false — it is the axis the ranking leans on hardest."
```

---

### Task 5: API routes

**Files:**
- Create: `app/api/sofa-beds/route.ts`
- Create: `app/api/sofa-beds/pref/route.ts`

**Interfaces:**
- Consumes: `loadSofaBeds`, `setSofaBedPref` from `@/lib/sofabeds/store`; `prisma` from `@/lib/db`.
- Produces: `GET /api/sofa-beds` → `{ sofaBeds: SofaBed[] }`; `POST /api/sofa-beds/pref` `{ sofaBedId, pref }`; `DELETE /api/sofa-beds/pref` `{ sofaBedId }`.

- [ ] **Step 1: Write `app/api/sofa-beds/route.ts`**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadSofaBeds } from "@/lib/sofabeds/store";

// GET /api/sofa-beds — the whole sofa bed store. The /sofa-beds page recomputes
// the fit verdict, style match and score live (lib/sofabeds/{fit,score}.ts), so
// nothing derived is sent.
export async function GET() {
  const sofaBeds = await loadSofaBeds(prisma);
  return NextResponse.json({ sofaBeds });
}
```

- [ ] **Step 2: Write `app/api/sofa-beds/pref/route.ts`**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setSofaBedPref } from "@/lib/sofabeds/store";

// POST /api/sofa-beds/pref { sofaBedId, pref } — set/clear a want/reject.
export async function POST(request: Request) {
  const { sofaBedId, pref } = await request.json();
  if (!sofaBedId || typeof sofaBedId !== "string") {
    return NextResponse.json({ error: "sofaBedId is required" }, { status: 400 });
  }
  if (pref != null && pref !== "want" && pref !== "reject") {
    return NextResponse.json({ error: "pref must be 'want', 'reject', or null" }, { status: 400 });
  }
  await setSofaBedPref(prisma, sofaBedId, pref ?? null);
  return NextResponse.json({ ok: true, pref: pref ?? null });
}

export async function DELETE(request: Request) {
  const { sofaBedId } = await request.json();
  if (!sofaBedId) return NextResponse.json({ error: "sofaBedId is required" }, { status: 400 });
  await setSofaBedPref(prisma, sofaBedId, null);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit && npx next build`
Expected: both clean; the build output lists `/api/sofa-beds` and `/api/sofa-beds/pref`.

- [ ] **Step 4: Commit**

```bash
git add app/api/sofa-beds
git commit -m "feat(sofa-beds): GET /api/sofa-beds and the pref endpoint"
```

---

### Task 6: The workspace page

**Files:**
- Create: `components/sofabeds/SofaBedCard.tsx`
- Create: `components/sofabeds/SofaBedDetail.tsx`
- Create: `components/sofabeds/SofaBedFilterRail.tsx`
- Create: `app/sofa-beds/page.tsx`

**Interfaces:**
- Consumes: `ScoredSofaBed`, `scoreAll` from `@/lib/sofabeds/score`; `fitLabel`, `bodyDepthOf`, `bedWidthOf`, `hasSuspectBedSize` from `@/lib/sofabeds/fit`; `loadSofaBeds` from `@/lib/sofabeds/store`.
- Produces: the `/sofa-beds` route.

**Method:** read `components/sofas/SofaCard.tsx` (152 lines), `SofaDetail.tsx` (235), `SofaFilterRail.tsx` (272) and `app/sofas/page.tsx` (245) and mirror their structure, Tailwind classes and client/server split exactly. Do not invent a new visual language — this page sits in the same shelf as four others and must look like a sibling. The differences below are the *only* intended departures.

- [ ] **Step 1: Build the three components and the page, mirroring the sofa versions**

Signatures, which must match these exactly so the page wires up:

```tsx
// components/sofabeds/SofaBedCard.tsx
export default function SofaBedCard({
  sofaBed, onPref, onOpen,
}: {
  sofaBed: ScoredSofaBed;
  onPref: (id: string, pref: Pref | null) => void;
  onOpen: (s: ScoredSofaBed) => void;
}): React.ReactElement

// components/sofabeds/SofaBedDetail.tsx
export default function SofaBedDetail(
  { sofaBed, onClose }: { sofaBed: ScoredSofaBed | null; onClose: () => void },
): React.ReactElement | null

// components/sofabeds/SofaBedFilterRail.tsx
export interface SofaBedFilterState {
  retailer: string;            // "" = all
  condition: string;           // "" = all
  fit: "all" | "pass";
  budget: "all" | "in";
  mechanism: Mechanism[];      // empty = all
  separateMattressOnly: boolean;
  bedSize: "all" | "small-double" | "double";  // >=120 | >=135
  beddingStorage: boolean;
  sort: "score" | "price" | "depth" | "bed";
}

export const DEFAULT_SOFABED_FILTERS: SofaBedFilterState = {
  retailer: "", condition: "", fit: "all", budget: "all",
  mechanism: [], separateMattressOnly: false, bedSize: "all",
  beddingStorage: false, sort: "score",
};

export default function SofaBedFilterRail({
  retailers, conditions, filters, onChange,
}: {
  retailers: string[];
  conditions: string[];
  filters: SofaBedFilterState;
  onChange: (f: SofaBedFilterState) => void;
}): React.ReactElement
```

`app/sofa-beds/page.tsx` is a Server Component that calls `loadSofaBeds(prisma)` then `scoreAll(...)` and passes the scored rows to a client workspace component, exactly as `app/sofas/page.tsx` does. Read that file and follow its client/server split rather than inventing one.

Departures from the sofa originals, all of them required:

1. **Card badge** leads with sitting comfort, because that is the axis:
   - `separateMattress === true` → `"Separate mattress"` (good tone)
   - `separateMattress === false` → `"Sleep on the seat"` (bad tone)
   - `null` → `"Mechanism unclear"` (unknown tone)
2. **Card line** reads `{bedWidthOf(s)}cm bed · {bodyDepthOf(s)}cm deep`, each part omitted when null. Never print a suspect figure.
3. **Detail** adds a "When it's a bed" block: mechanism, bed width x length, mattress type and thickness, bedding storage, and `extendedDepthCm` rendered as *"reaches {n}cm into the room when open"*. When `hasSuspectBedSize(s)` is true, show *"the published bed size looks like it has width and length the wrong way round"* instead of the numbers.
4. **Filter rail** gets, in addition to the sofa rail's filters: mechanism (4 checkboxes), a "separate mattress only" toggle, a bed-size band (`≥120` / `≥135`), and "has bedding storage". Keep the existing condition, budget and fit filters.
5. **Empty state** must say what the spec predicts rather than looking broken: *"Nothing in the corpus meets all three gates. At £1,200 landed that is the expected answer — try the clearance and second-hand filters."*

- [ ] **Step 2: Verify it renders against real data**

Run: `npx next build`
Expected: clean build listing `/sofa-beds`.

Then `npm run dev`, open `http://localhost:3000/sofa-beds`, and confirm: the page renders with an empty corpus without throwing, and the empty state reads as above rather than as a blank column.

- [ ] **Step 3: Commit**

```bash
git add components/sofabeds app/sofa-beds
git commit -m "feat(sofa-beds): the /sofa-beds workspace

The card badge leads with sitting comfort rather than a dimension,
matching what the ranking actually weighs. The empty state says that
nothing meeting all three gates is the predicted answer at this budget,
so an honest empty corpus does not read as a broken page."
```

---

### Task 7: Navigation — the three-place change

**Files:**
- Modify: `components/Sidebar.tsx:31-36` (the furniture band)
- Modify: `app/api/summary/route.ts` (imports, load, score, product mapper, saved list, `roomDepts`, `departments`, `shelves`)
- Modify: `app/page.tsx:29,37,193-220` (the `Summary` type, a department tile, a shelf)

**Interfaces:**
- Consumes: `loadSofaBeds` from `@/lib/sofabeds/store`; `scoreAll as scoreSofaBeds` from `@/lib/sofabeds/score`; `bedWidthOf` from `@/lib/sofabeds/fit`.
- Produces: `Product.dept` gains `"sofabed"`; `summary.departments.sofaBeds`; `summary.shelves.sofaBeds`; a `"Sofa bed"` entry in `room.depts`.

- [ ] **Step 1: Sidebar — add to the furniture band**

In `components/Sidebar.tsx`, in the band that currently holds Beds / Mattress / TV unit / Sofas, after the `/sofas` entry:

```tsx
    { href: "/sofa-beds", label: "Sofa beds", icon: "🛌" },
```

- [ ] **Step 2: `/api/summary` — load, score, map**

Add the imports beside the sofa ones:

```ts
import { bedWidthOf } from "@/lib/sofabeds/fit";
import { loadSofaBeds } from "@/lib/sofabeds/store";
import { scoreAll as scoreSofaBeds } from "@/lib/sofabeds/score";
import { MIN_BED_WIDTH_CM } from "@/lib/sofabeds/types";
```

Widen `Product["dept"]` to include `"sofabed"`. Add `loadSofaBeds(prisma)` to the `Promise.all` and `sofaBeds` to its destructured array, keeping positions aligned.

Then, beside `sofaProduct`:

```ts
const scoredSofaBeds = scoreSofaBeds(sofaBeds).sort(
  (a, b) => FIT_RANK[a.fit.overall] - FIT_RANK[b.fit.overall] || b.score - a.score,
);

const sofaBedProduct = (s: (typeof scoredSofaBeds)[number]): Product => ({
  id: s.id, dept: "sofabed", label: s.model, eyebrow: s.retailer,
  price: Math.round(s.landedCostGbp), priceSuffix: null,
  image: s.imageUrl, url: s.productUrl, href: "/sofa-beds",
  score: Math.round(s.score),
  // The badge says the thing the ranking is actually about.
  badge:
    s.separateMattress === true
      ? "Sleeps on its own mattress"
      : s.legRest === "storage-chaise"
        ? "Storage chaise"
        : s.condition !== "new"
          ? s.condition
          : null,
  saved: s.pref === "want",
});
```

- [ ] **Step 3: `/api/summary` — basket, departments, shelves**

The basket buys ONE of each, and a sofa and a sofa bed are alternatives for the same slot — but the user is still deciding between them, so both departments appear and `outstanding` must not nag for both. Add:

```ts
const savedSofaBeds = scoredSofaBeds.filter((s) => s.pref === "want").map(sofaBedProduct);
```

In `roomDepts`, insert after the Sofa entry:

```ts
    dept("Sofa bed", "/sofa-beds", savedSofaBeds),
```

Add `savedSofaBeds.length` to `room.shortlisted`.

Then, so the home page does not ask for both halves of a decision, replace the `outstanding` line with:

```ts
      // A sofa and a sofa bed fill the same slot — the buyer is choosing
      // between them, not buying both. Once either is shortlisted, stop
      // asking for the other.
      outstanding: roomDepts
        .filter((d) => !d.chosen)
        .filter((d) => !(SEATING.has(d.label) && roomDepts.some((o) => SEATING.has(o.label) && o.chosen)))
        .map((d) => d.label.toLowerCase()),
```

with, above `return NextResponse.json({`:

```ts
  const SEATING = new Set(["Sofa", "Sofa bed"]);
```

In `departments`, beside `sofas`:

```ts
      sofaBeds: {
        count: sofaBeds.length,
        saved: savedSofaBeds.length,
        fits: scoredSofaBeds.filter((s) => s.fit.overall === "pass" && !s.overBudget).length,
        sleepsApart: scoredSofaBeds.filter((s) => s.separateMattress === true).length,
        double: scoredSofaBeds.filter((s) => (bedWidthOf(s) ?? 0) >= MIN_BED_WIDTH_CM).length,
      },
```

In `shelves`, beside `sofas`:

```ts
      sofaBeds: scoredSofaBeds.slice(0, 12).map(sofaBedProduct),
```

- [ ] **Step 4: `app/page.tsx` — type, tile, shelf**

Widen the `Summary` type (line ~29) with:

```ts
    sofaBeds: { count: number; saved: number; fits: number; sleepsApart: number; double: number };
```

and the `shelves` type (line ~37) with `sofaBeds: Product[];`.

Add the department tile after the Sofas tile (~line 193), matching its props exactly:

```tsx
                <DeptTile
                  href="/sofa-beds" icon="🛌" title="Sofa beds"
                  count={d.sofaBeds.fits} countLabel="meet the brief"
                  line={`of ${d.sofaBeds.count} researched · ${d.sofaBeds.sleepsApart} sleep on their own mattress`}
                />
```

Add the shelf after the Sofas shelf (~line 216), matching its props exactly:

```tsx
            <Shelf
              title="Sofa beds that seat three and sleep two"
              href="/sofa-beds" hrefLabel="Browse all sofa beds"
              items={s.shelves.sofaBeds}
              empty="No sofa beds researched yet."
            />
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx jest && npx next build`
Expected: all clean.

Then `npm run dev` and load `http://localhost:3000/` — confirm the tile and shelf render, the sidebar shows "Sofa beds", and nothing on the existing home page shifted or broke.

- [ ] **Step 6: Commit**

```bash
git add components/Sidebar.tsx app/api/summary/route.ts app/page.tsx
git commit -m "feat(sofa-beds): wire the vertical into the three nav places

The basket treats Sofa and Sofa bed as one slot: they are alternatives
for the same purchase, so once either is shortlisted the home page
stops listing the other as outstanding."
```

---

### Task 8: The research corpus

**Files:**
- Create: `docs/sofa-bed-search/design.csv`
- Create: `docs/sofa-bed-search/volume.csv`
- Create: `docs/sofa-bed-search/warehouse.csv`
- Create: `docs/sofa-bed-search/clearance.csv`
- Create: `docs/sofa-bed-search/secondhand.csv`

**Interfaces:**
- Consumes: `docs/sofa-bed-search/COLUMNS.md` (Task 4).
- Produces: the corpus `scripts/sofabeds-import.ts` reads.

**Dispatch these five agents at the START of Task 1** — they share no state with Tasks 1–7 and take the longest.

- [ ] **Step 1: Dispatch five research agents in parallel, one per bucket**

Each gets the brief below, with `YOUR TARGETS` and the output path swapped per this table:

| Bucket → file | YOUR TARGETS (do these only) |
|---|---|
| `design.csv` | Willow & Hall (the chaise-sofa-bed-with-storage specialist — the closest thing to a direct hit, start here), Loaf outlet, Snug via scs.co.uk and the official eBay outlet store, Sofa.com, Swoon, Arlo & Jacob, Dusk (Shopify — use `/collections/<handle>/products.json?limit=250`), Raft outlet |
| `volume.csv` | DFS, Sofology, ScS, Furniture Village, John Lewis, Habitat |
| `warehouse.csv` | IKEA — **FRIHETEN, HOLMSUND, VIMLE, BACKSÄLEN, LANDSKRONA**. FRIHETEN is a ~230cm storage-chaise corner sofa bed around £700 and is the benchmark row for this whole search, not an afterthought: get its full spec including seat depth, which IKEA actually publishes and almost nobody else does. Then Costco UK, Dunelm, Wayfair UK |
| `clearance.csv` | the outlet / ex-display / clearance sections of every retailer named in the three rows above |
| `secondhand.csv` | eBay UK, Gumtree, Vinterior, Narchie, Preloved, and any London-focused resale site you can reach. Facebook Marketplace needs a login — if you cannot reach it, say so rather than inventing listings. Set `condition=second-hand` and `one_off=yes` on every row, put the seller's location and any collection-only requirement in `notes`, and **say whether the mattress is included and its condition** |


> Research UK **sofa beds** for a buyer in London and write CSV rows.
>
> THE BRIEF — the buyer is choosing between a plain sofa and a sofa bed for the same spot, so this has to work as a **sofa** first:
> - Seats **3 people** (hard)
> - Folded width **200–250cm** (hard, BOTH ends — a compact 2-seater is not wanted at any price)
> - Opens to a bed **≥120cm wide** (hard)
> - Landed cost (price + delivery) **≤ £1,200** (record over-budget rows too, flagged)
> - Prefer overall depth ≥100cm; 112cm is ideal (the reference is the Raft "Loft Modular" — deep, low, modular, wide square arms, two big plump cushions across a 3-seat width). The buyer is 5'11" and wants that depth for leg support. **Record the real depth always.**
>
> THE FIELD THAT MATTERS MOST is `separate_mattress`: does a mattress fold out of the frame (you sit on real seat cushions), or is the seat itself the sleeping surface (click-clack/futon)? **If the listing does not make this unambiguous, leave it EMPTY.** Do not infer it from the product name. A guess here corrupts the ranking more than a missing value does.
>
> YOUR TARGETS (do these only): <bucket targets from spec §10>
>
> METHOD — plain WebFetch is blocked by most of these. Use:
> `curl -sL --http1.1 --compressed --max-time 60 -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" -H "Accept-Language: en-GB,en;q=0.9" -H "Upgrade-Insecure-Requests: 1" <url>`
> - Category pages usually embed products as JSON-LD `ItemList` in `<script type="application/ld+json">` — one request gives 30-60 products.
> - Shopify sites: `/collections/<handle>/products.json?limit=250` and `<product-url>.json`.
> - Sitemap fallback: `/robots.txt` → sitemap → filter for sofa-bed/sofabed/chaise.
> - Save HTML to your scratchpad and grep/parse with python3 rather than dumping huge output.
> - If a site blocks you, **say so in your final message rather than inventing listings.** Argos, Next and Bensons-class sites 403 even with a browser UA.
>
> OUTPUT: write a CSV to `docs/sofa-bed-search/<bucket>.csv`, using EXACTLY the header and rules in `docs/sofa-bed-search/COLUMNS.md` — read that file first.
>
> CRITICAL RULES:
> - Leave cells EMPTY when the retailer does not publish a value. **NEVER guess a dimension.**
> - `bed_width_cm` is the bed's WIDTH and `bed_length_cm` its LENGTH. A UK double is 135 × 190. Putting 190 in the width column is the single most common error here — check which way round you have it on every row.
> - `overall_depth_cm` is depth CLOSED; `extended_depth_cm` is how far it reaches into the room OPEN. Different numbers.
> - Record over-budget and out-of-stock rows, flagged, rather than dropping them.
> - Do not pad the file. If a retailer has nothing matching, return few rows and say so. A short honest file beats a long padded one.

- [ ] **Step 2: Sanity-check every returned CSV before importing**

For each file, run:

```bash
cd /Users/onuchukwu/Documents/Projects/london
for f in docs/sofa-bed-search/*.csv; do
  echo "== $f"
  python3 - "$f" <<'PY'
import csv, sys
rows = list(csv.DictReader(open(sys.argv[1])))
print(f"  {len(rows)} rows")
for r in rows:
    def n(k):
        v = (r.get(k) or "").strip()
        try: return float(v)
        except: return None
    bw, bl, w = n("bed_width_cm"), n("bed_length_cm"), n("overall_width_cm")
    if bw and bw > 185: print(f"  SUSPECT bed_width {bw} (a length?): {r['model']}")
    if bl and bl < 170: print(f"  SUSPECT bed_length {bl} (a width?): {r['model']}")
    if w and (w < 200 or w > 250): print(f"  out of width band {w}: {r['model']}")
    if (r.get("separate_mattress") or "").strip().lower() not in ("", "yes", "no"):
        print(f"  bad separate_mattress {r.get('separate_mattress')!r}: {r['model']}")
PY
done
```

Fix or empty any flagged cell by re-reading the source listing. **A suspect value must be emptied, not guessed at.**

- [ ] **Step 3: Import**

Run: `npx tsx scripts/sofabeds-import.ts`
Expected: a row count per file and a total. Re-run it once — the counts must be identical, proving idempotency.

- [ ] **Step 4: Read the result honestly**

Run: `npm run dev`, open `/sofa-beds`, and record in the commit message:
- how many rows clear all three gates inside budget,
- how many have `separateMattress === true`,
- whether the answer at £1,200 is new retail, clearance, or second-hand.

If nothing clears the gates, **say so** — spec Risk 1 predicted it, and reporting it is the correct outcome, not a failure to fix by loosening a gate.

- [ ] **Step 5: Commit**

```bash
git add docs/sofa-bed-search
git commit -m "feat(sofa-beds): research corpus — <N> rows across <M> sources

<One line on what the corpus actually says: how many clear all three
gates inside budget, and whether the route is new, clearance or
second-hand.>"
```

---

## Verification

After Task 8, the whole thing must pass in one go:

```bash
npx tsc --noEmit && npx jest && npx next build
```

And `/sofa-beds` must render the corpus with the default sort putting fit-passing, high-scoring rows first.
