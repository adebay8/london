// What to check before trusting a listing. Derived live from the stored row,
// never persisted, so changing the brief re-flags everything at once.
//
// Each flag has a tone:
//   "verify"  — information is missing; open the listing to fill it in
//   "warn"    — something that could rule it out or cost money
//   "info"    — worth knowing, not a problem by itself
import { BRIEF, isNewBuildBlock, type HomeListing } from "./types";

export type FlagTone = "verify" | "warn" | "info";

export interface Flag {
  id: string;
  tone: FlagTone;
  label: string;
  detail: string;
}

type L = Pick<
  HomeListing,
  | "id" | "townId" | "priceGbp" | "priceQualifier" | "address" | "tenure" | "leaseYears"
  | "serviceChargePa" | "councilTax" | "epc" | "distanceMiles" | "distanceNote" | "listedOn"
  | "status" | "keyFeatures" | "floorAreaSqFt" | "raw" | "beds" | "lat" | "lng" | "source"
  | "propertyType" | "newBuild"
>;

/** The upper end of a guide range written as "£425k–£475k", if any. */
export function guideCeiling(qualifier: string | null): number | null {
  const m = /£\s*(\d+(?:\.\d+)?)\s*k?\s*[–-]\s*£\s*(\d+(?:\.\d+)?)\s*(k)?/i.exec(qualifier ?? "");
  if (!m) return null;
  const n = Number(m[2]);
  return m[3] || n < 10_000 ? n * 1000 : n;
}

/** Fields the brief needs that a search-results page never shows. */
export function missingChecks(l: L): string[] {
  const out: string[] = [];
  if (l.tenure == null) out.push("tenure");
  if (l.tenure !== "freehold" && l.leaseYears == null) out.push("lease length");
  if (l.tenure !== "freehold" && l.serviceChargePa == null) out.push("service charge");
  if (l.councilTax == null) out.push("council tax");
  if (l.epc == null) out.push("EPC");
  return out;
}

/** Normalised address for spotting the same flat listed by two agents. */
export function addressKey(address: string): string {
  return address
    .toLowerCase()
    .replace(/\b(surrey|hertfordshire|essex|berkshire|buckinghamshire|hampshire|kent)\b/g, "")
    .replace(/\b[a-z]{1,2}\d{1,2}[a-z]?(\s*\d[a-z]{2})?\b/g, "") // postcodes
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Which floor a listing says it's on, if it says — "second floor", "10th floor", "top floor". */
export function floorOf(features: string[]): string | null {
  const m = /\b(ground|first|second|third|fourth|fifth|top|\d+(?:st|nd|rd|th))[- ]floor\b/i.exec(features.join(" "));
  return m ? m[1].toLowerCase() : null;
}

/** Ids of listings that look like the same home. A street name and a price
 *  aren't enough on their own — a block can have several identical flats for
 *  sale — so an automatic match also needs the same stated floor. The
 *  researcher's own "possible duplicate of …" notes always count. */
export function duplicateGroups(listings: L[]): Map<string, string[]> {
  const byKey = new Map<string, string[]>();
  for (const l of listings) {
    const floor = floorOf(l.keyFeatures);
    if (!floor) continue;
    const k = `${l.townId}|${addressKey(l.address)}|${l.priceGbp}|${floor}`;
    byKey.set(k, [...(byKey.get(k) ?? []), l.id]);
  }
  const out = new Map<string, string[]>();
  for (const ids of byKey.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) out.set(id, ids.filter((x) => x !== id));
  }
  // The same home on two portals: same price and bedrooms, pinned within
  // about 40 m of each other. Two listings on one portal are never merged
  // this way — a block can have identical flats for sale. Bucketed by price
  // and beds so a pass of thousands stays fast.
  const buckets = new Map<string, L[]>();
  for (const l of listings) {
    if (l.lat == null || l.lng == null) continue;
    const key = `${l.priceGbp}|${l.beds}`;
    buckets.set(key, [...(buckets.get(key) ?? []), l]);
  }
  for (const group of buckets.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (a.source === b.source) continue;
        const dLat = (a.lat! - b.lat!) * 111_000;
        const dLng = (a.lng! - b.lng!) * 69_000;
        if (Math.hypot(dLat, dLng) > 40) continue;
        out.set(a.id, [...new Set([...(out.get(a.id) ?? []), b.id])]);
        out.set(b.id, [...new Set([...(out.get(b.id) ?? []), a.id])]);
      }
    }
  }
  // The researcher may also have named a duplicate outright.
  for (const l of listings) {
    for (const f of l.keyFeatures) {
      const m = /possible duplicate of (\d+)/i.exec(f);
      if (!m) continue;
      const other = listings.find((x) => x.id.endsWith(`-${m[1]}`));
      if (other) out.set(l.id, [...new Set([...(out.get(l.id) ?? []), other.id])]);
    }
  }
  return out;
}

