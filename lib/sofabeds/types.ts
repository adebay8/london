// Shared types for the sofa bed search. Mirrors the `SofaBed` Prisma model.
//
// This is the sofa search's brief with a bed bolted on, not a different brief:
// the buyer ends up with a sofa OR a sofa bed, never both. So the Raft Loft is
// still the reference and depth still matters — see the spec, §1.
import type { FinancePolicy } from "@/lib/retail/finance";

export type Pref = "want" | "reject";

/** Out of the recommendation score on purpose — it changes what you are
 *  buying and what protection comes with it, not how good the sofa bed is. */
export type Condition = "new" | "ex-display" | "clearance" | "second-hand";

/** How the bed comes out. Recorded per row; all three routes are in scope.
 *  `fold-out` and `pull-out` hide a separate mattress in the frame;
 *  `click-clack` and `futon` make you sleep on the seat itself. */
export type Mechanism = "fold-out" | "pull-out" | "click-clack" | "futon";

/** The sofa search's vocabulary plus `storage-chaise` — a chaise that lifts
 *  to swallow the bedding, which satisfies leg rest, bed and storage at once. */
export type LegRest = "chaise" | "storage-chaise" | "footstool" | "both" | "none";

export type ChaiseSide = "left" | "right" | "reversible";

export type MattressType = "pocket-sprung" | "sprung" | "memory" | "foam" | "fibre";

export type Filling = "feather" | "feather-blend" | "foam" | "fibre" | "mixed";

// --- The reference: Raft Loft Modular, unchanged from the sofa search -----
export const TARGET_DEPTH_CM = 112;
/** Below this you sit upright with your feet on the floor. Scored hard,
 *  never gated — gating would empty the corpus at this budget. */
export const MIN_USEFUL_DEPTH_CM = 100;

// --- Requirements (spec §2) ----------------------------------------------
/** R1: three people, not three cushions. */
export const MIN_SEATS = 3;
/** R2, floor. The gate this search added: "two seats" in the sofa search
 *  always meant two CUSHIONS, and read as capacity it let in exactly the
 *  compact models with the worst mechanisms. */
export const MIN_WIDTH_CM = 200;
/** R2, ceiling. The wall allowance, unchanged from the sofa search. */
export const MAX_WIDTH_CM = 250;
/** R3: a small double. */
export const MIN_BED_WIDTH_CM = 120;
/** A full UK double — scored above the floor, not gated. */
export const FULL_DOUBLE_WIDTH_CM = 135;
/** R4: landed = item + delivery. */
export const BUDGET_CAP_GBP = 1200;

// --- Sanity bounds (spec §8) ---------------------------------------------
//
// Retailers file the right number in the wrong column, and an unguarded
// figure ranks the corpus backwards. Every bound below yields UNKNOWN, which
// is not the same as a failure.

/** Above this, an "overall depth" is an L-shape footprint, not a body depth. */
export const MAX_PLAUSIBLE_BODY_DEPTH_CM = 130;
/** Above this, a "seat depth" is a chaise length. */
export const MAX_PLAUSIBLE_SEAT_DEPTH_CM = 90;
/** Above this, a "bed width" is a bed LENGTH.
 *
 *  This bound is 185 and not 200 for one specific reason: a super king is
 *  180cm wide, and the number most often filed wrongly in this column is
 *  190 — the standard UK bed length. A 200cm bound waves it through as a
 *  magnificent bed and floats the row to the top of the ranking. */
export const MAX_PLAUSIBLE_BED_WIDTH_CM = 185;
/** Below this, a "bed length" is a bed width. */
export const MIN_PLAUSIBLE_BED_LENGTH_CM = 170;
export const MAX_PLAUSIBLE_BED_LENGTH_CM = 230;

/** Seat depth that supports the thigh of someone around 5'11". */
export const GOOD_SEAT_DEPTH_CM = 60;
export const LOUNGE_SEAT_DEPTH_CM = 75;

/** Under this the mattress is a token gesture; at or above REAL it is a
 *  mattress you could sleep on repeatedly. */
export const TOKEN_MATTRESS_CM = 10;
export const REAL_MATTRESS_CM = 14;

export interface SofaBed {
  id: string;
  retailer: string;
  brand: string;
  model: string;
  productUrl: string;
  imageUrl: string | null;
  colourwayShown: string | null;

  priceGbp: number;
  rrpGbp: number | null;
  deliveryCostGbp: number | null;
  deliveryIncluded: boolean;
  landedCostGbp: number;
  overBudget: boolean;

  condition: Condition;
  /** Null when no availability is published. False means the listing says
   *  sold out — a hard exclusion from recommendation, not a penalty. */
  inStock: boolean | null;
  oneOff: boolean;

  /** People it seats. R1 gates on this. */
  seats: number | null;
  /** Seat cushions across that width. Two across 200cm+ is the Raft Loft
   *  look — a style attribute (spec §6), never a gate. */
  seatCushions: number | null;

  mechanism: Mechanism | null;
  /** THE field. Is the thing you sleep on a different object from the thing
   *  you sit on? Null when the listing does not make it unambiguous —
   *  inferring it from a marketing name would corrupt the score's main axis. */
  separateMattress: boolean | null;

  bedWidthCm: number | null;
  bedLengthCm: number | null;
  mattressType: MattressType | null;
  mattressThicknessCm: number | null;
  beddingStorage: boolean | null;

  legRest: LegRest | null;
  chaiseSide: ChaiseSide | null;
  modular: boolean | null;

  overallWidthCm: number | null;
  overallDepthCm: number | null;
  overallHeightCm: number | null;
  /** How far it reaches into the room when open. Recorded on every row and
   *  gated on nothing — the buyer is still flat-hunting and does not know the
   *  floor clearance yet. It becomes a filter the day they do. */
  extendedDepthCm: number | null;
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
