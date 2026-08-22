// The recommendation ranking behind the default sort on /consoles.
//
// DESIGN RULE: a missing spec must never be scored as a bad spec.
//
// Same machinery as lib/beds/score.ts, and for the same reason — scoring an
// unpublished field as zero conflates "is this console good?" with "how much
// does this retailer publish?", which punishes the retailers whose product
// pages are thin rather than the products that are. That distortion is worse
// here than it was for beds: bed retailers advertised storage depth because it
// sells the bed, whereas nobody sells a TV unit on "fits a PS5", so internal
// dimensions go unpublished far more often.
//
// Each criterion returns `null` when there is no evidence, and null is
// EXCLUDED from the average rather than counted as zero. Two numbers come out:
//
//   rawScore   quality on the criteria we actually measured (0-100)
//   confidence share of the criteria weight we have evidence for (0-1)
//
// The reported `score` then shrinks rawScore toward the corpus median in
// proportion to how little evidence backs it, so a thinly-documented console
// is pulled toward *average*, never toward *bad*, and a one-fact console can
// never leapfrog a fully-documented one.
//
// Weights follow the spec (§7).
import { closedStorageLitres, fitFor, largestOpenBay, type Fit } from "./fit";
import {
  BUDGET_CAP_GBP,
  COMFORT_TOP_DEPTH_CM,
  MAX_OVERALL_WIDTH_CM,
  MIN_OVERALL_WIDTH_CM,
  MIN_TOP_DEPTH_CM,
  MIN_TOP_LOAD_KG,
  MIN_TOP_WIDTH_CM,
  PREFERRED_TOP_WIDTH_CM,
  PS5_BAY_DEPTH_CM,
  PS5_BAY_HEIGHT_CM,
  PS5_BAY_WIDTH_CM,
  TOP_LOAD_KG,
  type TvConsole,
} from "./types";

export interface ScoreReason {
  label: string;
  tone: "good" | "bad" | "unknown";
}

export interface ScoredConsole extends TvConsole {
  /** Shrunk toward the corpus median by how little evidence we have. Sort key. */
  score: number;
  /** Quality on measured criteria only, ignoring everything unknown. */
  rawScore: number;
  /** 0-1 share of criteria weight backed by evidence. */
  confidence: number;
  reasons: ScoreReason[];
  /** Criteria we have no evidence for — reported, never penalised. */
  gaps: string[];
  fit: Fit;
}

/** How much evidence (in weight units, out of 100) a console needs before its
 *  own measurements outweigh the corpus prior. */
const SHRINKAGE_K = 25;

const CHIPBOARD = /chipboard|particle\s*board/i;
const VAGUE_ENGINEERED = /engineered wood|^wood$/i;
const SOLID = /solid (hardwood|pine|oak|walnut|timber|wood|mango|acacia|rubberwood)|hardwood/i;
const PLY = /ply(wood)?|lvl|birch/i;
const MDF = /\bmdf\b/i;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

interface Criterion {
  key: string;
  label: string;
  weight: number;
  evaluate: (c: TvConsole, fit: Fit, out: ScoreReason[]) => number | null;
}

