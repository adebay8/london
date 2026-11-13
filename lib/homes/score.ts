// Weighted ranking for the buying search. Pure, so both pages and the tests
// share one definition.
//
// Filters rule homes out (dealbreakers); this weighs the trade-offs: a fast
// train can make up for a higher price. Each factor is scored 0–1 on a FIXED
// scale taken from the brief, never relative to what's on screen, so a filter
// never changes a home's score. Unknown counts as 0.5, neither good nor bad,
// so homes with sparse listings aren't punished for it.
import { STATIONS } from "./stations";
import { BRIEF, homeKind, isNewBuildBlock, type HomeListing } from "./types";

export type CriterionId =
  | "trainTime" | "frequency" | "price" | "pricePerBed" | "walk" | "kind"
  | "garden" | "floorArea" | "ownership" | "beds" | "baths";
export type Weight = 0 | 1 | 2 | 3;
export type Weights = Record<CriterionId, Weight>;
export type Factors = Record<CriterionId, number | null>;
export type PresetId = "balanced" | "commute" | "value" | "own" | "grow";

/** The fields scoring reads. */
export type Scorable = Pick<
  HomeListing,
  | "townId" | "priceGbp" | "beds" | "baths" | "distanceMiles" | "garden" | "floorAreaSqFt"
  | "tenure" | "leaseYears" | "serviceChargePa" | "propertyType" | "newBuild" | "keyFeatures"
>;

export interface Criterion {
  id: CriterionId;
  label: string;
  level: "town" | "home";
  hint: string;
}

export const CRITERIA: Criterion[] = [
  { id: "trainTime", label: "Train time", level: "town", hint: "15 min is best, 45 min worst" },
  { id: "frequency", label: "Trains an hour", level: "town", hint: "Morning peak, into London (approximate)" },
  { id: "price", label: "Price", level: "home", hint: "£200k best, £500k worst" },
  { id: "pricePerBed", label: "Price per bedroom", level: "home", hint: "£80k a bedroom best, £230k worst" },
  { id: "walk", label: "Walk to station", level: "home", hint: "Quarter mile best, a mile worst" },
  { id: "kind", label: "House over flat", level: "home", hint: "House, then maisonette, flat, new-build block" },
  { id: "garden", label: "Garden", level: "home", hint: "Where the listing says" },
  { id: "floorArea", label: "Floor area", level: "home", hint: "900 sq ft best, 500 worst" },
  { id: "ownership", label: "Cost to own", level: "home", hint: "Freehold, or a long lease with low service charge" },
  { id: "beds", label: "Bedrooms", level: "home", hint: "3 over 2" },
  { id: "baths", label: "Bathrooms", level: "home", hint: "2 or more over 1" },
];

export const ZERO: Weights = {
  trainTime: 0, frequency: 0, price: 0, pricePerBed: 0, walk: 0, kind: 0,
  garden: 0, floorArea: 0, ownership: 0, beds: 0, baths: 0,
};

export const PRESETS: { id: PresetId; label: string; question: string; weights: Weights }[] = [
  {
    id: "balanced", label: "Balanced", question: "Overall, what's best?",
    weights: { ...ZERO, trainTime: 2, price: 2, kind: 2, walk: 2, frequency: 1, pricePerBed: 1, garden: 1, beds: 1 },
  },
  {
    id: "commute", label: "Easy commute", question: "Least hassle getting into London",
    weights: { ...ZERO, trainTime: 3, frequency: 3, walk: 2, price: 1 },
  },
  {
    id: "value", label: "Most home for the money", question: "Where does the budget stretch furthest?",
    weights: { ...ZERO, pricePerBed: 3, kind: 2, garden: 2, floorArea: 2, price: 1 },
  },
  {
    id: "own", label: "Cheapest to own", question: "What costs least year after year?",
    weights: { ...ZERO, ownership: 3, price: 3, kind: 2 },
  },
  {
    id: "grow", label: "Room to grow", question: "Will it still work in five years?",
    weights: { ...ZERO, beds: 3, kind: 3, garden: 2, baths: 2, floorArea: 1 },
  },
];

