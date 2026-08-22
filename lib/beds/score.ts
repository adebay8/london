// The recommendation ranking behind the default sort on /beds.
//
// DESIGN RULE: a missing spec must never be scored as a bad spec.
//
// Earlier versions gave unknown fields a low fractional value, which quietly
// conflated two different questions — "is this bed good?" and "how much do we
// know about it?". That systematically punished retailers whose sites are hard
// to scrape (Costco renders its spec table client-side; Furniture Village
// publishes dimensions only as a diagram image) and flattered retailers who
// happen to have verbose product pages. That is a measurement artefact, not a
// property of the bed.
//
// So each criterion now returns `null` when we have no evidence, and null is
// EXCLUDED from the average rather than counted as zero. Two numbers come out:
//
//   rawScore   quality on the criteria we actually measured (0-100)
//   confidence share of the criteria weight we have evidence for (0-1)
//
// A pure known-only average is volatile though: a bed where the single known
// fact is "assembly included" would score 100 on one data point. So the
// reported `score` shrinks rawScore toward the corpus median in proportion to
// how little evidence backs it (standard Bayesian shrinkage). Missing data
// therefore pulls a bed toward *average*, never toward *bad*, and never lets a
// one-fact bed leapfrog a fully-documented one.
//
// Weights follow the buying-criteria research (rows/_criteria.md §7).
import { BUDGET_CAP_GBP, MATTRESS_WIDTH_CM, SUITCASE_DEPTH_CM, type Bed } from "./types";

export interface ScoreReason {
  label: string;
  tone: "good" | "bad" | "unknown";
}

export interface ScoredBed extends Bed {
  /** Shrunk toward the corpus median by how little evidence we have. Sort key. */
  score: number;
  /** Quality on measured criteria only, ignoring everything unknown. */
  rawScore: number;
  /** 0-1 share of criteria weight backed by evidence. */
  confidence: number;
  reasons: ScoreReason[];
  /** Criteria we have no evidence for — reported, never penalised. */
  gaps: string[];
  clearsSuitcase: boolean | null;
}

/** How much evidence (in weight units, out of 100) a bed needs before its own
 *  measurements outweigh the corpus prior. At k=25 a bed with 25 units of
 *  evidence sits halfway between the prior and its own raw score. */
const SHRINKAGE_K = 25;

const CHIPBOARD = /chipboard|particle\s*board/i;
const VAGUE_ENGINEERED = /engineered wood|^wood$/i;
const SOLID = /solid (hardwood|pine|oak|timber|wood|rubberwood)|hardwood frame/i;
const PLY = /ply(wood)?|lvl|birch/i;
const MDF = /\bmdf\b/i;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** A criterion returns null when there is no evidence either way. */
interface Criterion {
  key: string;
  label: string;
  weight: number;
  evaluate: (b: Bed, out: ScoreReason[]) => number | null;
}

