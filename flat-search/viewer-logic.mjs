// Pure view logic. Single source of truth — its function bodies are inlined verbatim into
// flats.html (between the logic markers) so the tested logic and the rendered logic cannot drift.
export function budgetTier(price, budget) {
  return price > budget.inMax ? "over" : "in";
}
export function daysOnMarket(listedDate, nowMs) {
  if (!listedDate) return null;
  return Math.floor((nowMs - Date.parse(listedDate + "T00:00:00Z")) / 86400000);
}
export function staleTier(listing, thresholds, nowMs) {
  const d = daysOnMarket(listing.listedDate, nowMs);
  if (d == null || !listing.availableNow) return "ok";
  if (d > thresholds.problem) return "problem";
  if (d > thresholds.stale) return "stale";
  if (d > thresholds.slow) return "slow";
  return "ok";
}
export function tierRank(tier) {
  return tier === "anchor" ? 0 : Number(tier);
}
// --- Move-timing: earliest move-out is a step function anchored to the rent-period day. ---
// currentPeriodEnd = the anchor day (e.g. 14th) on/after the reference date.
export function currentPeriodEndMs(refMs, anchorDay) {
  const r = new Date(refMs);
  let y = r.getUTCFullYear(), m = r.getUTCMonth();
  if (r.getUTCDate() > anchorDay) { m += 1; if (m > 11) { m -= 12; y += 1; } }
  return Date.UTC(y, m, anchorDay);
}
// moveOutFloor = currentPeriodEnd + noticePeriodsRequired whole rent periods (months, anchored).
export function moveOutFloorMs(refMs, mt) {
  const end = new Date(currentPeriodEndMs(refMs, mt.rentPeriodAnchorDay));
  let y = end.getUTCFullYear(), m = end.getUTCMonth() + mt.noticePeriodsRequired;
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return Date.UTC(y, m, mt.rentPeriodAnchorDay);
}
// Last day notice can be served and still keep the nearest floor (= currentPeriodEnd of today).
export function noticeDeadlineMs(todayMs, mt) {
  if (mt.noticeServedDate) return null; // already served → floor fixed, no deadline
  return currentPeriodEndMs(todayMs, mt.rentPeriodAnchorDay);
}
// Reference date the floor is computed from: a served notice PINS it; otherwise it rolls from today.
export function timingRefMs(todayMs, mt) {
  return mt.noticeServedDate ? Date.parse(mt.noticeServedDate + "T00:00:00Z") : todayMs;
}
export function availableDateMs(listing, nowMs) {
  if (listing.availableDate) return Date.parse(listing.availableDate + "T00:00:00Z");
  if (listing.availableNow) return nowMs; // available now ⇒ far before the floor ⇒ "early"
  return null;
}
// timingFit: how a listing's availability lines up with the move-out floor.
// d = days the flat is available BEFORE move-out (positive ⇒ overlap/double-rent; negative ⇒ gap).
export function timingFit(listing, floorMs, mt, nowMs) {
  const a = availableDateMs(listing, nowMs);
  if (a == null) return "unknown";
  const d = Math.round((floorMs - a) / 86400000);
  if (d < 0) return "late";
  if (d <= mt.overlapIdealDays) return "ideal";
  if (d <= mt.overlapMaxDays) return "workable";
  return "early";
}
export function timingRank(fit) {
  return { ideal: 0, workable: 1, unknown: 2, early: 3, late: 4 }[fit] ?? 2;
}
// timingCtx (optional) = { floorMs, moveTiming, nowMs }. When passed, well-timed flats sort first
// within their tier; omit it for the original tier→scheme→phase→price order.
export function compareListings(a, b, areaById, timingCtx) {
  const at = tierRank(areaById[a.area]?.tier ?? 2) - tierRank(areaById[b.area]?.tier ?? 2);
  if (at) return at;
  if (timingCtx) {
    const tr = timingRank(timingFit(a, timingCtx.floorMs, timingCtx.moveTiming, timingCtx.nowMs)) -
               timingRank(timingFit(b, timingCtx.floorMs, timingCtx.moveTiming, timingCtx.nowMs));
    if (tr) return tr;
  }
  const sr = (a.scheme === "btr" ? 0 : 1) - (b.scheme === "btr" ? 0 : 1);
  if (sr) return sr;
  return (b.phaseYear - a.phaseYear) || (a.price - b.price);
}
export function groupByArea(listings, areas) {
  return areas
    .map(area => ({ area, listings: listings.filter(x => x.area === area.id) }))
    .filter(g => g.listings.length > 0);
}
