// Does this sofa meet the brief: two seats, somewhere to put your legs, and
// narrow enough for the wall?
//
// Same tri-state discipline as lib/consoles/fit.ts — pass / fail / unknown,
// where unknown means the retailer did not publish the measurement, never that
// the sofa is unsuitable. Seat depth in particular is almost never published,
// and it is the number that decides whether something looks like the
// reference, so an unpublished spec must not be read as a failure.
import { MAX_WIDTH_CM, MIN_SEATS, type Sofa } from "./types";

export type Verdict = "pass" | "fail" | "unknown";

export interface Fit {
  /** R1: at least two seats. */
  seats: Verdict;
  /** R2: a chaise or a footstool. */
  legRest: Verdict;
  /** R3: fits the 250cm wall allowance. */
  width: Verdict;
  overall: Verdict;
  /** Which route delivers the leg rest, when one does. */
  legRestRoute: "chaise" | "footstool" | "both" | null;
  notes: string[];
}

export function fitFor(s: Sofa): Fit {
  const notes: string[] = [];

  // --- R1 ---
  let seats: Verdict;
  if (s.seats == null) {
    seats = "unknown";
  } else if (s.seats >= MIN_SEATS) {
    seats = "pass";
  } else {
    seats = "fail";
    notes.push(`Only ${s.seats} seat — the brief is two`);
  }

  // --- R2 ---
  let legRest: Verdict;
  let legRestRoute: Fit["legRestRoute"] = null;
  if (s.legRest == null) {
    legRest = "unknown";
  } else if (s.legRest === "none") {
    legRest = "fail";
    notes.push("No chaise and no footstool");
  } else {
    legRest = "pass";
    legRestRoute = s.legRest;
    if (s.legRest === "both") {
      notes.push("Comes with a chaise and a footstool");
    } else if (s.legRest === "chaise") {
      notes.push(
        s.chaiseSide === "reversible"
          ? "Reversible chaise — you choose the side"
          : `Built-in chaise${s.chaiseSide ? ` (${s.chaiseSide}-facing)` : ""}`,
      );
    } else {
      notes.push("Separate footstool — movable, doubles as a seat");
    }
  }

  // --- R3 ---
  let width: Verdict;
  if (s.overallWidthCm == null) {
    width = "unknown";
  } else if (s.overallWidthCm <= MAX_WIDTH_CM) {
    width = "pass";
  } else {
    width = "fail";
    notes.push(`${s.overallWidthCm}cm wide — ${Math.round(s.overallWidthCm - MAX_WIDTH_CM)}cm over the wall allowance`);
  }

  const all = [seats, legRest, width];
  const overall: Verdict = all.includes("fail") ? "fail" : all.includes("unknown") ? "unknown" : "pass";

  return { seats, legRest, width, overall, legRestRoute, notes };
}

export function fitLabel(f: Fit): string {
  if (f.overall === "pass") {
    return f.legRestRoute === "chaise"
      ? "2 seats + chaise"
      : f.legRestRoute === "both"
        ? "2 seats + chaise & footstool"
        : "2 seats + footstool";
  }
  if (f.overall === "unknown") return "Spec incomplete";
  const failed = [f.seats === "fail" && "seats", f.legRest === "fail" && "leg rest", f.width === "fail" && "width"]
    .filter(Boolean)
    .join(", ");
  return `Doesn't meet: ${failed}`;
}
