// Turning a research CSV row into a listing. Pure, so it can be tested
// without a database. The research marks uncaptured fields as "n/c"; those
// become null and are never guessed.
import type { HomeListing, ListedEvent, ListingStatus, Tenure } from "./types";

export type ListingRow = Record<string, string>;

/** Columns that map onto listing fields. Everything else is kept in `raw`. */
const PROMOTED = new Set([
  "town", "listing_url", "source", "agent", "price_gbp", "price_qualifier", "address",
  "property_type", "new_build", "tenure", "lease_years_remaining", "service_charge_pa",
  "ground_rent_pa", "beds", "baths", "floor_area", "council_tax", "epc",
  "date_listed_or_changed", "distance_to_station", "key_features",
  "photo_1", "photo_2", "photo_3", "checked", "garden", "parking", "lat", "lng",
]);

/** "n/c", "n/a", blank and friends mean "we don't know". */
export function blank(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "" || s === "-" || /^(n\/c|n\/a|na|none shown|unknown|not stated)\b/.test(s);
}

export function str(v: string | undefined): string | null {
  return blank(v) ? null : (v ?? "").trim();
}

export function num(v: string | undefined): number | null {
  if (blank(v)) return null;
  const m = /(-?\d+(?:\.\d+)?)/.exec((v ?? "").replace(/,/g, ""));
  return m ? Number(m[1]) : null;
}

/** "10/11/2026" → "2026-11-10". UK day-first. */
export function ukDate(v: string | undefined): string | null {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v ?? "");
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** A stable id from the portal's own property number. */
export function listingId(url: string, source: string): string | null {
  const rm = /rightmove\.co\.uk\/properties\/(\d+)/.exec(url);
  if (rm) return `rightmove-${rm[1]}`;
  const zp = /zoopla\.co\.uk\/(?:for-sale|new-homes)\/details\/(\d+)/.exec(url);
  if (zp) return `zoopla-${zp[1]}`;
  const otm = /onthemarket\.com\/details\/(\d+)/.exec(url);
  if (otm) return `onthemarket-${otm[1]}`;
  const digits = /(\d{6,})/.exec(url);
  return digits ? `${source.toLowerCase().replace(/\W+/g, "")}-${digits[1]}` : null;
}

export function parseNewBuild(v: string | undefined): boolean | null {
  const s = (v ?? "").trim().toLowerCase();
  if (s.startsWith("yes") || s.includes("brand new")) return true;
  if (s.startsWith("no")) return false;
  return null;
}

export function parseTenure(v: string | undefined): Tenure | null {
  const s = (v ?? "").toLowerCase();
  if (s.includes("share of freehold")) return "share-of-freehold";
  if (/\bfreehold\b/.test(s)) return "freehold";
  if (s.includes("leasehold") || s.includes("long lease")) return "leasehold";
  return null;
}

export function parseListed(v: string | undefined): { event: ListedEvent | null; date: string | null } {
  const s = (v ?? "").toLowerCase();
  const event: ListedEvent | null = s.startsWith("added")
    ? "added"
    : s.startsWith("reduced")
      ? "reduced"
      : s.startsWith("listed")
        ? "listed"
        : null;
  return { event, date: ukDate(v) };
}

/** "0.22 mi (Rightmove)" → 0.22. Anything not in miles is left null. */
export function parseMiles(v: string | undefined): number | null {
  const m = /(\d+(?:\.\d+)?)\s*mi\b/.exec(v ?? "");
  return m ? Number(m[1]) : null;
}

export function parseStatus(qualifier: string | null, features: string): ListingStatus {
  const s = `${qualifier ?? ""} ${features}`.toLowerCase();
  if (s.includes("sold stc")) return "sold-stc";
  if (s.includes("under offer")) return "under-offer";
  if (s.includes("coming soon")) return "coming-soon";
  return "available";
}

export const splitFeatures = (v: string | undefined): string[] =>
  (v ?? "").split(";").map((x) => x.trim()).filter(Boolean);

export function townIdOf(town: string): string {
  return town.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** One CSV row → a listing as seen on `checked` date. Null if the row is unusable. */
export function rowToListing(r: ListingRow): Omit<HomeListing, "pref" | "priceHistory" | "firstSeenAt"> | null {
  const url = str(r.listing_url);
  const source = str(r.source) ?? "Unknown";
  const price = num(r.price_gbp);
  const town = str(r.town);
  if (!url || price == null || !town) return null;
  const id = listingId(url, source);
  if (!id) return null;

  const qualifier = str(r.price_qualifier);
  const listed = parseListed(r.date_listed_or_changed);
  const checked = ukDate(r.checked) ?? new Date().toISOString().slice(0, 10);
  const raw = Object.fromEntries(Object.entries(r).filter(([k, v]) => !PROMOTED.has(k) && v.trim() !== ""));
  // Keep the researcher's verbatim wording for fields we normalise.
  for (const k of ["tenure", "new_build", "floor_area", "distance_to_station", "date_listed_or_changed"]) {
    if (r[k]?.trim()) raw[k] = r[k].trim();
  }

  return {
    id,
    townId: townIdOf(town),
    source,
    listingUrl: url,
    agent: str(r.agent),
    priceGbp: price,
    priceQualifier: qualifier,
    address: str(r.address) ?? "Address not shown",
    propertyType: str(r.property_type),
    newBuild: parseNewBuild(r.new_build),
    tenure: parseTenure(r.tenure),
    leaseYears: num(r.lease_years_remaining),
    serviceChargePa: num(r.service_charge_pa),
    groundRentPa: num(r.ground_rent_pa),
    beds: num(r.beds) ?? 2,
    baths: num(r.baths),
    floorAreaSqFt: /sq ?ft/i.test(r.floor_area ?? "") ? num(r.floor_area) : null,
    councilTax: str(r.council_tax),
    epc: str(r.epc),
    listedEvent: listed.event,
    listedOn: listed.date,
    distanceMiles: parseMiles(r.distance_to_station),
    distanceNote: (r.distance_to_station ?? "").trim() || null,
    garden: /^y/i.test(r.garden ?? "") ? true : /^n(o|$)/i.test((r.garden ?? "").trim()) ? false : null,
    parking: str(r.parking),
    lat: num(r.lat),
    lng: num(r.lng),
    keyFeatures: splitFeatures(r.key_features),
    photos: [r.photo_1, r.photo_2, r.photo_3].map((p) => (p ?? "").trim()).filter((p) => p.startsWith("http")),
    status: parseStatus(qualifier, r.key_features ?? ""),
    lastSeenAt: checked,
    raw,
  };
}