export const BALANCED = PRESETS[0].weights;

export function presetOf(w: Weights): PresetId | null {
  return PRESETS.find((p) => CRITERIA.every((c) => p.weights[c.id] === w[c.id]))?.id ?? null;
}

/** Stored weights → valid Weights, or Balanced if anything is off. */
export function readWeights(json: string | null): Weights {
  try {
    const o = JSON.parse(json ?? "") as Record<string, unknown>;
    const out = { ...ZERO };
    for (const c of CRITERIA) {
      const v = o?.[c.id];
      if (v !== 0 && v !== 1 && v !== 2 && v !== 3) return BALANCED;
      out[c.id] = v;
    }
    return out;
  } catch {
    return BALANCED;
  }
}

/** 0 at `worst`, 1 at `best`, clamped. Works whichever way round they are. */
const scale = (v: number, worst: number, best: number) => Math.min(1, Math.max(0, (v - worst) / (best - worst)));

function trainFactors(townId: string): Pick<Factors, "trainTime" | "frequency"> {
  const s = STATIONS[townId];
  return {
    trainTime: s ? scale(s.mins, 45, 15) : null,
    frequency: s ? scale(s.peakPerHour, 2, 12) : null,
  };
}

function ownership(l: Scorable): number | null {
  if (l.tenure === "freehold") return 1;
  if (l.tenure === "share-of-freehold") return 0.8;
  if (l.tenure !== "leasehold") return null;
  const parts = [
    l.leaseYears != null ? scale(l.leaseYears, BRIEF.minLeaseYears, 125) : null,
    l.serviceChargePa != null ? scale(l.serviceChargePa, BRIEF.serviceChargeFlagGbp, 1_000) : null,
  ].filter((x): x is number => x != null);
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
}

export function homeFactors(l: Scorable): Factors {
  const kind = homeKind(l);
  return {
    ...trainFactors(l.townId),
    price: scale(l.priceGbp, BRIEF.maxPriceGbp, BRIEF.minPriceGbp),
    pricePerBed: l.beds ? scale(l.priceGbp / l.beds, 230_000, 80_000) : null,
    walk: l.distanceMiles != null ? scale(l.distanceMiles, 1, 0.25) : null,
    kind: kind === "house" ? 1 : kind === "maisonette" ? 0.6 : isNewBuildBlock(l) ? 0 : 0.3,
    garden: l.garden == null ? null : l.garden ? 1 : 0,
    floorArea: l.floorAreaSqFt != null && l.floorAreaSqFt >= 200 ? scale(l.floorAreaSqFt, 500, 900) : null,
    ownership: ownership(l),
    beds: scale(l.beds, 2, 3),
    baths: l.baths == null ? null : l.baths >= 2 ? 1 : 0,
  };
}

/** Weighted mean as 0–100; unknown = 0.5. Null when nothing is weighted. */
export function scoreFactors(f: Factors, w: Weights): number | null {
  let sum = 0;
  let total = 0;
  for (const c of CRITERIA) {
    if (!w[c.id]) continue;
    sum += w[c.id] * (f[c.id] ?? 0.5);
    total += w[c.id];
  }
  return total ? Math.round((100 * sum) / total) : null;
}

export const scoreHome = (l: Scorable, w: Weights) => scoreFactors(homeFactors(l), w);

/** A town: its station, plus the average of each home factor across its live
 *  homes (an average rather than a median, since several are yes/no). */
export function townFactors(townId: string, homes: Scorable[]): Factors {
  const each = homes.map(homeFactors);
  const avg = (id: CriterionId) => {
    const known = each.map((f) => f[id]).filter((v): v is number => v != null);
    return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
  };
  const out = { ...trainFactors(townId) } as Factors;
  for (const c of CRITERIA) if (c.level === "home") out[c.id] = avg(c.id);
  // Listings mention a garden only when there is one, so every known value
  // is "yes". For a town, the share that list one is what tells towns apart:
  // half or more scores full marks.
  out.garden = homes.length ? scale(gardenShare(homes), 0, 0.5) : null;
  return out;
}

