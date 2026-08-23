// Shared types for the sofa search. Mirrors the `Sofa` Prisma model.
//
// The reference product is Raft's Loft Modular — deep seat, wide square arms,
// low modular blocks, plump neutral cushions. Its geometry is recorded below
// as the yardstick the style score is measured against, not as a hard gate:
// the budget is roughly a third of the reference, so demanding its exact
// dimensions would return nothing.
import type { FinancePolicy } from "@/lib/retail/finance";

export type Pref = "want" | "reject";

/** What you are actually buying, and what protection comes with it. Kept out
 *  of the recommendation score for the same reason as finance — it changes
 *  what you get, not how good the sofa is. */
export type Condition = "new" | "ex-display" | "clearance" | "second-hand";

/** How the leg rest is delivered. Neither is better; the user asked to see
 *  both. `chaise` commits to a handing, `footstool` does not. */
export type LegRest = "chaise" | "footstool" | "both" | "none";

export type ChaiseSide = "left" | "right" | "reversible";

export type Filling = "feather" | "feather-blend" | "foam" | "fibre" | "mixed";

// --- The reference: Raft Loft Modular ------------------------------------
export const REF_DEPTH_CM = 112;
export const REF_SEAT_HEIGHT_CM = 43;
export const REF_MODULE_WIDTH_CM = 76;
export const REF_FOUR_PIECE_PRICE_GBP = 3910;

// --- Requirements (spec §2) ----------------------------------------------
/** R1: a two-seater at minimum. */
export const MIN_SEATS = 2;
/** R3: the wall allowance. */
export const MAX_WIDTH_CM = 250;
/** R4: landed = item + delivery. */
export const BUDGET_CAP_GBP = 1200;
// --- Depth: the ergonomic requirement, not just the look -----------------
//
// The user is 5'11" and chose the reference specifically because 112cm
// supports their legs when seated. So depth is a comfort requirement here, not
// a style preference, and it carries the most weight in the score.
//
// IMPORTANT: overall depth is NOT seat depth. The reference's 112cm includes
// its back cushions, leaving roughly 75-85cm of actual seat. Seat depth is
// what supports the legs, and it is the figure retailers almost never publish
// — which is exactly why the tri-state pattern matters again here.

/** The reference depth the user liked. Full marks. */
export const TARGET_DEPTH_CM = 112;
/** Below this a sofa is a standard settee: you sit upright, feet on the floor,
 *  no thigh support past the knee. Scored hard, but not gated — gating would
 *  empty the corpus at this budget. */
export const MIN_USEFUL_DEPTH_CM = 100;
/** Seat depth that actually supports the thigh of someone around 5'11".
 *  Buttock-to-knee is roughly 50cm, so anything past ~60cm supports the leg;
 *  past ~75cm you are lounging rather than sitting. */
export const GOOD_SEAT_DEPTH_CM = 60;
export const LOUNGE_SEAT_DEPTH_CM = 75;

export interface Sofa {
  id: string;
  retailer: string;
  brand: string;
  model: string;
  productUrl: string;
  imageUrl: string | null;
  colourwayShown: string | null;

  // Money. landedCost = item + delivery, the only comparable figure.
  priceGbp: number;
  rrpGbp: number | null; // list price, where the row is a discount
  deliveryCostGbp: number | null;
  deliveryIncluded: boolean;
  landedCostGbp: number;
  overBudget: boolean;

  condition: Condition;
  /** One-off stock that cannot be reordered — true for most ex-display and
   *  all second-hand. Worth surfacing: it changes how fast you must decide. */
  oneOff: boolean;

  seats: number | null;
  legRest: LegRest | null;
  chaiseSide: ChaiseSide | null;
  modular: boolean | null;

  overallWidthCm: number | null;
  overallDepthCm: number | null;
  overallHeightCm: number | null;
  /** The number that actually decides whether it looks like the reference.
   *  Rarely published — see the tri-state handling in fit.ts. */
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