export function flagsFor(l: L, opts: { duplicates?: string[]; today?: Date } = {}): Flag[] {
  const flags: Flag[] = [];
  const today = opts.today ?? new Date();

  const missing = missingChecks(l);
  if (missing.length) {
    flags.push({
      id: "verify",
      tone: "verify",
      label: "Check listing",
      detail: `Not on the results page: ${missing.join(", ")}.`,
    });
  }

  if (l.leaseYears != null && l.leaseYears < BRIEF.minLeaseYears) {
    flags.push({ id: "short-lease", tone: "warn", label: "Short lease", detail: `${l.leaseYears} years left; lenders want ${BRIEF.minLeaseYears}+.` });
  }
  if (l.serviceChargePa != null && l.serviceChargePa > BRIEF.serviceChargeFlagGbp) {
    flags.push({
      id: "service-charge",
      tone: "warn",
      label: "High service charge",
      detail: `£${l.serviceChargePa.toLocaleString()} a year, over £${BRIEF.serviceChargeFlagGbp.toLocaleString()}.`,
    });
  }

  const ceiling = guideCeiling(l.priceQualifier);
  if (l.priceGbp > BRIEF.maxPriceGbp || (ceiling != null && ceiling > BRIEF.maxPriceGbp)) {
    flags.push({
      id: "over-budget",
      tone: "warn",
      label: `Over the £${BRIEF.maxPriceGbp / 1000}k cap`,
      detail: ceiling ? `Guide range goes up to £${ceiling.toLocaleString()}.` : `Above £${BRIEF.maxPriceGbp.toLocaleString()}.`,
    });
  }

  if (l.distanceMiles == null) {
    flags.push({ id: "distance", tone: "verify", label: "Distance unknown", detail: l.distanceNote ?? "No distance to the station was stated." });
  } else if (l.distanceMiles > BRIEF.maxWalkMiles) {
    flags.push({ id: "far", tone: "warn", label: "Beyond walking range", detail: `${l.distanceMiles} mi; the brief is about ${BRIEF.maxWalkMiles} mi (1.2 km).` });
  }

  if (l.status === "coming-soon") {
    flags.push({ id: "coming-soon", tone: "info", label: "Coming soon", detail: "Not yet released for sale." });
  } else if (l.status === "sold-stc" || l.status === "under-offer") {
    flags.push({ id: "taken", tone: "warn", label: l.status === "sold-stc" ? "Sold STC" : "Under offer", detail: "Probably no longer available." });
  }

  const blob = `${l.keyFeatures.join(" ")} ${l.priceQualifier ?? ""}`.toLowerCase();
  if (/incentive|deposit[- ]boost|deposit contribution|low mortgage/.test(blob)) {
    flags.push({ id: "scheme", tone: "info", label: "Incentive or scheme", detail: "Confirm it isn't shared ownership or a restricted scheme." });
  }

  const listedNote = `${l.raw.date_listed_or_changed ?? ""}`.toLowerCase();
  const ageDays = l.listedOn ? (today.getTime() - Date.parse(l.listedOn)) / 86_400_000 : null;
  if (/stale|long-running/.test(listedNote) || (ageDays != null && ageDays > BRIEF.staleAfterDays)) {
    flags.push({ id: "stale", tone: "info", label: "Possibly stale", detail: l.listedOn ? `Listed since ${l.listedOn}.` : "Long-running listing." });
  }

  if (opts.duplicates?.length) {
    flags.push({
      id: "duplicate",
      tone: "info",
      label: "Possible duplicate",
      detail: `Looks like the same home as ${opts.duplicates.map((d) => d.replace(/^[a-z]+-/, "#")).join(", ")}.`,
    });
  }

  if (isNewBuildBlock(l)) {
    flags.push({ id: "block", tone: "info", label: "New-build block", detail: "A flat in a modern block: the kind you're leaning away from. Ranked below houses and low-rise homes." });
  }

  const dataIssue =
    (l.floorAreaSqFt != null && l.floorAreaSqFt < 200) || /ai-generated|data error/.test(blob + " " + (l.raw.floor_area ?? "").toLowerCase());
  if (dataIssue) {
    flags.push({ id: "data", tone: "warn", label: "Data looks wrong", detail: "A figure or photo on this listing doesn't add up — check the page." });
  }

  return flags;
}

/** True when nothing but missing fields stands in the way. */
export const onlyNeedsChecking = (flags: Flag[]) => flags.every((f) => f.tone !== "warn");
