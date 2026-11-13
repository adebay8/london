// Buying a home: 2–3 bed homes for sale within walking distance of a commuter
// station. The brief lives here so the importer, flags and page agree on it.

export const BRIEF = {
  minPriceGbp: 200_000,
  /** The hard cap. Nothing above it is worth chasing. */
  maxPriceGbp: 500_000,
  minBeds: 2,
  maxBeds: 3,
  /** Portals are searched this far out; the walk flag starts at maxWalkMiles. */
  searchRadiusMiles: 1,
  /** 1.2 km walking ≈ 0.75 miles. Portal distances are probably straight-line. */
  maxWalkMiles: 0.75,
  /** Lease length below which mortgage lenders get nervous. */
  minLeaseYears: 90,
  /** Service charge per year above which we flag it. */
  serviceChargeFlagGbp: 2_500,
  /** A listing older than this is probably stale. */
  staleAfterDays: 365,
} as const;

export type Tenure = "leasehold" | "freehold" | "share-of-freehold";
export type ListingStatus = "available" | "coming-soon" | "under-offer" | "sold-stc" | "withdrawn";
export type ListedEvent = "added" | "reduced" | "listed";
export type Pref = "want" | "reject";

export interface PricePoint {
  date: string; // ISO date
  priceGbp: number;
}

export interface Lead {
  label: string;
  priceGbp: number | null;
}

export interface BuyTown {
  id: string;
  town: string;
  station: string;
  searched: string | null;
  gap: string | null;
  policy: string | null;
  nextAction: string | null;
  leads: Lead[];
  lastSearchedAt: string | null;
}

export interface HomeListing {
  id: string;
  townId: string;
  source: string;
  listingUrl: string;
  agent: string | null;

  priceGbp: number;
  priceQualifier: string | null;
  address: string;
  propertyType: string | null;
  newBuild: boolean | null;

  tenure: Tenure | null;
  leaseYears: number | null;
  serviceChargePa: number | null;
  groundRentPa: number | null;

  beds: number;
  baths: number | null;
  floorAreaSqFt: number | null;
  councilTax: string | null;
  epc: string | null;

  listedEvent: ListedEvent | null;
  listedOn: string | null; // ISO date

  distanceMiles: number | null;
  distanceNote: string | null;

  garden: boolean | null;
  parking: string | null;
  lat: number | null;
  lng: number | null;

  keyFeatures: string[];
  photos: string[];
  /** Set by /api/homes, which sends only the first photo; the full count is here. */
  photoCount?: number;
  status: ListingStatus;

  firstSeenAt: string;
  lastSeenAt: string;
  priceHistory: PricePoint[];
  raw: Record<string, string>;

  pref: Pref | null;
}

/** What kind of home it is, in the terms the brief cares about: houses are
 *  preferred, maisonettes and conversions sit between, flats last. */
export type HomeKind = "house" | "maisonette" | "flat";

export function homeKind(l: Pick<HomeListing, "propertyType">): HomeKind {
  // Building names ("Apartment (Leon House)") sit in brackets, so drop them first.
  const t = (l.propertyType ?? "").replace(/\(.*\)/g, "").toLowerCase();
  if (/\bhouse\b|terrace|semi|detached|bungalow|cottage|town ?house/.test(t)) return "house";
  if (/maisonette|conversion|duplex/.test(t)) return "maisonette";
  return "flat";
}

/** A flat in a modern block with lifts — the kind the user is leaning away
 *  from. Shown and ranked lower, never hidden by default. */
export function isNewBuildBlock(l: Pick<HomeListing, "propertyType" | "newBuild" | "keyFeatures">): boolean {
  if (homeKind(l) !== "flat") return false;
  const f = l.keyFeatures.join(" ").toLowerCase();
  const tall = /\blift\b|concierge|penthouse|tower|\b([4-9]|1\d|2\d)(st|nd|rd|th) floor|fourth floor|fifth floor|sixth floor|seventh floor|eighth floor|ninth floor|tenth floor/.test(f);
  return l.newBuild === true || tall;
}