const gardenShare = (homes: Scorable[]) => homes.filter((h) => h.garden === true).length / homes.length;

export interface Why {
  pros: string[];
  cons: string[];
  unknown: string[];
}

const k = (p: number) => `£${Math.round(p / 1000)}k`;

/** How one factor reads in words. With a home, the actual value is quoted;
 *  for a town, the typical one. */
function phrase(id: CriterionId, good: boolean, l?: Scorable, townId?: string, homes?: Scorable[]): string {
  const s = STATIONS[l?.townId ?? townId ?? ""];
  switch (id) {
    case "trainTime": return `${s?.mins} min train`;
    case "frequency": return `${s?.peakPerHour} trains an hour`;
    case "price": return l ? (good ? `low price (${k(l.priceGbp)})` : `near the cap (${k(l.priceGbp)})`) : good ? "low prices" : "high prices";
    case "pricePerBed": return l ? `${k(l.priceGbp / l.beds)} a bedroom` : good ? "cheap per bedroom" : "dear per bedroom";
    case "walk": return l ? (good ? `${l.distanceMiles} mi to station` : `${l.distanceMiles} mi walk`) : good ? "close to the station" : "long walks";
    case "kind": return l ? (good ? homeKind(l) === "house" ? "a house" : "a maisonette" : isNewBuildBlock(l) ? "new-build block" : "a flat") : good ? "mostly houses" : "mostly flats";
    case "garden": return l ? (good ? "garden" : "no garden") : `${homes?.length ? Math.round(100 * gardenShare(homes)) : 0}% list a garden`;
    case "floorArea": return l ? `${l.floorAreaSqFt} sq ft` : good ? "roomy" : "small";
    case "ownership": return l ? (good ? (l.tenure === "leasehold" ? "long lease, low charges" : l.tenure === "freehold" ? "freehold" : "share of freehold") : "short lease or high charges") : good ? "cheap to own" : "costly to own";
    case "beds": return l ? `${l.beds} beds` : good ? "mostly 3 beds" : "mostly 2 beds";
    case "baths": return l ? (good ? `${l.baths} bathrooms` : "1 bathroom") : good ? "2 bathrooms common" : "1 bathroom typical";
  }
}

const UNKNOWN: Partial<Record<CriterionId, string>> = {
  garden: "garden unknown", floorArea: "size unknown", ownership: "lease and charges unknown",
  walk: "distance unknown", baths: "bathrooms unknown",
};

/** Up to two strengths, the worst weakness, and unknowns that matter (weight ≥ 2). */
export function explain(f: Factors, w: Weights, l?: Scorable, townId?: string, homes?: Scorable[]): Why {
  const weighted = CRITERIA.filter((c) => w[c.id] > 0);
  const known = weighted.filter((c) => f[c.id] != null).map((c) => ({ id: c.id, v: f[c.id]!, pull: w[c.id] * (f[c.id]! - 0.5) }));
  const pros = known.filter((x) => x.v >= 0.6).sort((a, b) => b.pull - a.pull).slice(0, 2);
  const cons = known.filter((x) => x.v <= 0.4).sort((a, b) => a.pull - b.pull).slice(0, 1);
  return {
    pros: pros.map((x) => phrase(x.id, true, l, townId, homes)),
    cons: cons.map((x) => phrase(x.id, false, l, townId, homes)),
    unknown: weighted.filter((c) => w[c.id] >= 2 && f[c.id] == null).map((c) => UNKNOWN[c.id] ?? `${c.label.toLowerCase()} unknown`),
  };
}

/** "15 min train · garden · but 0.9 mi walk · garden unknown" */
export function whyLine(why: Why): string {
  return [...why.pros, ...why.cons.map((c) => `but ${c}`), ...why.unknown].join(" · ");
}
