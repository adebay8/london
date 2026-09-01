// Does this mattress meet the brief: a 135 x 190 double, in the firmness band
// that serves a side-and-back sleeper, that can sit on an ottoman's base?
//
// Same tri-state discipline as lib/sofas/fit.ts and lib/consoles/fit.ts —
// pass / fail / unknown, where unknown means the retailer published nothing,
// never that the mattress is unsuitable.
import {
  DOUBLE_LENGTH_CM,
  DOUBLE_WIDTH_CM,
  FIRMNESS_ORDER,
  MAX_PLAUSIBLE_DEPTH_CM,
  SIZE_TOLERANCE_CM,
  TARGET_FIRMNESS,
  type Firmness,
  type Mattress,
} from "./types";

/** The mattress's own depth, or null when the recorded figure is really the
 *  shipping carton. Bed-in-a-box listings put the box height in the dimensions
 *  block constantly, and a "42cm deep" mattress is a rolled-up 24cm one. */
export function depthOf(m: Pick<Mattress, "depthCm">): number | null {
  const d = m.depthCm;
  if (d == null || d > MAX_PLAUSIBLE_DEPTH_CM) return null;
  return d;
}

/** True when the row carries a depth we had to discard — worth saying out
 *  loud, because it usually means a carton measurement. */
export function hasSuspectDepth(m: Pick<Mattress, "depthCm">): boolean {
  return m.depthCm != null && m.depthCm > MAX_PLAUSIBLE_DEPTH_CM;
}

// --- Firmness -------------------------------------------------------------
//
// Firmness scales are NOT comparable between brands: Emma's "medium-firm" and
// Silentnight's "firm" are not the same mattress. So this maps the retailer's
// own wording to our bucket only where the wording is unambiguous, and returns
// null otherwise rather than guessing. "Orthopaedic", "supportive" and
// "luxury" carry no firmness information at all and must not be read as firm.

const WORD_MAP: [RegExp, Firmness][] = [
  // Order matters — the compound labels have to be tested before the plain
  // ones, or "medium firm" matches /firm/ and lands two buckets away.
  [/\bmedium[\s-]*(to)?[\s-]*firm\b|\bfirm[\s-]*medium\b/i, "medium-firm"],
  [/\bmedium[\s-]*(to)?[\s-]*soft\b|\bsoft[\s-]*medium\b/i, "medium-soft"],
  [/\bextra[\s-]*firm\b|\bvery[\s-]*firm\b|\bfirmer\b/i, "firm"],
  [/\bmedium\b/i, "medium"],
  [/\bfirm\b/i, "firm"],
  [/\bsoft\b|\bplush\b/i, "soft"],
];

/** Positions on a retailer's own 1-10 scale, where one is published. The
 *  banding below is the common industry reading, but it is still the
 *  retailer's scale, not a standard — so callers are told the source. */
function fromScale(value: number): Firmness | null {
  if (!Number.isFinite(value) || value < 1 || value > 10) return null;
  if (value <= 3) return "soft";
  if (value <= 4.5) return "medium-soft";
  if (value <= 6) return "medium";
  if (value <= 8) return "medium-firm";
  return "firm";
}

export interface FirmnessRead {
  value: Firmness | null;
  /** Where it came from, so nothing is silently normalised. */
  source: "stored" | "label" | "scale" | null;
}

/** Read a firmness bucket from whatever the row actually carries. A stored
 *  bucket (set deliberately at import) wins; then the retailer's words; then a
 *  numeric position on their own scale. */
export function firmnessOf(m: Pick<Mattress, "firmness" | "firmnessLabel" | "firmnessScale">): FirmnessRead {
  if (m.firmness && FIRMNESS_ORDER.includes(m.firmness)) return { value: m.firmness, source: "stored" };

  const label = m.firmnessLabel ?? "";
  for (const [re, f] of WORD_MAP) {
    if (re.test(label)) return { value: f, source: "label" };
  }

  // "7/10", "7 out of 10", "firmness 7" — only from an explicit scale field.
  const n = /(\d+(?:\.\d+)?)\s*(?:\/|out of)\s*10/i.exec(`${label} ${m.firmnessScale ?? ""}`);
  if (n) {
    const f = fromScale(Number(n[1]));
    if (f) return { value: f, source: "scale" };
  }
  return { value: null, source: null };
}

