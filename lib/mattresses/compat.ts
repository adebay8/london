// Will this mattress work in the ottoman beds you shortlisted on /beds?
//
// Deliberately COSMETIC. It never gates a mattress and never feeds the score.
// Two reasons: the user asked for it as a nice-to-have, and the input it needs
// — mattress weight — is unpublished on most listings, so letting it rank
// anything would just rank listings by how talkative their spec sheet is.
//
// It answers two questions the two searches can only answer together:
//
//  1. WEIGHT. An ottoman lifts on gas struts rated for a maximum load. The
//     shortlist runs from 35kg (Dreams Louanna) to 50kg (Furniture Village
//     Henry), and a 135 x 190 pocket-sprung mattress can pass either. Over the
//     limit the lid is a two-person job, or it will not stay up at all.
//  2. VENTILATION. The Daals Chilworth has a solid platform base with no
//     slats. An all-foam mattress on an unventilated panel traps the moisture
//     you lose overnight, which is how mattresses grow mould from underneath.
//     Sprung mattresses breathe through their own sides; foam does not.
import type { Mattress } from "./types";

export interface BedConstraint {
  id: string;
  retailer: string;
  model: string;
  /** What the struts are rated to lift. Null when the retailer never says. */
  maxMattressWeightKg: number | null;
  /** The base, in the retailer's words. */
  baseType: string | null;
}

export type CompatVerdict = "fits" | "too-heavy" | "unventilated" | "unknown";

export interface BedCompat {
  bed: BedConstraint;
  verdict: CompatVerdict;
  reason: string | null;
}

export interface Compat {
  beds: BedCompat[];
  /** Beds this mattress is known to work in. */
  fits: number;
  /** Beds it is known to fail in. */
  blocked: BedCompat[];
  /** Beds where we cannot tell either way. */
  unknown: number;
  total: number;
  /** One line for the card, or null when there is nothing worth saying. */
  label: string | null;
}

/** Does the base let air through? Slats do; a solid panel does not. Null when
 *  the retailer's wording says neither.
 *
 *  The negation test has to come first. The Daals Chilworth is described as a
 *  "solid platform base (solid panel, no slats)" — a plain /slat/ match reads
 *  that as slatted and gets the answer exactly backwards. */
export function ventilatedBase(baseType: string | null): boolean | null {
  if (!baseType) return null;
  if (/\b(no|without|non)[\s-]*slat|slatless|solid\s*(panel|platform|base|deck|board)/i.test(baseType)) return false;
  if (/slat/i.test(baseType)) return true;
  if (/solid|platform|panel|board|deck/i.test(baseType)) return false;
  return null;
}

/** Foam against an unventilated base is the combination that grows mould.
 *  Sprung and hybrid mattresses breathe through their own sides. */
function isAllFoam(m: Pick<Mattress, "type">): boolean {
  return m.type === "memory-foam" || m.type === "foam";
}

export function compatFor(m: Mattress, beds: BedConstraint[]): Compat {
  const results: BedCompat[] = beds.map((bed) => {
    // Weight first — it is the harder failure. A lid that will not stay up is
    // not something you can work around.
    if (bed.maxMattressWeightKg != null && m.weightKg != null && m.weightKg > bed.maxMattressWeightKg) {
      return {
        bed,
        verdict: "too-heavy",
        reason: `${m.weightKg}kg is over the ${bed.maxMattressWeightKg}kg the struts are rated for`,
      };
    }

    const airflow = ventilatedBase(bed.baseType);
    if (airflow === false && (isAllFoam(m) || m.platformBaseOk === false)) {
      return {
        bed,
        verdict: "unventilated",
        reason: "All-foam on a solid base with no slats — it will trap moisture underneath",
      };
    }

    // Known to be fine only when the thing that could go wrong was checkable.
    const weightChecked = bed.maxMattressWeightKg == null || m.weightKg != null;
    const airflowChecked = airflow !== false || m.type != null;
    if (weightChecked && airflowChecked) return { bed, verdict: "fits", reason: null };

    return {
      bed,
      verdict: "unknown",
      reason: m.weightKg == null ? "Weight not published — can't check the strut rating" : null,
    };
  });

  const fits = results.filter((r) => r.verdict === "fits").length;
  const blocked = results.filter((r) => r.verdict === "too-heavy" || r.verdict === "unventilated");
  const unknown = results.filter((r) => r.verdict === "unknown").length;

  let label: string | null = null;
  if (results.length) {
    if (blocked.length) label = `Fits ${fits} of your ${results.length} beds`;
    else if (unknown === results.length) label = "Weight unpublished — bed fit unknown";
    else if (fits === results.length) label = `Fits all ${results.length} of your beds`;
    else label = `Fits ${fits} of your ${results.length} beds`;
  }

  return { beds: results, fits, blocked, unknown, total: results.length, label };
}
