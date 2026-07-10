// Shared flat-search types. The DB (Prisma Flat* models) is the source of truth;
// these are the plain-object shapes the view-logic and reconcile core operate on.

export type Scheme = "btr" | "private" | "unknown";
export type Furnishing = "furnished" | "unfurnished" | "either";
export type BudgetTier = "in" | "btr" | "over";
export type ListingStatus = "active" | "gone";
export type GoneReason = "removed" | "let-agreed";
export type TimingFit = "ideal" | "workable" | "early" | "late" | "unknown";
export type StaleTier = "ok" | "slow" | "stale" | "problem";
export type Pref = "want" | "reject";

export interface Budget {
  min: number;
  inMax: number;
  searchMax: number;
  btrMax: number;
}

export interface StaleThresholds {
  slow: number;
  stale: number;
  problem: number;
}

export interface MoveTiming {
  rentPeriodAnchorDay: number;
  noticePeriodsRequired: number;
  overlapIdealDays: number;
  overlapMaxDays: number;
  noticeServedDate: string | null;
}

export interface FlatConfig {
  budget: Budget;
  staleThresholds: StaleThresholds;
  moveTiming: MoveTiming;
  lastRun: string | null;
}

export interface Area {
  id: string;
  name: string;
  borough: string;
  zone: string;
  tier: string; // "anchor" | "1" | "2"
  expectedBand: string | null;
  sortOrder: number;
  buildingRoster: string[];
  phaseYears: Record<string, number>;
  btrOperators: string[];
  operatorPortals: string[];
  searchUrls: { zoopla?: string; rightmove?: string };
  flags: string[];
}

export interface Source {
  platform: string;
  url: string;
  agent: string | null;
}

export interface Listing {
  id: string;
  areaId: string;
  building: string;
  street: string | null;
  phaseYear: number | null;
  phaseLabel: string | null;
  price: number;
  budgetTier: BudgetTier;
  furnishing: Furnishing;
  available: string | null;
  availableNow: boolean;
  availableDate: string | null;
  listedDate: string | null;
  epc: string | null;
  sizeSqft: number | null;
  scheme: Scheme;
  operator: string | null;
  schemeConfidence: string;
  schemeSource: string | null;
  firstSeen: string;
  lastSeen: string;
  lastConfirmed: string | null;
  status: ListingStatus;
  goneReason: GoneReason | null;
  unconfirmed: boolean;
  isNew: boolean;
  imageUrl: string | null;
  note: string | null;
  sources: Source[];
  pref?: Pref | null;
}