/** How far a firmness sits from the target band, in bucket steps. 0 when in
 *  the band. Used by the scorer; kept here so the ordering lives in one place. */
export function firmnessDistance(f: Firmness): number {
  const i = FIRMNESS_ORDER.indexOf(f);
  const targets = TARGET_FIRMNESS.map((t) => FIRMNESS_ORDER.indexOf(t));
  return Math.min(...targets.map((t) => Math.abs(i - t)));
}

export type Verdict = "pass" | "fail" | "unknown";

export interface Fit {
  /** R1: a 135 x 190 double. */
  size: Verdict;
  /** R4: in a firmness band a side-and-back sleeper can live with. */
  firmness: Verdict;
  /** Will sit on the sprung-slatted or solid base of an ottoman frame. */
  base: Verdict;
  overall: Verdict;
  firmnessRead: FirmnessRead;
  notes: string[];
}

export function fitFor(m: Mattress): Fit {
  const notes: string[] = [];

  // --- R1: size ---
  let size: Verdict;
  const w = m.widthCm;
  const l = m.lengthCm;
  if (w == null && l == null) {
    size = m.size ? (/double/i.test(m.size) ? "pass" : "fail") : "unknown";
    if (size === "fail") notes.push(`Listed as ${m.size}, not a double`);
  } else {
    const wOk = w == null || Math.abs(w - DOUBLE_WIDTH_CM) <= SIZE_TOLERANCE_CM;
    const lOk = l == null || Math.abs(l - DOUBLE_LENGTH_CM) <= SIZE_TOLERANCE_CM;
    size = wOk && lOk ? "pass" : "fail";
    if (size === "fail") {
      notes.push(`${w ?? "?"} x ${l ?? "?"}cm — not a ${DOUBLE_WIDTH_CM} x ${DOUBLE_LENGTH_CM} double`);
    }
  }

  // --- R4: firmness ---
  const firmnessRead = firmnessOf(m);
  let firmness: Verdict;
  if (firmnessRead.value == null) {
    firmness = "unknown";
  } else if (TARGET_FIRMNESS.includes(firmnessRead.value)) {
    firmness = "pass";
    notes.push(`${firmnessRead.value} — the band that serves both side and back nights`);
  } else if (firmnessRead.value === "medium-soft") {
    firmness = "pass";
    notes.push("Medium-soft — kind to side nights, may let the hips sink on back nights");
  } else if (firmnessRead.value === "firm") {
    firmness = "fail";
    notes.push("Firm — the usual regret for anyone who sleeps on their side at all");
  } else {
    firmness = "fail";
    notes.push("Soft — too little support for back nights");
  }

  // --- Base ---
  let base: Verdict;
  const flags = [m.ottomanOk, m.slattedBaseOk].filter((v) => v != null) as boolean[];
  if (!flags.length) {
    base = "unknown";
  } else if (flags.some((v) => v)) {
    base = "pass";
  } else {
    base = "fail";
    notes.push("Not rated for a slatted or ottoman base");
  }

  const all = [size, firmness, base];
  const overall: Verdict = all.includes("fail") ? "fail" : all.includes("unknown") ? "unknown" : "pass";

  return { size, firmness, base, overall, firmnessRead, notes };
}

export function fitLabel(f: Fit): string {
  if (f.overall === "pass") return `Double · ${f.firmnessRead.value}`;
  if (f.overall === "unknown") return "Spec incomplete";
  const failed = [f.size === "fail" && "size", f.firmness === "fail" && "firmness", f.base === "fail" && "base"]
    .filter(Boolean)
    .join(", ");
  return `Doesn't meet: ${failed}`;
}
