// Pure view logic for the flat-search viewer. Ported verbatim (semantics-identical)
// from the former flat-search/viewer-logic.mjs. Timing + staleness are recomputed
// live at render — never stored — so today's date drives the result each time.
import type {
  Area,
  Budget,
  BudgetTier,
  Listing,
  MoveTiming,
  StaleThresholds,
  StaleTier,
  Scheme,
  TimingFit,
} from "./types";

export function budgetTier(price: number, budget: Budget, scheme: Scheme): BudgetTier {
  if (price <= budget.inMax) return "in";
  if (scheme === "btr" && budget.btrMax && price <= budget.btrMax) return "btr"; // BTR allowed above the std cap
  return "over";
}

export function daysOnMarket(listedDate: string | null, nowMs: number): number | null {
  if (!listedDate) return null;
  return Math.floor((nowMs - Date.parse(listedDate + "T00:00:00Z")) / 86400000);
}

export function staleTier(
  listing: Pick<Listing, "listedDate" | "availableNow">,
  thresholds: StaleThresholds,
  nowMs: number,
): StaleTier {
  const d = daysOnMarket(listing.listedDate, nowMs);
  if (d == null || !listing.availableNow) return "ok";
  if (d > thresholds.problem) return "problem";
  if (d > thresholds.stale) return "stale";
  if (d > thresholds.slow) return "slow";
  return "ok";
}

export function tierRank(tier: string): number {
  return tier === "anchor" ? 0 : Number(tier);
}

// --- Move-timing: earliest move-out is a step function anchored to the rent-period day. ---
// currentPeriodEnd = the anchor day (e.g. 14th) on/after the reference date.
export function currentPeriodEndMs(refMs: number, anchorDay: number): number {
  const r = new Date(refMs);
  let y = r.getUTCFullYear();
  let m = r.getUTCMonth();
  if (r.getUTCDate() > anchorDay) {
    m += 1;
    if (m > 11) {
      m -= 12;
      y += 1;
    }
  }
  return Date.UTC(y, m, anchorDay);
}

// moveOutFloor = currentPeriodEnd + noticePeriodsRequired whole rent periods (months, anchored).
export function moveOutFloorMs(refMs: number, mt: MoveTiming): number {
  const end = new Date(currentPeriodEndMs(refMs, mt.rentPeriodAnchorDay));
  let y = end.getUTCFullYear();
  let m = end.getUTCMonth() + mt.noticePeriodsRequired;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return Date.UTC(y, m, mt.rentPeriodAnchorDay);
}

// Last day notice can be served and still keep the nearest floor (= currentPeriodEnd of today).
export function noticeDeadlineMs(todayMs: number, mt: MoveTiming): number | null {
  if (mt.noticeServedDate) return null; // already served → floor fixed, no deadline
  return currentPeriodEndMs(todayMs, mt.rentPeriodAnchorDay);
}

// Reference date the floor is computed from: a served notice PINS it; otherwise it rolls from today.
export function timingRefMs(todayMs: number, mt: MoveTiming): number {
  return mt.noticeServedDate ? Date.parse(mt.noticeServedDate + "T00:00:00Z") : todayMs;
}

export function availableDateMs(
  listing: Pick<Listing, "availableDate" | "availableNow">,
  nowMs: number,
): number | null {
  if (listing.availableDate) return Date.parse(listing.availableDate + "T00:00:00Z");
  if (listing.availableNow) return nowMs; // available now ⇒ far before the floor ⇒ "early"
  return null;
}

// timingFit: how a listing's availability lines up with the move-out floor.
// d = days the flat is available BEFORE move-out (positive ⇒ overlap/double-rent; negative ⇒ gap).
export function timingFit(
  listing: Pick<Listing, "availableDate" | "availableNow">,
  floorMs: number,
  mt: MoveTiming,
  nowMs: number,
): TimingFit {
  const a = availableDateMs(listing, nowMs);
  if (a == null) return "unknown";
  const d = Math.round((floorMs - a) / 86400000);
  if (d < 0) return "late";
  if (d <= mt.overlapIdealDays) return "ideal";
  if (d <= mt.overlapMaxDays) return "workable";
  return "early";
}

export function timingRank(fit: TimingFit): number {
  return { ideal: 0, workable: 1, unknown: 2, early: 3, late: 4 }[fit] ?? 2;
}

export interface TimingCtx {
  floorMs: number;
  moveTiming: MoveTiming;
  nowMs: number;
}

// timingCtx (optional): when passed, well-timed flats sort first within their tier;
// omit it for the original tier→scheme→phase→price order.
export function compareListings(
  a: Listing,
  b: Listing,
  areaById: Record<string, Area>,
  timingCtx?: TimingCtx,
): number {
  const at = tierRank(areaById[a.areaId]?.tier ?? "2") - tierRank(areaById[b.areaId]?.tier ?? "2");
  if (at) return at;
  if (timingCtx) {
    const tr =
      timingRank(timingFit(a, timingCtx.floorMs, timingCtx.moveTiming, timingCtx.nowMs)) -
      timingRank(timingFit(b, timingCtx.floorMs, timingCtx.moveTiming, timingCtx.nowMs));
    if (tr) return tr;
  }
  const sr = (a.scheme === "btr" ? 0 : 1) - (b.scheme === "btr" ? 0 : 1);
  if (sr) return sr;
  return (b.phaseYear ?? 0) - (a.phaseYear ?? 0) || a.price - b.price;
}

export function groupByArea(
  listings: Listing[],
  areas: Area[],
): { area: Area; listings: Listing[] }[] {
  return areas
    .map((area) => ({ area, listings: listings.filter((x) => x.areaId === area.id) }))
    .filter((g) => g.listings.length > 0);
}