const CRITERIA: Criterion[] = [
  {
    key: "ps5",
    label: "PS5 housing",
    weight: 18,
    // Graduated, and route-aware. A bay that clears the requirement by a wide
    // margin is genuinely better than one that scrapes it, because the slack is
    // what the console uses for airflow. Standing it upright on the top passes,
    // but scores below any bay: it is on show, it eats top surface next to the
    // TV, and it needs the vertical stand Sony sells separately.
    evaluate: (c, fit, out) => {
      if (fit.ps5 === "unknown") return null;
      if (fit.ps5 === "fail") {
        out.push({ label: "Nowhere to put the PS5", tone: "bad" });
        return 0;
      }
      if (fit.ps5Route === "top") {
        out.push({ label: "PS5 stands upright beside the TV — no bay for it", tone: "unknown" });
        return 0.55;
      }
      const b = largestOpenBay(c.bays);
      if (!b) return 0.8;
      const slack = Math.min(
        (b.widthCm ?? 0) - PS5_BAY_WIDTH_CM,
        (b.depthCm ?? 0) - PS5_BAY_DEPTH_CM,
        ((b.heightCm ?? 0) - PS5_BAY_HEIGHT_CM) * 2, // height is the scarcest axis
      );
      if (slack >= 4) {
        out.push({ label: "Open bay takes a PS5 with airflow to spare", tone: "good" });
        return 1;
      }
      out.push({ label: "Open bay takes a PS5, but only just", tone: "unknown" });
      return 0.78;
    },
  },
  {
    key: "depth",
    label: "Top depth",
    weight: 16,
    evaluate: (c, _fit, out) => {
      const d = c.topDepthCm;
      if (d == null) return null;
      if (d >= COMFORT_TOP_DEPTH_CM) {
        out.push({ label: `${d}cm deep — TV base, soundbar and a cable gap`, tone: "good" });
        return 1;
      }
      if (d >= MIN_TOP_DEPTH_CM) {
        out.push({ label: `${d}cm deep — bar fits in front, but no cable slack`, tone: "unknown" });
        return 0.65;
      }
      out.push({ label: `${d}cm deep — too shallow for the bar in front`, tone: "bad" });
      return 0;
    },
  },
  {
    key: "material",
    label: "Carcass material",
    weight: 12,
    evaluate: (c, _fit, out) => {
      const m = c.frameMaterial;
      if (!m) return null;
      if (SOLID.test(m)) {
        out.push({ label: "Solid timber carcass", tone: "good" });
        return 1;
      }
      if (PLY.test(m)) {
        out.push({ label: "Plywood carcass", tone: "good" });
        return 0.8;
      }
      if (CHIPBOARD.test(m)) {
        out.push({ label: "Chipboard carcass", tone: "bad" });
        return 0.2;
      }
      if (MDF.test(m)) return 0.45;
      // A stated-but-vague answer is evidence of vagueness, not absence of
      // evidence. It is scored low, but it IS scored.
      if (VAGUE_ENGINEERED.test(m)) {
        out.push({ label: `Carcass stated only as "${m}"`, tone: "unknown" });
        return 0.35;
      }
      return 0.5;
    },
  },
  {
    key: "value",
    label: "Landed cost",
    weight: 12,
    // Always known. Saturates rather than rewarding the floor: the cheapest
    // units in this corpus are consistently the thinnest on spec.
    evaluate: (c, _fit, out) => {
      if (c.overBudget) {
        out.push({ label: `£${Math.round(c.landedCostGbp)} landed — over budget`, tone: "bad" });
        return 0;
      }
      return Math.min(clamp01((BUDGET_CAP_GBP - c.landedCostGbp) / (BUDGET_CAP_GBP - 120)), 0.95);
    },
  },
  {
    key: "ventilation",
    label: "Ventilation & cabling",
    weight: 8,
    // Real weight because a PS5 AND an ethernet switch share this enclosure.
    evaluate: (c, _fit, out) => {
      const cable = c.cableManagement;
      if (c.backPanel == null && !cable) return null;
      let s = 0.5;
      if (c.backPanel === "open") {
        s = 1;
        out.push({ label: "Open back — heat and cables both get out", tone: "good" });
      } else if (c.backPanel === "ported") {
        s = 0.8;
        out.push({ label: "Ported back panel", tone: "good" });
      } else if (c.backPanel === "solid") {
        s = 0.2;
        out.push({ label: "Solid back — poor for a PS5 and a switch", tone: "bad" });
      }
      if (cable) s = clamp01(s + 0.1);
      return s;
    },
  },
  {
    key: "load",
    label: "Load rating",
    weight: 8,
    evaluate: (c, _fit, out) => {
      const kg = c.topLoadKg;
      if (kg == null) return null;
      if (kg >= MIN_TOP_LOAD_KG) {
        out.push({ label: `${kg}kg rated — comfortable over the ${TOP_LOAD_KG}kg load`, tone: "good" });
        return 1;
      }
      if (kg >= TOP_LOAD_KG) {
        out.push({ label: `${kg}kg rated — carries the ${TOP_LOAD_KG}kg load with little margin`, tone: "unknown" });
        return 0.5;
      }
      out.push({ label: `${kg}kg rated — under the ${TOP_LOAD_KG}kg of TV and soundbar`, tone: "bad" });
      return 0;
    },
  },
  {
    key: "width",
    label: "Width & proportion",
    weight: 8,
    evaluate: (c, _fit, out) => {
      const w = c.overallWidthCm ?? c.topWidthCm;
      if (w == null) return null;
      if (w < MIN_TOP_WIDTH_CM) {
        out.push({ label: `${w}cm — narrower than the TV stand`, tone: "bad" });
        return 0;
      }
      if (w < PREFERRED_TOP_WIDTH_CM) {
        out.push({ label: `${w}cm — narrower than the TV itself`, tone: "bad" });
        return 0.3;
      }
      if (w >= MIN_OVERALL_WIDTH_CM && w <= MAX_OVERALL_WIDTH_CM) {
        out.push({ label: `${w}cm — sits in the wall allowance`, tone: "good" });
        return 1;
      }
      if (w > MAX_OVERALL_WIDTH_CM) {
        out.push({ label: `${w}cm — wider than the wall allows`, tone: "bad" });
        return 0.1;
      }
      return 0.7; // between the TV width and the 150cm preference
    },
  },
  {
    key: "storage",
    label: "Closed storage",
    weight: 8,
    // Games, discs and controllers. Books are explicitly out of scope.
    evaluate: (c, _fit, out) => {
      const litres = closedStorageLitres(c.bays);
      if (litres == null) return null;
      if (litres >= 90) {
        out.push({ label: `~${litres}L closed storage`, tone: "good" });
        return 1;
      }
      if (litres >= 45) return 0.7;
      if (litres > 0) return 0.4;
      return 0.1;
    },
  },
  {
    key: "service",
    label: "Who assembles it",
    weight: 6,
    evaluate: (c, _fit, out) => {
      if (c.arrivesAssembled === "included") {
        out.push({ label: "Delivered & assembled in the price", tone: "good" });
        return 1;
      }
      if (c.arrivesAssembled === "paid") return 0.62;
      return 0.15;
    },
  },
  {
    key: "support",
    label: "Warranty & returns",
    weight: 4,
    evaluate: (c, _fit, out) => {
      const yrs = Number(/(\d+)\s*[- ]?\s*year/i.exec(c.warranty ?? "")?.[1] ?? NaN);
      const spares = !!c.sparePartsAvailable && /^(yes|available|via)/i.test(c.sparePartsAvailable);
      if (!Number.isFinite(yrs) && !spares) return null;
      let s = 0.5;
      if (Number.isFinite(yrs)) {
        if (yrs >= 10) {
          s = 1;
          out.push({ label: `${yrs}-year guarantee`, tone: "good" });
        } else if (yrs >= 5) s = 0.8;
        else if (yrs <= 1) s = 0.25;
        else s = 0.55;
      }
      if (spares) s = clamp01(s + 0.1);
      return s;
    },
  },
];

