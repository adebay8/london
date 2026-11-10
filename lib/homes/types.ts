// Buying a home: 2-bed homes for sale within walking distance of a commuter
// station. The brief lives here so the importer, flags and page agree on it.

export const BRIEF = {
  minPriceGbp: 200_000,
  maxPriceGbp: 450_000,
  beds: 2,
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

  keyFeatures: string[];
  photos: string[];
  status: ListingStatus;

  firstSeenAt: string;
  lastSeenAt: string;
  priceHistory: PricePoint[];
  raw: Record<string, string>;

  pref: Pref | null;
}
