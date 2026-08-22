// Shared types for the bed search. Mirrors the `Bed` Prisma model, plus the
// derived shape the /beds page works with. Nothing derived is persisted — see
// lib/beds/score.ts.

export type Pref = "want" | "reject";

/** "included" = built in your room at the landed price, "paid" = a real priced
 *  service exists, "self" = flat-pack and you build it. */
export type Assembly = "included" | "paid" | "self";

export type Opening = "end" | "side" | "either";

export type OttomanType = "full" | "half" | "side-only";

export interface Bed {
  id: string;
  retailer: string;
  brand: string;
  model: string;
  productUrl: string;
  colourwayShown: string | null;
  colourwaysAvailable: string | null;

  doublePriceGbp: number;
  deliveryCostGbp: number | null;
  deliveryIncluded: boolean;
  assemblyCostGbp: number | null;
  assemblyIncluded: boolean;
  landedCostGbp: number;
  extraMembershipCost: string | null;
  overBudget: boolean;

  arrivesAssembled: Assembly;

  openingDirection: Opening | null;
  liftMechanism: string | null;
  gasStrutRating: string | null;
  strutCount: number | null;
  frameMaterial: string | null;
  fixingType: string | null;
  storageDepthCm: number | null;
  ottomanType: OttomanType;
  maxMattressWeightKg: number | null;
  minMattressWeightKg: number | null;
  baseType: string | null;
  slatGapCm: number | null;

  overallWidthCm: number | null;
  overallLengthCm: number | null;
  overallHeightCm: number | null;
  overhangCm: number | null;
  longestBoxCm: number | null;

  upholsteryMaterial: string | null;
  headboardStyle: string | null;

  warranty: string | null;
  warrantyCoversMechanism: string | null;
  sparePartsAvailable: string | null;
  returnsWindow: string | null;
  deliveryLeadTime: string | null;
  reviewScore: number | null;
  reviewCount: number | null;

  finance: FinancePolicy;

  notes: string | null;
  extra: Record<string, string>;

  pref: Pref | null;
}

/** Retailer-level finance policy. Persisted as a single JSON column — see the
 *  note on `Bed.finance` in schema.prisma for why it is not ten scalars. */
export interface FinancePolicy {
  available: boolean;
  type: FinanceType | null;
  provider: string | null;
  apr: number | null;
  maxMonths: number | null;
  minSpend: number | null;
  tiers: FinanceTier[];
  deposit: string | null;
  notes: string | null;
  url: string | null;
}

export const NO_FINANCE: FinancePolicy = {
  available: false,
  type: null,
  provider: null,
  apr: null,
  maxMonths: null,
  minSpend: null,
  tiers: [],
  deposit: null,
  notes: null,
  url: null,
};

/** One rung of a retailer's interest-free ladder: spend at least `minSpend` and
 *  you qualify for `months` at `apr`. Wayfair (via Klarna) runs 6m/12m/18m at
 *  £250/£500/£1,200. */
export interface FinanceTier {
  minSpend: number;
  months: number;
  apr: number;
}

/** BNPL (Klarna/Clearpay pay-in-3) is deliberately a separate kind from real
 *  fixed-term interest-free credit — six weeks is not twelve months. */
export type FinanceType =
  | "interest-free credit"
  | "interest-bearing credit"
  | "BNPL"
  | "store card"
  | "none";

/** Depth at which a hard-shell check-in suitcase (~30cm thick) still lets the
 *  lid close. Below this you are limited to soft bags and bedding. */
export const SUITCASE_DEPTH_CM = 32;

/** Standard UK 4FT6 mattress width. Overhang is measured against this. */
export const MATTRESS_WIDTH_CM = 135;

/** The user's cap, on landed cost (item + delivery + assembly). */
export const BUDGET_CAP_GBP = 900;
