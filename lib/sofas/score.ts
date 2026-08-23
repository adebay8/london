// The recommendation ranking behind the default sort on /sofas.
//
// DESIGN RULE, inherited from lib/beds/score.ts and lib/consoles/score.ts:
// a missing spec must never be scored as a bad spec. Criteria return null when
// there is no evidence, null is excluded from the average rather than counted
// as zero, and the reported score is shrunk toward the corpus median in
// proportion to how little evidence backs it.
//
// That matters more here than anywhere else so far. Seat depth is the single
// most important number for this brief and almost no retailer publishes it,
// so scoring its absence as a failure would rank the corpus by how chatty the
// product page is rather than by how the sofa sits.
import { bodyDepthOf, fitFor, seatDepthOf, type Fit } from "./fit";
import {
  BUDGET_CAP_GBP,
  GOOD_SEAT_DEPTH_CM,
  LOUNGE_SEAT_DEPTH_CM,
  MAX_WIDTH_CM,
  MIN_USEFUL_DEPTH_CM,
  TARGET_DEPTH_CM,
  type Sofa,
} from "./types";

export interface ScoreReason {
  label: string;
  tone: "good" | "bad" | "unknown";
}

export interface ScoredSofa extends Sofa {
  score: number;
  rawScore: number;
  confidence: number;
  reasons: ScoreReason[];
  gaps: string[];
  fit: Fit;
  /** How closely it reads like the Raft Loft. Reported separately from the
   *  score so "comfortable and well built" and "looks like the reference" stay
   *  distinguishable — they are different questions. */
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
  evaluate: (s: Sofa, fit: Fit, out: ScoreReason[]) => number | null;
}

