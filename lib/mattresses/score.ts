// The recommendation ranking behind the default sort on /mattresses.
//
// DESIGN RULE, inherited from lib/beds, lib/consoles and lib/sofas: a missing
// spec must never be scored as a bad spec. Criteria return null when there is
// no evidence, null is excluded from the average rather than counted as zero,
// and the reported score is shrunk toward the corpus median in proportion to
// how little evidence backs it.
//
// SECOND RULE, specific to this search: nothing here imports deal.ts. How big
// the discount is has no bearing on how good the mattress is, and a category
// this full of invented "was" prices would rank the least honest listing first
// if it did. Price enters the ranking once, as landed cost, and that is all.
import { depthOf, firmnessDistance, firmnessOf, fitFor, type Fit } from "./fit";
import {
  BUDGET_CAP_GBP,
  GENEROUS_DEPTH_CM,
  GOOD_TRIAL_NIGHTS,
  GREAT_TRIAL_NIGHTS,
  MIN_USEFUL_DEPTH_CM,
  SPRINGS_GOOD,
  SPRINGS_PLATEAU,
  type Mattress,
} from "./types";

export interface ScoreReason {
  label: string;
  tone: "good" | "bad" | "unknown";
}

export interface ScoredMattress extends Mattress {
  score: number;
  rawScore: number;
  confidence: number;
  reasons: ScoreReason[];
  gaps: string[];
  fit: Fit;
}

const SHRINKAGE_K = 25;
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

interface Criterion {
  key: string;
  label: string;
  weight: number;
  evaluate: (m: Mattress, fit: Fit, out: ScoreReason[]) => number | null;
}