const CRITERIA: Criterion[] = [
  {
    key: "service",
    label: "Who assembles it",
    weight: 16,
    // Always known — every row states its assembly position.
    evaluate: (b, out) => {
      if (b.arrivesAssembled === "included") {
        out.push({ label: "Delivered & assembled in the price", tone: "good" });
        return 1;
      }
      if (b.arrivesAssembled === "paid") {
        out.push({ label: "Assembly available, charged separately", tone: "good" });
        return 0.62;
      }
      out.push({ label: "Self-assembly only", tone: "bad" });
      return 0.15;
    },
  },
  {
    key: "depth",
    label: "Storage depth",
    weight: 18,
    evaluate: (b, out) => {
      const d = b.storageDepthCm;
      if (d == null) return null;
      if (d >= SUITCASE_DEPTH_CM) {
        out.push({ label: `${d}cm deep — fits a hard-shell suitcase`, tone: "good" });
        return 1;
      }
      if (d >= 28) {
        out.push({ label: `${d}cm deep — soft bags and bedding only`, tone: "unknown" });
        return 0.6;
      }
      out.push({ label: `Only ${d}cm deep`, tone: "bad" });
      return 0.25;
    },
  },
  {
    key: "mechanism",
    label: "Gas struts",
    weight: 16,
    // 800N is correct for a 4FT6 — higher is NOT better, because the lid is
    // held shut by mattress weight alone and over-strutting pops it open.
    // Strut COUNT is the better tell: cheap beds use 2, leaving the lid centre
    // unsupported.
    evaluate: (b, out) => {
      const newtons = b.gasStrutRating ? Number(/(\d{3,4})\s*N/i.exec(b.gasStrutRating)?.[1] ?? NaN) : NaN;
      const count =
        b.strutCount ?? (b.gasStrutRating ? Number(/^\s*(\d)\s*[x×]/i.exec(b.gasStrutRating)?.[1] ?? NaN) : NaN);
      const isElectric = !!b.liftMechanism && /electric/i.test(b.liftMechanism);

      if (!Number.isFinite(newtons) && !Number.isFinite(count) && !isElectric) return null;

      let s = 0.5;
      if (Number.isFinite(count)) {
        if (count >= 4) {
          s += 0.35;
          out.push({ label: `${count} struts — lid centre supported`, tone: "good" });
        } else {
          s += 0.05;
          out.push({ label: `${count} struts`, tone: "unknown" });
        }
      }
      if (Number.isFinite(newtons)) {
        if (newtons >= 700 && newtons <= 900) {
          s += 0.2;
          out.push({ label: `${newtons}N — correct for a double`, tone: "good" });
        } else if (newtons > 900) {
          s += 0.02;
          out.push({ label: `${newtons}N — over-strutted for a double`, tone: "bad" });
        } else {
          out.push({ label: `${newtons}N — under-strutted for a double`, tone: "bad" });
        }
      }
      if (isElectric) {
        s += 0.05;
        out.push({ label: "Electric lift", tone: "good" });
      }
      return clamp01(s);
    },
  },
  {
    key: "frame",
    label: "Frame material",
    weight: 12,
    evaluate: (b, out) => {
      const m = b.frameMaterial;
      if (!m) return null;
      if (SOLID.test(m)) {
        out.push({ label: "Solid timber frame", tone: "good" });
        return 1;
      }
      if (PLY.test(m)) {
        out.push({ label: "Plywood/LVL frame", tone: "good" });
        return 0.8;
      }
      if (CHIPBOARD.test(m)) {
        out.push({ label: "Chipboard frame", tone: "bad" });
        return 0.2;
      }
      if (MDF.test(m)) {
        out.push({ label: "MDF frame", tone: "unknown" });
        return 0.45;
      }
      // "Engineered wood" with no further detail is a real, stated answer —
      // and the research reads it as chipboard-or-better-unstated. It is
      // evidence of vagueness, not absence of evidence, so it is scored low
      // but it IS scored.
      if (VAGUE_ENGINEERED.test(m)) {
        out.push({ label: `Frame stated only as "${m}"`, tone: "unknown" });
        return 0.35;
      }
      return 0.5;
    },
  },
  {
    key: "value",
    label: "Landed cost",
    weight: 12,
    // Always known. Saturates rather than rewarding the floor: sub-£300
    // ottomans in this dataset are consistently thin on spec.
    evaluate: (b, out) => {
      if (b.overBudget) {
        out.push({ label: `£${Math.round(b.landedCostGbp)} landed — over budget`, tone: "bad" });
        return 0;
      }
      return Math.min(clamp01((BUDGET_CAP_GBP - b.landedCostGbp) / (BUDGET_CAP_GBP - 300)), 0.95);
    },
  },
  {
    key: "footprint",
    label: "Footprint",
    weight: 8,
    evaluate: (b, out) => {
      const o = b.overhangCm ?? (b.overallWidthCm != null ? b.overallWidthCm - MATTRESS_WIDTH_CM : null);
      if (o == null) return null;
      if (o <= 6) {
        out.push({ label: `Only ${o.toFixed(0)}cm wider than the mattress`, tone: "good" });
        return 1;
      }
      if (o <= 12) return 0.7;
      if (o <= 20) return 0.45;
      out.push({ label: `${o.toFixed(0)}cm wider than the mattress`, tone: "bad" });
      return 0.15;
    },
  },
  {
    key: "opening",
    label: "Lift direction",
    weight: 8,
    // Small weight on purpose: the research ranks this #1, but only "checked
    // against the actual room", which we don't know. The FILTER is where the
    // user applies their own room constraint.
    evaluate: (b, out) => {
      if (b.openingDirection == null) return null;
      if (b.openingDirection === "either") {
        out.push({ label: "Opens either side — you choose at assembly", tone: "good" });
        return 1;
      }
      return b.openingDirection === "end" ? 0.85 : 0.6;
    },
  },
  {
    key: "base",
    label: "Base type",
    weight: 4,
    evaluate: (b, out) => {
      if (b.slatGapCm != null && b.slatGapCm > 7) {
        out.push({ label: `${b.slatGapCm}cm slat gap — may void a mattress warranty`, tone: "bad" });
      }
      const t = b.baseType;
      if (!t) return null;
      if (/sprung/i.test(t)) return 1;
      if (/slat/i.test(t)) return 0.8;
      if (/solid|platform/i.test(t)) {
        out.push({ label: "Solid platform base — least airflow", tone: "unknown" });
        return 0.35;
      }
      return 0.5;
    },
  },
  {
    key: "support",
    label: "Warranty & spares",
    weight: 6,
    evaluate: (b, out) => {
      const yrs = Number(/(\d+)\s*[- ]?\s*year/i.exec(b.warranty ?? "")?.[1] ?? NaN);
      const coversNo = !!b.warrantyCoversMechanism && /^no/i.test(b.warrantyCoversMechanism);
      const coversYes = !!b.warrantyCoversMechanism && /yes|cover/i.test(b.warrantyCoversMechanism);
      const spares = !!b.sparePartsAvailable && /^(yes|available|via)/i.test(b.sparePartsAvailable);
      if (!Number.isFinite(yrs) && !coversNo && !coversYes && !spares) return null;

      let s = 0.5;
      if (Number.isFinite(yrs)) {
        if (yrs >= 10) {
          s = 1;
          out.push({ label: `${yrs}-year guarantee`, tone: "good" });
        } else if (yrs >= 5) {
          s = 0.8;
          out.push({ label: `${yrs}-year guarantee`, tone: "good" });
        } else if (yrs <= 1) {
          s = 0.25;
          out.push({ label: "1-year guarantee only", tone: "bad" });
        } else s = 0.55;
      }
      if (coversNo) {
        s -= 0.2;
        out.push({ label: "Guarantee excludes the lift mechanism", tone: "bad" });
      } else if (coversYes) {
        s += 0.15;
        out.push({ label: "Guarantee covers the mechanism", tone: "good" });
      }
      if (spares) {
        s += 0.1;
        out.push({ label: "Spare parts available", tone: "good" });
      }
      return clamp01(s);
    },
  },
];

