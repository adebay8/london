// Shared types for the bed search. Mirrors the `Bed` Prisma model, plus the
// derived shape the /beds page works with. Nothing derived is persisted — see
// lib/beds/score.ts.

import type { FinancePolicy } from "@/lib/retail/finance";

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

// Retailer finance policy is shared with the other product searches and now
// lives in lib/retail/finance.ts. Re-exported here so existing /beds imports
// keep working unchanged.
export type { FinancePolicy, FinanceTier, FinanceType } from "@/lib/retail/finance";
export { NO_FINANCE } from "@/lib/retail/finance";

/** Depth at which a hard-shell check-in suitcase (~30cm thick) still lets the
 *  lid close. Below this you are limited to soft bags and bedding. */
export const SUITCASE_DEPTH_CM = 32;

/** Standard UK 4FT6 mattress width. Overhang is measured against this. */
export const MATTRESS_WIDTH_CM = 135;

/** The user's cap, on landed cost (item + delivery + assembly). */
export const BUDGET_CAP_GBP = 900;
