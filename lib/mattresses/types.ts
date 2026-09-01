// Shared types for the mattress search. Mirrors the `Mattress` Prisma model.
//
// The brief: a 135 x 190 double, at most £600 landed, NEW, for a combination
// sleeper who spends nights on their side and nights on their back, and who
// sometimes shares the bed.
//
// Two things make this search different from the bed, sofa and console ones:
//
//  1. Almost nothing in a mattress listing is falsifiable. Depth and spring
//     count are real numbers; "cloud-like support" and "orthopaedic" are not.
//     So the scorer leans on the handful of specs that mean something and
//     ignores the adjectives entirely.
//  2. The "was" price is usually fiction. See deal.ts — discount is recorded
//     and shown, and never, ever scored.
import type { FinancePolicy } from "@/lib/retail/finance";

export type Pref = "want" | "reject";

/** Second-hand and ex-display are deliberately absent: the user ruled out
 *  anything slept on, and a shop-floor model has been lain on all year. The
 *  corpus carries unused stock only. */
export type Condition = "new" | "clearance";

export type MattressType =
  | "pocket-sprung"
  | "hybrid"
  | "memory-foam"
  | "foam"
  | "open-coil"
  | "latex"
  | "natural";

export type SpringType = "pocket" | "open-coil" | "continuous" | "none";

/** Our own five-point bucket. Filled in ONLY where the retailer's wording maps
 *  unambiguously — see firmnessOf() in fit.ts. The retailer's own words are
 *  kept verbatim in `firmnessLabel` regardless, because the scales genuinely
 *  are not comparable between brands. */
export type Firmness = "soft" | "medium-soft" | "medium" | "medium-firm" | "firm";

export const FIRMNESS_ORDER: Firmness[] = ["soft", "medium-soft", "medium", "medium-firm", "firm"];

/** How believable the "was" price is. */
export type RrpEvidence = "verified-higher" | "permanent-sale" | "single-observation";

// --- Requirements ---------------------------------------------------------
/** R1: a UK double. Anything else is a different product, not a worse one. */
export const DOUBLE_WIDTH_CM = 135;
export const DOUBLE_LENGTH_CM = 190;
/** A couple of centimetres either way is manufacturing tolerance, not a
 *  different size. Beyond that it will not sit in the bed frame. */
export const SIZE_TOLERANCE_CM = 3;

/** R2: landed = item + delivery + old-mattress disposal. */
export const BUDGET_CAP_GBP = 600;

/** R4: the sleeper. Side nights need give at the shoulder and hip; back
 *  nights need the lumbar held up. Medium and medium-firm are the overlap,
 *  and it is a genuine overlap rather than a compromise — both positions are
 *  well served there. Firm is the single most common regret for anyone who
 *  sleeps on their side at all, so it is marked down rather than treated as
 *  "supportive". */
export const TARGET_FIRMNESS: Firmness[] = ["medium", "medium-firm"];

// --- Depth ----------------------------------------------------------------
/** Below this a double is a spare-room mattress: too little material above the
 *  springs to keep a hip off them. */
export const MIN_USEFUL_DEPTH_CM = 20;
/** Past this the fitted sheets stop reaching and, on an ottoman, the lid
 *  fouls the headboard. Depth beyond here is not a bonus. */
export const GENEROUS_DEPTH_CM = 28;
/** Above this the recorded figure is almost certainly the shipping carton,
 *  not the mattress — bed-in-a-box listings mix the two up constantly. */
export const MAX_PLAUSIBLE_DEPTH_CM = 45;

// --- Springs --------------------------------------------------------------
//
// Spring count is the industry's favourite vanity number. For a fixed 135cm
// width, more springs means THINNER springs: a 3,000-count double is wire so
// fine that it fatigues faster than a 1,000-count. Counts above ~2,000 are
// also routinely inflated by counting mini-springs stacked in a second layer.
//
// So the criterion saturates: real credit up to about 1,000, a little more to
// 2,000, and nothing whatsoever beyond that.
export const SPRINGS_GOOD = 1000;
export const SPRINGS_PLATEAU = 2000;

// --- Trial ----------------------------------------------------------------
/** The only reliable way to find out whether a mattress suits you is to sleep
 *  on it for a few weeks, so a real trial is worth more than most of the spec
 *  sheet. A month is enough to get past the adjustment period. */
export const GOOD_TRIAL_NIGHTS = 60;
export const GREAT_TRIAL_NIGHTS = 100;

export interface Mattress {
  id: string;
  retailer: string;
  brand: string;
  model: string;
  productUrl: string;
  imageUrl: string | null;

  // Money. landedCost = item + delivery + disposal — the only comparable figure.
  priceGbp: number;
  rrpGbp: number | null;
  deliveryCostGbp: number | null;
  deliveryIncluded: boolean;
  disposalCostGbp: number | null;
  landedCostGbp: number;
  overBudget: boolean;

  condition: Condition;
  inStock: boolean | null;

  /** How much the "was" price can be believed. Displayed, never scored. */
  rrpEvidence: RrpEvidence | null;
  /** Lowest price actually observed. Equal to today's price on a first run. */
  priceFloorGbp: number | null;

  size: string | null;
  widthCm: number | null;
  lengthCm: number | null;
  depthCm: number | null;

  type: MattressType | null;
  springType: SpringType | null;
  springCount: number | null;
  zoned: boolean | null;
  turnRequired: boolean | null;

  /** The retailer's own words. Never overwritten by our bucket. */
  firmnessLabel: string | null;
  /** The scale those words sit on, e.g. "1-10 (Dreams)". */
  firmnessScale: string | null;
  /** Our bucket, or null where the wording does not map cleanly. */
  firmness: Firmness | null;

  comfortLayer: string | null;
  comfortLayerDepthCm: number | null;
  /** The number that decides whether an ottoman's struts can lift it. */
  weightKg: number | null;

  slattedBaseOk: boolean | null;
  platformBaseOk: boolean | null;
  ottomanOk: boolean | null;

  coverRemovable: boolean | null;
  coverWashable: boolean | null;

  trialNights: number | null;
  trialFreeReturns: boolean | null;
  warrantyYears: number | null;
  returnsWindow: string | null;
  deliveryLeadTime: string | null;

  reviewScore: number | null;
  reviewCount: number | null;
  testedBy: string | null;
  testScore: number | null;

  finance: FinancePolicy;

  notes: string | null;
  extra: Record<string, string>;

  pref: Pref | null;
}

export type { FinancePolicy, FinanceTier, FinanceType } from "@/lib/retail/finance";
export { NO_FINANCE } from "@/lib/retail/finance";