const TOTAL_WEIGHT = CRITERIA.reduce((a, c) => a + c.weight, 0);

interface Measured {
  rawScore: number;
  confidence: number;
  reasons: ScoreReason[];
  gaps: string[];
  fit: Fit;
}

function measure(c: TvConsole): Measured {
  const reasons: ScoreReason[] = [];
  const gaps: string[] = [];
  const fit = fitFor(c);
  let sum = 0;
  let known = 0;

  for (const crit of CRITERIA) {
    const v = crit.evaluate(c, fit, reasons);
    if (v == null) {
      gaps.push(crit.label);
      continue; // excluded from the average — NOT scored as zero
    }
    sum += v * crit.weight;
    known += crit.weight;
  }

  return {
    rawScore: known > 0 ? sum / known : 0.5,
    confidence: known / TOTAL_WEIGHT,
    reasons,
    gaps,
    fit,
  };
}

const TONE_RANK = { good: 0, bad: 1, unknown: 2 } as const;

function finalise(c: TvConsole, m: Measured, prior: number): ScoredConsole {
  const knownWeight = m.confidence * TOTAL_WEIGHT;
  const shrunk = (m.rawScore * knownWeight + prior * SHRINKAGE_K) / (knownWeight + SHRINKAGE_K);

  return {
    ...c,
    score: Math.round(shrunk * 1000) / 10,
    rawScore: Math.round(m.rawScore * 1000) / 10,
    confidence: Math.round(m.confidence * 100) / 100,
    reasons: m.reasons.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]),
    gaps: m.gaps,
    fit: m.fit,
  };
}

/** Median rawScore of the well-evidenced consoles. Using only confident rows
 *  keeps the prior from being dragged around by thin ones. */
function corpusPrior(measured: Measured[]): number {
  const solid = measured.filter((m) => m.confidence >= 0.5).map((m) => m.rawScore);
  const pool = solid.length >= 5 ? solid : measured.map((m) => m.rawScore);
  if (!pool.length) return 0.5;
  const s = [...pool].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function scoreAll(consoles: TvConsole[]): ScoredConsole[] {
  const measured = consoles.map(measure);
  const prior = corpusPrior(measured);
  return consoles.map((c, i) => finalise(c, measured[i], prior));
}

/** Single-item scoring for callers without the corpus. Prefer scoreAll(). */
export function scoreConsole(c: TvConsole, prior = 0.5): ScoredConsole {
  return finalise(c, measure(c), prior);
}

export { TOTAL_WEIGHT, CRITERIA };