const TOTAL_WEIGHT = CRITERIA.reduce((a, c) => a + c.weight, 0);

interface Measured {
  rawScore: number; // 0-1 over measured criteria only
  confidence: number; // 0-1
  reasons: ScoreReason[];
  gaps: string[];
}

function measure(bed: Bed): Measured {
  const reasons: ScoreReason[] = [];
  const gaps: string[] = [];
  let sum = 0;
  let known = 0;

  for (const c of CRITERIA) {
    const v = c.evaluate(bed, reasons);
    if (v == null) {
      gaps.push(c.label);
      continue; // excluded from the average — NOT scored as zero
    }
    sum += v * c.weight;
    known += c.weight;
  }

  return {
    rawScore: known > 0 ? sum / known : 0.5,
    confidence: known / TOTAL_WEIGHT,
    reasons,
    gaps,
  };
}

const TONE_RANK = { good: 0, bad: 1, unknown: 2 } as const;

function finalise(bed: Bed, m: Measured, prior: number): ScoredBed {
  const knownWeight = m.confidence * TOTAL_WEIGHT;
  // Shrink toward the corpus prior in proportion to missing evidence.
  const shrunk = (m.rawScore * knownWeight + prior * SHRINKAGE_K) / (knownWeight + SHRINKAGE_K);

  return {
    ...bed,
    score: Math.round(shrunk * 1000) / 10,
    rawScore: Math.round(m.rawScore * 1000) / 10,
    confidence: Math.round(m.confidence * 100) / 100,
    reasons: m.reasons.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]),
    gaps: m.gaps,
    clearsSuitcase: bed.storageDepthCm == null ? null : bed.storageDepthCm >= SUITCASE_DEPTH_CM,
  };
}

/** Median rawScore of the well-evidenced beds. Using only confident rows keeps
 *  the prior from being dragged around by thin ones. */
function corpusPrior(measured: Measured[]): number {
  const solid = measured.filter((m) => m.confidence >= 0.5).map((m) => m.rawScore);
  const pool = solid.length >= 5 ? solid : measured.map((m) => m.rawScore);
  if (!pool.length) return 0.5;
  const s = [...pool].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function scoreAll(beds: Bed[]): ScoredBed[] {
  const measured = beds.map(measure);
  const prior = corpusPrior(measured);
  return beds.map((b, i) => finalise(b, measured[i], prior));
}

/** Single-bed scoring for callers without the corpus. Falls back to a neutral
 *  prior — prefer scoreAll(), which derives the prior from the real data. */
export function scoreBed(bed: Bed, prior = 0.5): ScoredBed {
  return finalise(bed, measure(bed), prior);
}

export { TOTAL_WEIGHT, CRITERIA };
