// --- Database row shapes (returned from API routes) ---

export interface NeighbourhoodRow {
  id: string;
  name: string;
  borough: string;
  zone: number;
  postcodes: string;
  status: string | null;
  updatedAt: string;
}

export interface ResearchProfileRow {
  id: string;
  neighbourhoodId: string;
  overview: string;
  safety: SafetyScore;
  transport: TransportScore;
  rentValue: RentScore;
  newBuilds: NewBuildsScore;
  amenities: AmenitiesScore;
  areaQuality: AreaQualityScore;
  pros: string[];
  cons: string[];
  fitScore: number;
  researchedAt: string;
  modelUsed: string;
  neighbourhood?: NeighbourhoodRow;
}

// --- Sub-score shapes ---

export interface SafetyScore {
  score: number;
  evidence: string;
  sources: string[];
}

export interface TransportScore {
  score: number;
  stations: string[];
  commuteMins: number;
  lines: string[];
  frequency: string;
  sources: string[];
}

export interface RentScore {
  score: number;
  rangeLow: number;
  rangeHigh: number;
  analysis: string;
  sources: string[];
}

export interface NewBuildsScore {
  score: number;
  developments: {
    name: string;
    features: string[];
    priceRange: string;
    url: string;
  }[];
  sources: string[];
}

export interface AmenitiesScore {
  score: number;
  details: string;
  sources: string[];
}

export interface AreaQualityScore {
  score: number;
  evidence: string;
  sources: string[];
}

// --- Research engine shapes ---

export interface PerplexityResult {
  query: string;
  content: string;
  citations: string[];
}

export interface ResearchData {
  overview: string;
  safety: SafetyScore;
  transport: TransportScore;
  rentValue: RentScore;
  newBuilds: NewBuildsScore;
  amenities: AmenitiesScore;
  areaQuality: AreaQualityScore;
  pros: string[];
  cons: string[];
}

// --- Apartment building shapes ---

export interface ApartmentBuildingRow {
  id: string;
  neighbourhoodId: string;
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  googleMapsUri: string;
  types: string[];
  fetchedAt: string;
  neighbourhood?: NeighbourhoodRow;
  amenities?: BuildingAmenityRow[];
  _count?: { amenities: number };
}

export interface BuildingAmenityRow {
  id: string;
  buildingId: string;
  category: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string;
  googleMapsUri: string;
  walkMins: number;
  walkMeters: number;
  fetchedAt: string;
}

// --- Journal shapes ---

export interface JournalEntryRow {
  id: string;
  neighbourhoodId: string | null;
  content: string;
  decision: string | null;
  fitScoreSnapshot: number | null;
  createdAt: string;
  neighbourhood?: { name: string; borough: string } | null;
}

// --- Fit score weights ---

export const FIT_SCORE_WEIGHTS = {
  transport: 0.25,
  safety: 0.25,
  rentValue: 0.2,
  newBuilds: 0.15,
  amenities: 0.1,
  areaQuality: 0.05,
} as const;
