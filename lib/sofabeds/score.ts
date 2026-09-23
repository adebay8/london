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
import { bedWidthOf, bodyDepthOf, budgetVerdict, fitFor, seatDepthOf, type Fit } from "./fit";
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
      if (c > BUDGET_CAP_GBP) {
        out.push({ label: `£${Math.round(c)} landed — £${Math.round(c - BUDGET_CAP_GBP)} over budget`, tone: "bad" });
        return clamp01(1 - (c - BUDGET_CAP_GBP) / BUDGET_CAP_GBP) * 0.4;
      }
      // The score is unchanged either way — only what we claim about it is.
      // With delivery unpublished the figure is a floor, so "inside budget"
      // would be an assertion the data does not support (spec §8).
      if (budgetVerdict(s) === "unknown") {
        out.push({
          label: `£${Math.round(c)}+ landed — a floor, delivery not published`,
          tone: "unknown",
        });
      } else {
        out.push({ label: `£${Math.round(c)} landed — inside budget`, tone: "good" });
      }
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