const CRITERIA: Criterion[] = [
  {
    key: "depth",
    label: "Depth",
    weight: 24,
    // The heaviest criterion, because it is the reason the user picked the
    // reference: at 5'11" the 112cm depth supports their legs.
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
    key: "seatDepth",
    label: "Seat depth",
    weight: 14,
    // Rarely published. When it is, it beats overall depth as evidence,
    // because it is the part that actually holds your legs.
    evaluate: (s, _f, out) => {
      const d = seatDepthOf(s);
      if (d == null) return null;
      if (d >= LOUNGE_SEAT_DEPTH_CM) {
        out.push({ label: `${d}cm seat — full lounging depth`, tone: "good" });
        return 1;
      }
      if (d >= GOOD_SEAT_DEPTH_CM) {
        out.push({ label: `${d}cm seat — supports the thigh`, tone: "good" });
        return 0.8;
      }
      out.push({ label: `${d}cm seat — legs hang off the front`, tone: "bad" });
      return 0.2;
    },
  },
  {
    key: "value",
    label: "Landed cost",
    weight: 14,
    evaluate: (s, _f, out) => {
      if (s.overBudget) {
        out.push({ label: `£${Math.round(s.landedCostGbp)} landed — over budget`, tone: "bad" });
        return 0;
      }
      if (s.rrpGbp && s.rrpGbp > s.landedCostGbp * 1.3) {
        out.push({
          label: `£${Math.round(s.landedCostGbp)} down from £${Math.round(s.rrpGbp)}`,
          tone: "good",
        });
      }
      return Math.min(clamp01((BUDGET_CAP_GBP - s.landedCostGbp) / (BUDGET_CAP_GBP - 250)), 0.95);
    },
  },
  {
    key: "filling",
    label: "Seat filling",
    weight: 10,
    // The reference's plumpness comes from feather. All-foam holds its shape
    // but never looks like the photo.
    evaluate: (s, _f, out) => {
      if (s.seatFilling == null) return null;
      if (s.seatFilling === "feather") {
        out.push({ label: "Feather-filled seats", tone: "good" });
        return 1;
      }
      if (s.seatFilling === "feather-blend" || s.seatFilling === "mixed") {
        out.push({ label: "Feather-blend seats", tone: "good" });
        return 0.85;
      }
      if (s.seatFilling === "fibre") return 0.5;
      return 0.4;
    },
  },
  {
    key: "frame",
    label: "Frame",
    weight: 10,
    evaluate: (s, _f, out) => {
      const m = s.frameMaterial;
      if (!m) return null;
      if (SOLID.test(m)) {
        out.push({ label: "Solid hardwood frame", tone: "good" });
        return 1;
      }
      if (CHIPBOARD.test(m)) {
        out.push({ label: "Chipboard frame", tone: "bad" });
        return 0.2;
      }
      return 0.55;
    },
  },
  {
    key: "fabric",
    label: "Fabric & covers",
    weight: 8,
    evaluate: (s, _f, out) => {
      if (s.easyClean == null && s.removableCovers == null && !s.fabric) return null;
      let v = 0.5;
      if (s.removableCovers) {
        v += 0.3;
        out.push({ label: "Removable, washable covers", tone: "good" });
      }
      if (s.easyClean) {
        v += 0.2;
        out.push({ label: "Easy-clean fabric", tone: "good" });
      }
      return clamp01(v);
    },
  },
  {
    key: "width",
    label: "Width",
    weight: 8,
    evaluate: (s, _f, out) => {
      const w = s.overallWidthCm;
      if (w == null) return null;
      if (w > MAX_WIDTH_CM) {
        out.push({ label: `${w}cm — wider than the wall allows`, tone: "bad" });
        return 0;
      }
      // Nearer the allowance is better: a bigger sofa for the same money, as
      // long as it still fits.
      return clamp01(0.5 + ((w - 180) / (MAX_WIDTH_CM - 180)) * 0.5);
    },
  },
  {
    key: "modular",
    label: "Modularity",
    weight: 6,
    // The reference is modular, which is also how it gets up a London
    // staircase. Worth real weight for a flat move.
    evaluate: (s, _f, out) => {
      if (s.modular == null) return null;
      if (s.modular) {
        out.push({ label: "Modular — reconfigurable, and easier to get upstairs", tone: "good" });
        return 1;
      }
      return 0.4;
    },
  },
  {
    key: "support",
    label: "Warranty & returns",
    weight: 6,
    evaluate: (s, _f, out) => {
      const yrs = Number(/(\d+)\s*[- ]?\s*year/i.exec(s.warranty ?? "")?.[1] ?? NaN);
      if (!Number.isFinite(yrs)) return null;
      if (yrs >= 10) {
        out.push({ label: `${yrs}-year guarantee`, tone: "good" });
        return 1;
      }
      if (yrs >= 5) return 0.8;
      if (yrs <= 1) return 0.3;
      return 0.55;
    },
  },
];

const TOTAL_WEIGHT = CRITERIA.reduce((a, c) => a + c.weight, 0);

/** 0-1, how closely this reads like the Raft Loft. Separate from the score:
 *  a sofa can be excellent and look nothing like the reference. */
function styleMatchOf(s: Sofa): number {
  const bits: number[] = [];
  const bd = bodyDepthOf(s);
  if (bd != null) bits.push(clamp01((bd - 85) / (TARGET_DEPTH_CM - 85)));
  if (s.modular != null) bits.push(s.modular ? 1 : 0.3);
  if (s.seatFilling != null) bits.push(/feather|mixed/.test(s.seatFilling) ? 1 : 0.4);
  if (s.armStyle) bits.push(/square|track|block|wide/i.test(s.armStyle) ? 1 : 0.3);
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

function measure(s: Sofa): Measured {
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

function finalise(s: Sofa, m: Measured, prior: number): ScoredSofa {
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

export function scoreAll(sofas: Sofa[]): ScoredSofa[] {
  const measured = sofas.map(measure);
  const prior = corpusPrior(measured);
  return sofas.map((s, i) => finalise(s, measured[i], prior));
}

export function scoreSofa(s: Sofa, prior = 0.5): ScoredSofa {
  return finalise(s, measure(s), prior);
}

export { TOTAL_WEIGHT, CRITERIA };