const CRITERIA: Criterion[] = [
  {
    key: "firmness",
    label: "Firmness",
    weight: 22,
    // The heaviest criterion by some distance. Firmness is what people
    // actually return mattresses over — far more than springs, filling or any
    // of the material the listing leads with.
    evaluate: (m, _f, out) => {
      const read = firmnessOf(m);
      if (read.value == null) return null;
      const d = firmnessDistance(read.value);
      if (d === 0) {
        out.push({ label: `${read.value} — right for side and back nights`, tone: "good" });
        return 1;
      }
      if (d === 1) {
        // One bucket out: medium-soft is survivable, firm is the classic
        // shoulder-pain mistake for anyone who sleeps on their side.
        const soft = read.value === "medium-soft" || read.value === "soft";
        out.push({
          label: soft ? `${read.value} — hips may sink on back nights` : `${read.value} — hard on the shoulder side-on`,
          tone: "unknown",
        });
        return 0.55;
      }
      out.push({ label: `${read.value} — wrong end of the scale for how you sleep`, tone: "bad" });
      return 0.15;
    },
  },
  {
    key: "springs",
    label: "Spring type",
    weight: 14,
    // Matters most because the bed is shared: open coils are wired together,
    // so one person turning over moves the other. Pocket springs move
    // independently.
    evaluate: (m, _f, out) => {
      const t = m.springType ?? (m.type === "memory-foam" || m.type === "foam" ? "none" : null);
      if (t == null) return null;
      if (t === "pocket") {
        out.push({ label: "Pocket springs — each moves alone, so sharing works", tone: "good" });
        return 1;
      }
      if (t === "continuous") return 0.5;
      if (t === "none") {
        // All-foam isolates motion well, but has weak edges and no give when
        // you change position — the thing a combination sleeper notices.
        out.push({ label: "All foam — quiet to share, but slow to turn on and weak at the edge", tone: "unknown" });
        return 0.6;
      }
      out.push({ label: "Open coil — one wire mesh, so you feel every movement", tone: "bad" });
      return 0.15;
    },
  },
  {
    key: "trial",
    label: "Sleep trial",
    weight: 14,
    // Weighted like a headline spec on purpose. You cannot tell whether a
    // mattress suits you by lying on it in a showroom for ninety seconds, so
    // the right to send it back after a month of real nights is worth more
    // than most of what the listing brags about.
    evaluate: (m, _f, out) => {
      if (m.trialNights == null) return null;
      let v: number;
      if (m.trialNights >= GREAT_TRIAL_NIGHTS) {
        out.push({ label: `${m.trialNights}-night trial`, tone: "good" });
        v = 1;
      } else if (m.trialNights >= GOOD_TRIAL_NIGHTS) {
        out.push({ label: `${m.trialNights}-night trial`, tone: "good" });
        v = 0.8;
      } else if (m.trialNights >= 30) {
        v = 0.5;
      } else {
        out.push({ label: `Only ${m.trialNights} nights to change your mind`, tone: "bad" });
        v = 0.25;
      }
      // A trial you have to pay £50 to use is not a trial.
      if (m.trialFreeReturns === false) {
        out.push({ label: "Returns are chargeable — the trial costs you to use", tone: "bad" });
        v *= 0.6;
      }
      return clamp01(v);
    },
  },
  {
    key: "value",
    label: "Landed cost",
    weight: 12,
    // Landed = item + delivery + taking the old one away. The only comparable
    // figure, and the ONLY way price enters the ranking. No discount here.
    evaluate: (m, _f, out) => {
      if (m.overBudget) {
        out.push({ label: `£${Math.round(m.landedCostGbp)} landed — over budget`, tone: "bad" });
        return 0;
      }
      return Math.min(clamp01((BUDGET_CAP_GBP - m.landedCostGbp) / (BUDGET_CAP_GBP - 150)), 0.95);
    },
  },
  {
    key: "depth",
    label: "Depth",
    weight: 10,
    evaluate: (m, _f, out) => {
      const d = depthOf(m);
      if (d == null) return null;
      if (d >= GENEROUS_DEPTH_CM) {
        out.push({ label: `${d}cm deep — plenty of comfort layer`, tone: "good" });
        return 1;
      }
      if (d >= 24) return 0.85;
      if (d >= MIN_USEFUL_DEPTH_CM) return 0.6;
      out.push({ label: `${d}cm deep — thin for a main bed`, tone: "bad" });
      return 0.2;
    },
  },
  {
    key: "warranty",
    label: "Warranty",
    weight: 8,
    evaluate: (m, _f, out) => {
      if (m.warrantyYears == null) return null;
      if (m.warrantyYears >= 10) {
        out.push({ label: `${m.warrantyYears}-year guarantee`, tone: "good" });
        return 1;
      }
      if (m.warrantyYears >= 5) return 0.75;
      if (m.warrantyYears <= 1) return 0.25;
      return 0.5;
    },
  },
  {
    key: "reviews",
    label: "Owner reviews",
    weight: 8,
    // Weighted by how many people left them: 4.8 from nine reviewers says
    // less than 4.4 from four thousand.
    evaluate: (m, _f, out) => {
      if (m.reviewScore == null) return null;
      const n = m.reviewCount ?? 0;
      const weight = clamp01(n / 300);
      const v = clamp01((m.reviewScore - 3) / 2) * (0.5 + 0.5 * weight);
      if (m.reviewScore >= 4.5 && n >= 300) {
        out.push({ label: `${m.reviewScore} from ${n.toLocaleString()} owners`, tone: "good" });
      }
      return v;
    },
  },
  {
    key: "springCount",
    label: "Spring count",
    weight: 6,
    // Deliberately the lightest criterion in the list, and saturating.
    //
    // A double is 135cm wide whatever the marketing says, so more springs
    // means THINNER springs — a 3,000-count double is finer wire that fatigues
    // sooner than a 1,000-count. Counts above ~2,000 are usually padded by
    // counting mini-springs stacked in a second layer as well. Past the
    // plateau, extra springs earn nothing.
    evaluate: (m, _f, out) => {
      if (m.springCount == null) return null;
      if (m.springCount > SPRINGS_PLATEAU) {
        out.push({
          label: `${m.springCount.toLocaleString()} springs — past the point where more helps`,
          tone: "unknown",
        });
        return 0.8;
      }
      if (m.springCount >= SPRINGS_GOOD) return clamp01(0.8 + ((m.springCount - SPRINGS_GOOD) / (SPRINGS_PLATEAU - SPRINGS_GOOD)) * 0.2);
      return clamp01(0.3 + (m.springCount / SPRINGS_GOOD) * 0.5);
    },
  },
  {
    key: "tested",
    label: "Independent test",
    weight: 6,
    // The only evidence in this category that nobody selling the mattress
    // wrote. Rare, so it is light — but it counts for real when present.
    evaluate: (m, _f, out) => {
      if (m.testScore == null || !m.testedBy) return null;
      const v = clamp01(m.testScore / 100);
      if (v >= 0.7) out.push({ label: `${m.testedBy} scored it ${m.testScore}%`, tone: "good" });
      else out.push({ label: `${m.testedBy} scored it only ${m.testScore}%`, tone: "bad" });
      return v;
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

function measure(m: Mattress): Measured {
  const reasons: ScoreReason[] = [];
  const gaps: string[] = [];
  const fit = fitFor(m);
  let sum = 0;
  let known = 0;
  for (const c of CRITERIA) {
    const v = c.evaluate(m, fit, reasons);
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

function finalise(m: Mattress, meas: Measured, prior: number): ScoredMattress {
  const knownWeight = meas.confidence * TOTAL_WEIGHT;
  const shrunk = (meas.rawScore * knownWeight + prior * SHRINKAGE_K) / (knownWeight + SHRINKAGE_K);
  return {
    ...m,
    score: Math.round(shrunk * 1000) / 10,
    rawScore: Math.round(meas.rawScore * 1000) / 10,
    confidence: Math.round(meas.confidence * 100) / 100,
    reasons: meas.reasons.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]),
    gaps: meas.gaps,
    fit: meas.fit,
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

export function scoreAll(mattresses: Mattress[]): ScoredMattress[] {
  const measured = mattresses.map(measure);
  const prior = corpusPrior(measured);
  return mattresses.map((m, i) => finalise(m, measured[i], prior));
}

export function scoreMattress(m: Mattress, prior = 0.5): ScoredMattress {
  return finalise(m, measure(m), prior);
}

export { TOTAL_WEIGHT, CRITERIA };
