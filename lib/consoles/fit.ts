// The tri-state geometry engine: does this console physically take the TV, the
// soundbar in front of it, and a PS5 lying flat?
//
// DESIGN RULE (inherited from lib/beds/score.ts): a missing measurement must
// never be treated as a failed measurement.
//
// Retailers publish external dimensions and almost never publish internal bay
// dimensions. A binary pass/fail gate would therefore reject most of the
// market for saying nothing, which measures the retailer's product page rather
// than the console. So every verdict is one of three values, and `unknown` is
// a first-class answer that the UI surfaces rather than hides.
//
// This module answers geometry only — no scoring, no ranking, no formatting
// beyond the human-readable `notes`.
import {
  MIN_TOP_DEPTH_CM,
  MIN_TOP_WIDTH_CM,
  PS5_BAY_DEPTH_CM,
  PS5_BAY_HEIGHT_CM,
  PS5_BAY_WIDTH_CM,
  SOUNDBAR_WIDTH_CM,
  TV_STAND_DEPTH_CM,
  type Bay,
  type TvConsole,
} from "./types";

export type Verdict = "pass" | "fail" | "unknown";

export interface Fit {
  /** R1: the stand lands on the surface. */
  tv: Verdict;
  /** R2: the bar sits in front of the TV, one behind the other. */
  soundbar: Verdict;
  /** R3: a PS5 lies flat in an open bay. */
  ps5: Verdict;
  /** fail if anything fails; else unknown if anything is unknown; else pass. */
  overall: Verdict;
  /** Human-readable shortfalls and confirmations, for the card and drawer. */
  notes: string[];
}

/** Bays a console can actually house a PS5 in. A solid door traps heat and
 *  blocks the disc slot; a drawer cannot take a running console at all. */
const PS5_CAPABLE: Bay["kind"][] = ["open", "glass-door"];

const isMeasured = (b: Bay): boolean => b.widthCm != null && b.heightCm != null && b.depthCm != null;

/** Largest fully-measured PS5-capable bay, by volume. Returns null when no bay
 *  is both capable and measured — which is a different statement from "no bay
 *  is big enough", and callers must keep the two apart. */
export function largestOpenBay(bays: Bay[]): Bay | null {
  const candidates = bays.filter((b) => PS5_CAPABLE.includes(b.kind) && isMeasured(b));
  if (!candidates.length) return null;
  const volume = (b: Bay) => (b.widthCm ?? 0) * (b.heightCm ?? 0) * (b.depthCm ?? 0);
  return [...candidates].sort((a, b) => volume(b) - volume(a))[0];
}

/** Closed storage in litres, for games, discs and controllers (R6). Counts
 *  doors and drawers only, multiplied by `count`. Null when nothing closed is
 *  measured — again, distinct from "has no closed storage". */
export function closedStorageLitres(bays: Bay[]): number | null {
  const closed = bays.filter((b) => (b.kind === "door" || b.kind === "drawer") && isMeasured(b));
  if (!closed.length) return null;
  const cm3 = closed.reduce(
    (sum, b) => sum + (b.widthCm ?? 0) * (b.heightCm ?? 0) * (b.depthCm ?? 0) * Math.max(1, b.count),
    0,
  );
  return Math.round(cm3 / 100) / 10; // cm³ → litres, one decimal
}

/** Requirement per axis, so partial evidence can be judged axis by axis. */
const AXES = [
  { key: "widthCm", need: PS5_BAY_WIDTH_CM, short: "too narrow" },
  { key: "depthCm", need: PS5_BAY_DEPTH_CM, short: "too shallow" },
  { key: "heightCm", need: PS5_BAY_HEIGHT_CM, short: "too low" },
] as const;

/** Every axis measured, and every one of them clears its requirement. */
function bayDefinitelyFits(b: Bay): boolean {
  return AXES.every((a) => b[a.key] != null && (b[a.key] as number) >= a.need);
}

/** At least one MEASURED axis is below requirement.
 *
 *  A single known-failing dimension settles the question — a 10cm-high shelf
 *  cannot take a 9.6cm console with airflow no matter what its unpublished
 *  depth turns out to be. Treating that as "unknown" because some other axis
 *  is missing would let a definitively-too-small bay survive the default
 *  filter, which is the opposite of the tri-state design's purpose: unknown is
 *  for absent evidence, not for evidence we have and don't like. */
