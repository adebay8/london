// Shared types for the TV console search. Mirrors the `TvConsole` Prisma
// model, plus the derived shape the /consoles page works with. Nothing derived
// is persisted — see lib/consoles/fit.ts and lib/consoles/score.ts.
//
// Named TvConsole rather than Console because `Console` is a global DOM type
// name; shadowing it in module scope is a readability trap.
//
// Every constant below is either a MEASURED figure from the kit this search
// exists to accommodate, or a requirement derived from those figures. Sources
// are recorded in docs/superpowers/specs/2026-08-22-tv-console-search-design.md §2.
import type { FinancePolicy } from "@/lib/retail/finance";

export type Pref = "want" | "reject";

/** "included" = built in your room at the landed price, "paid" = a real priced
 *  service exists, "self" = flat-pack and you build it. */
export type Assembly = "included" | "paid" | "self";

/** How a compartment is enclosed. Only `open` and `glass-door` bays are
 *  candidates for the PS5 — a solid door traps heat and blocks the disc slot. */
export type BayKind = "open" | "door" | "glass-door" | "drawer";

/** A solid back cooks a PS5 and an ethernet switch sharing one enclosure. */
export type BackPanel = "open" | "ported" | "solid";

/** One compartment size. `count` is how many of this size the unit has.
 *
 *  A null dimension means UNPUBLISHED — never zero. Zero would read as a real
 *  measurement of zero and fail the fit gate, when the honest answer is that
 *  we don't know. lib/consoles/fit.ts depends on this distinction. */
export interface Bay {
  kind: BayKind;
  count: number;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
}

// --- Measured: LG OLED55B56LA (55" B5 OLED) -------------------------------
export const TV_WIDTH_CM = 122.8;
/** Span of the stand's feet/base — this is what has to land on the surface. */
export const TV_STAND_WIDTH_CM = 105.7;
export const TV_STAND_DEPTH_CM = 23.5;
export const TV_WEIGHT_KG = 14.5;
/** DERIVED, NOT PUBLISHED: 77.2cm high with stand minus the 70.8cm panel.
 *  The soundbar is 6.35cm tall, so the margin is roughly half a millimetre.
 *  Verify with a tape measure before buying anything. Recorded as a standing
 *  caveat in the UI, not as a scored criterion — it is a property of the TV
 *  and the soundbar, not of any console. */
export const TV_SCREEN_CLEARANCE_CM = 6.4;

// --- Measured: LG S80TR soundbar, main unit only --------------------------
// The subwoofer (40.6cm tall) and rear satellites are floor/shelf items and
// sit outside the console entirely.
export const SOUNDBAR_WIDTH_CM = 99.8;
export const SOUNDBAR_DEPTH_CM = 13.5;
export const SOUNDBAR_HEIGHT_CM = 6.35;
export const SOUNDBAR_WEIGHT_KG = 3.5;

// --- Measured: PS5 Slim (disc), lying flat --------------------------------
export const PS5_WIDTH_CM = 35.8;
export const PS5_DEPTH_CM = 21.6;
export const PS5_HEIGHT_CM = 9.6;

// Standing upright beside the TV — the same box on a different axis.
export const PS5_VERTICAL_WIDTH_CM = 9.6;
export const PS5_VERTICAL_DEPTH_CM = 21.6;
export const PS5_VERTICAL_HEIGHT_CM = 35.8;

/** Width to reserve beside the TV for an upright PS5: the 9.6cm console, the
 *  official vertical stand's base, which is wider than the console, and enough
 *  room to get a hand in and air around it. An allowance, not a measurement —
 *  Sony does not publish the stand's base dimensions.
 *
 *  NOTE: the PS5 Slim does NOT ship with a vertical stand. Sony sells it
 *  separately at around GBP 25, so standing it up is a real added cost. */
export const PS5_TOP_CLEARANCE_CM = 20;

// --- Derived requirements (spec §3) ---------------------------------------
/** R1 hard: below this the TV stand overhangs the surface. */
export const MIN_TOP_WIDTH_CM = 106;
/** R1 preferred: a unit narrower than the TV itself looks wrong under it. */
export const PREFERRED_TOP_WIDTH_CM = TV_WIDTH_CM;
/** R2 hard: TV base and soundbar sit one behind the other. 23.5 + 13.5. */
export const MIN_TOP_DEPTH_CM = TV_STAND_DEPTH_CM + SOUNDBAR_DEPTH_CM;
/** R2 comfortable: leaves a cable gap behind the TV. */
export const COMFORT_TOP_DEPTH_CM = 40;
/** R3a: PS5 lying flat in an open bay — footprint plus airflow, rear cable
 *  run and the horizontal feet. */
export const PS5_BAY_WIDTH_CM = 40;
export const PS5_BAY_DEPTH_CM = 25;
export const PS5_BAY_HEIGHT_CM = 11;

/** R3b: PS5 standing upright on the top surface, beside the TV.
 *
 *  Measured against the TV's full 122.8cm PANEL width, not its 105.7cm stand
 *  span. An upright PS5 is 35.8cm tall and the bottom of the screen sits only
 *  ~6.4cm above the surface, so the console has to clear the panel's overhang
 *  entirely — it cannot tuck under it the way something short could. */
export const MIN_TOP_WIDTH_FOR_UPRIGHT_PS5_CM = TV_WIDTH_CM + PS5_TOP_CLEARANCE_CM;
/** R4: ~19kg of real load (TV 14.5 + bar 3.5) plus headroom. */
export const MIN_TOP_LOAD_KG = 25;
/** R7: the wall allowance. */
export const MIN_OVERALL_WIDTH_CM = 150;
export const MAX_OVERALL_WIDTH_CM = 180;
/** R9: landed = item + delivery + assembly, the only figure comparable
 *  across retailers. */
export const BUDGET_CAP_GBP = 500;

/** Total weight actually going on the top surface. */
export const TOP_LOAD_KG = TV_WEIGHT_KG + SOUNDBAR_WEIGHT_KG;

export interface TvConsole {
  id: string;
  retailer: string;
  brand: string;
  model: string;
  productUrl: string;
  colourwayShown: string | null;
  colourwaysAvailable: string | null;

  // Money. landedCost = item + delivery + assembly, and is the only comparable
  // figure across retailers.
  priceGbp: number;
  deliveryCostGbp: number | null;
  deliveryIncluded: boolean;
  assemblyCostGbp: number | null;
  assemblyIncluded: boolean;
  landedCostGbp: number;
  overBudget: boolean;
  arrivesAssembled: Assembly;

  /** Always floor-standing in this corpus (R8), but recorded so a stray
   *  wall-mounted row is filtered rather than silently scored. */
  mounting: string | null;

  // The top surface — where the TV and soundbar have to coexist.
  topWidthCm: number | null;
  topDepthCm: number | null;
  topLoadKg: number | null;

  overallWidthCm: number | null;
  overallDepthCm: number | null;
  overallHeightCm: number | null;

  bays: Bay[];
  backPanel: BackPanel | null;
  cableManagement: string | null;

  frameMaterial: string | null;
  finishMaterial: string | null;
  legStyle: string | null;

  warranty: string | null;
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

// Finance is retailer-level policy shared with /beds.
export type { FinancePolicy, FinanceTier, FinanceType } from "@/lib/retail/finance";
export { NO_FINANCE } from "@/lib/retail/finance";
