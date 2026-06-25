// Pure view logic. Single source of truth — inlined verbatim into flats.html between
// /*LOGIC_START*/ and /*LOGIC_END*/ so the tested logic and the rendered logic cannot drift.
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
export function compareListings(a, b, areaById) {
  const at = tierRank(areaById[a.area]?.tier ?? 2) - tierRank(areaById[b.area]?.tier ?? 2);
  if (at) return at;
  const sr = (a.scheme === "btr" ? 0 : 1) - (b.scheme === "btr" ? 0 : 1);
  if (sr) return sr;
  return (b.phaseYear - a.phaseYear) || (a.price - b.price);
}
export function groupByArea(listings, areas) {
  return areas
    .map(area => ({ area, listings: listings.filter(x => x.area === area.id) }))
    .filter(g => g.listings.length > 0);
}