function bayDefinitelyFails(b: Bay): boolean {
  return AXES.some((a) => b[a.key] != null && (b[a.key] as number) < a.need);
}

function ps5Verdict(bays: Bay[], notes: string[]): Verdict {
  const capable = bays.filter((b) => PS5_CAPABLE.includes(b.kind));

  // No compartments recorded at all — we know nothing, not that it fails.
  if (!capable.length) {
    if (!bays.length) return "unknown";
    notes.push("No open bay — only doors and drawers, which can't take a running PS5");
    return "fail";
  }

  // A fully-measured bay that fits settles it.
  const winner = capable.find(bayDefinitelyFits);
  if (winner) {
    notes.push(
      `PS5 bay: ${winner.widthCm}\u00d7${winner.depthCm}\u00d7${winner.heightCm}cm \u2014 takes a Slim lying flat with room to breathe`,
    );
    return "pass";
  }

  // Anything not ruled out on a measured axis could still fit once the
  // missing dimensions are known.
  const open = capable.filter((b) => !bayDefinitelyFails(b));
  if (open.length) {
    const partial = open.find((b) => AXES.some((a) => b[a.key] != null));
    if (partial) {
      const known = AXES.filter((a) => partial[a.key] != null)
        .map((a) => `${a.key.replace("Cm", "")} ${partial[a.key]}cm`)
        .join(", ");
      notes.push(`Open bay ${known} — the rest of its internal size isn't published`);
    }
    return "unknown";
  }

  // Every capable bay has a measured axis below requirement.
  const worst = capable.find(bayDefinitelyFails);
  if (worst) {
    const failed = AXES.filter((a) => worst[a.key] != null && (worst[a.key] as number) < a.need).map(
      (a) => `${a.need - (worst[a.key] as number)}cm ${a.short}`,
    );
    notes.push(`Biggest open bay is ${failed.join(", ")} for a flat PS5`);
  }
  return "fail";
}

export function fitFor(c: TvConsole): Fit {
  const notes: string[] = [];
  const w = c.topWidthCm;
  const d = c.topDepthCm;

  // --- R1: the TV stand lands on the surface ---
  let tv: Verdict;
  if (w == null || d == null) {
    tv = "unknown";
  } else if (w >= MIN_TOP_WIDTH_CM && d >= TV_STAND_DEPTH_CM) {
    tv = "pass";
  } else {
    tv = "fail";
    if (w < MIN_TOP_WIDTH_CM) {
      notes.push(`${w}cm wide — the TV's ${MIN_TOP_WIDTH_CM}cm stand would overhang`);
    }
    if (d < TV_STAND_DEPTH_CM) {
      notes.push(`${d}cm deep — the TV base alone needs ${TV_STAND_DEPTH_CM}cm`);
    }
  }

  // --- R2: the soundbar sits in front of the TV ---
  let soundbar: Verdict;
  if (d == null) {
    soundbar = "unknown";
  } else if (d >= MIN_TOP_DEPTH_CM && (w == null || w >= SOUNDBAR_WIDTH_CM)) {
    soundbar = "pass";
    notes.push(`${d}cm deep — TV base and soundbar sit one behind the other`);
  } else {
    soundbar = "fail";
    if (d < MIN_TOP_DEPTH_CM) {
      const gap = Math.round((MIN_TOP_DEPTH_CM - d) * 10) / 10;
      notes.push(`${d}cm top depth — ${gap}cm short for the TV base and soundbar in line`);
    } else if (w != null && w < SOUNDBAR_WIDTH_CM) {
      notes.push(`${w}cm wide — narrower than the ${SOUNDBAR_WIDTH_CM}cm soundbar`);
    }
  }

  // --- R3: a PS5 lies flat ---
  const ps5 = ps5Verdict(c.bays, notes);

  const all = [tv, soundbar, ps5];
  const overall: Verdict = all.includes("fail") ? "fail" : all.includes("unknown") ? "unknown" : "pass";

  return { tv, soundbar, ps5, overall, notes };
}

/** Short label for the card chip. */
export function fitLabel(f: Fit): string {
  if (f.overall === "pass") return "Fits TV, bar & PS5";
  if (f.overall === "unknown") return "Fit unconfirmed";
  const failed = [f.tv === "fail" && "TV", f.soundbar === "fail" && "soundbar", f.ps5 === "fail" && "PS5"].filter(
    Boolean,
  );
  return `Won't fit ${failed.join(" or ")}`;
}
