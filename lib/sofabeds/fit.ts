// Does this sofa bed meet the brief: seats three, fits the 200-250cm band,
// and makes at least a small double?
//
// Same tri-state discipline as lib/sofas/fit.ts — pass / fail / unknown, where
// unknown means the retailer did not publish the measurement, never that the
// sofa bed is unsuitable.
import {
  BUDGET_CAP_GBP,
  MAX_PLAUSIBLE_BED_LENGTH_CM,
  MAX_PLAUSIBLE_BED_WIDTH_CM,
  MAX_PLAUSIBLE_BODY_DEPTH_CM,
  MAX_PLAUSIBLE_SEAT_DEPTH_CM,
  MAX_WIDTH_CM,
  MIN_BED_WIDTH_CM,
  MIN_PLAUSIBLE_BED_LENGTH_CM,
  MIN_SEATS,
  MIN_WIDTH_CM,
  type Mechanism,
  type SofaBed,
} from "./types";

/** Body depth, or null when the figure is really an L-shape footprint. */
export function bodyDepthOf(s: Pick<SofaBed, "overallDepthCm">): number | null {
  const d = s.overallDepthCm;
  if (d == null || d > MAX_PLAUSIBLE_BODY_DEPTH_CM) return null;
  return d;
}

/** Usable seat depth, or null when the figure is really a chaise length. */
export function seatDepthOf(s: Pick<SofaBed, "seatDepthCm">): number | null {
  const d = s.seatDepthCm;
  if (d == null || d > MAX_PLAUSIBLE_SEAT_DEPTH_CM) return null;
  return d;
}

/** Bed width, or null when the figure is really a bed length. See the note on
 *  MAX_PLAUSIBLE_BED_WIDTH_CM: 190 is the number this guard exists to catch. */
export function bedWidthOf(s: Pick<SofaBed, "bedWidthCm">): number | null {
  const w = s.bedWidthCm;
  if (w == null || w > MAX_PLAUSIBLE_BED_WIDTH_CM) return null;
  return w;
}

/** Bed length, or null when the figure is really a width. */
export function bedLengthOf(s: Pick<SofaBed, "bedLengthCm">): number | null {
  const l = s.bedLengthCm;
  if (l == null || l < MIN_PLAUSIBLE_BED_LENGTH_CM || l > MAX_PLAUSIBLE_BED_LENGTH_CM) return null;
  return l;
}

export function hasSuspectBedSize(s: Pick<SofaBed, "bedWidthCm" | "bedLengthCm">): boolean {
  return (
    (s.bedWidthCm != null && s.bedWidthCm > MAX_PLAUSIBLE_BED_WIDTH_CM) ||
    (s.bedLengthCm != null &&
      (s.bedLengthCm < MIN_PLAUSIBLE_BED_LENGTH_CM || s.bedLengthCm > MAX_PLAUSIBLE_BED_LENGTH_CM))
  );
}

/** True when the retailer publishes no delivery charge at all — neither "free"
 *  nor a figure. IKEA is the reason this exists: its charge is postcode-
 *  dependent, so the listing carries no number. The importer's landed cost
 *  then falls back to price + 0, which is a FLOOR, not the price you pay. */
export function deliveryUnknown(s: Pick<SofaBed, "deliveryIncluded" | "deliveryCostGbp">): boolean {
  return !s.deliveryIncluded && s.deliveryCostGbp == null;
}

/** Tri-state budget verdict, same discipline as the measurement guards above:
 *  an unpublished delivery charge must read as UNKNOWN, never as free.
 *
 *  - "over": the floor alone already clears the cap, so it is over whatever
 *    delivery turns out to be. Safe to assert.
 *  - "unknown": the floor is inside the cap but delivery is unpublished, so
 *    nothing can be asserted either way.
 *  - "in": inside the cap with delivery accounted for. */
export function budgetVerdict(
  s: Pick<SofaBed, "landedCostGbp" | "deliveryIncluded" | "deliveryCostGbp">,
): "in" | "over" | "unknown" {
  if (s.landedCostGbp > BUDGET_CAP_GBP) return "over";
  return deliveryUnknown(s) ? "unknown" : "in";
}

export type Verdict = "pass" | "fail" | "unknown";

export interface Fit {
  /** R1: seats three people. */
  seats: Verdict;
  /** R2: inside the 200-250cm band. Both ends are gates. */
  width: Verdict;
  /** R3: opens to a small double or bigger. */
  bed: Verdict;
  overall: Verdict;
  /** Which mechanism delivers the bed, when the listing says. */
  mechanismRoute: Mechanism | null;
  /** Whether you sleep on something other than the seat. Null when unclear. */
  sleepsApart: boolean | null;
  notes: string[];
}

export function fitFor(s: SofaBed): Fit {
  const notes: string[] = [];

  // --- R1 ---
  let seats: Verdict;
  if (s.seats == null) {
    seats = "unknown";
  } else if (s.seats >= MIN_SEATS) {
    seats = "pass";
  } else {
    seats = "fail";
    notes.push(`Seats ${s.seats} — the brief is ${MIN_SEATS}`);
  }

  // --- R2: a band, not a ceiling ---
  let width: Verdict;
  const w = s.overallWidthCm;
  if (w == null) {
    width = "unknown";
  } else if (w < MIN_WIDTH_CM) {
    width = "fail";
    notes.push(`${w}cm wide — too narrow, that is a small sofa`);
  } else if (w > MAX_WIDTH_CM) {
    width = "fail";
    notes.push(`${w}cm wide — ${Math.round(w - MAX_WIDTH_CM)}cm over the wall allowance`);
  } else {
    width = "pass";
  }

  // --- R3 ---
  let bed: Verdict;
  const bw = bedWidthOf(s);
  if (bw == null) {
    bed = "unknown";
    if (s.bedWidthCm != null) {
      notes.push("Published bed width looks like a bed length, not a width");
    }
  } else if (bw >= MIN_BED_WIDTH_CM) {
    bed = "pass";
  } else {
    bed = "fail";
    notes.push(`Opens to ${bw}cm — narrower than a small double`);
  }

  // --- Routes: recorded, never gated (spec §3, §4) ---
  const mechanismRoute = s.mechanism;
  const sleepsApart = s.separateMattress;
  if (sleepsApart === true) {
    notes.push("Separate mattress — you don't sleep on the seat cushions");
  } else if (sleepsApart === false) {
    notes.push("The seat is the mattress — sits firmer");
  }
  if (s.legRest === "storage-chaise") {
    notes.push("Storage chaise — leg rest that swallows the bedding");
  }

  const all = [seats, width, bed];
  const overall: Verdict = all.includes("fail") ? "fail" : all.includes("unknown") ? "unknown" : "pass";

  return { seats, width, bed, overall, mechanismRoute, sleepsApart, notes };
}

export function fitLabel(f: Fit): string {
  if (f.overall === "pass") {
    const bedBit = f.sleepsApart === true ? "separate mattress" : f.mechanismRoute ?? "bed";
    return `3 seats + ${bedBit}`;
  }
  if (f.overall === "unknown") return "Spec incomplete";
  const failed = [f.seats === "fail" && "seats", f.width === "fail" && "width", f.bed === "fail" && "bed size"]
    .filter(Boolean)
    .join(", ");
  return `Doesn't meet: ${failed}`;
}
