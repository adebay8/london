// Council Tax Band D rates per London borough (2025-26, annual, total including GLA precept)
// Source: GOV.UK "Council Tax levels set by local authorities in England 2025 to 2026"

export const COUNCIL_TAX_BAND_D: Record<string, number> = {
  "Barking and Dagenham": 2098.14,
  "Barnet": 2035.52,
  "Bexley": 2258.03,
  "Brent": 2133.15,
  "Bromley": 2042.46,
  "Camden": 2106.69,
  "City": 1274.07,
  "Croydon": 2480.48,
  "Ealing": 2041.02,
  "Enfield": 2164.02,
  "Greenwich": 2011.81,
  "Hackney": 1966.51,
  "Hammersmith and Fulham": 1451.42,
  "Haringey": 2207.94,
  "Harrow": 2395.86,
  "Havering": 2313.55,
  "Hillingdon": 1952.38,
  "Hounslow": 2085.82,
  "Islington": 2012.10,
  "Kensington and Chelsea": 1591.59,
  "Kingston upon Thames": 2489.34,
  "Lambeth": 1953.95,
  "Lewisham": 2135.13,
  "Merton": 2094.43,
  "Newham": 1855.96,
  "Redbridge": 2189.67,
  "Richmond upon Thames": 2372.07,
  "Southwark": 1877.90,
  "Sutton": 2269.72,
  "Tower Hamlets": 1754.57,
  "Waltham Forest": 2277.65,
  "Wandsworth": 997.75,
  "Westminster": 1019.00,
};

// Band ratios relative to Band D (multiply Band D by this to get any band)
export const BAND_RATIOS: Record<string, number> = {
  A: 6 / 9,
  B: 7 / 9,
  C: 8 / 9,
  D: 9 / 9,
  E: 11 / 9,
  F: 13 / 9,
  G: 15 / 9,
  H: 18 / 9,
};

export const BANDS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export type Band = (typeof BANDS)[number];

// TfL PAYG daily caps (peak, 2025) — what you pay per day when tapping contactless/Oyster
// Travelling from zone N to zone 1
// Source: TfL fares page
export const PAYG_DAILY_CAP: Record<number, number> = {
  1: 8.10,
  2: 8.10,
  3: 9.60,
  4: 11.70,
  5: 13.90,
  6: 14.90,
};

// Average weeks per month
const WEEKS_PER_MONTH = 52 / 12; // ~4.33

export const DEFAULT_COMMUTE_DAYS = 3;

export function calculateCouncilTax(borough: string, band: Band = "C", singlePerson: boolean = false): number {
  // Try exact match first, then try matching the first part of compound boroughs
  let annualBandD = COUNCIL_TAX_BAND_D[borough];
  if (annualBandD === undefined) {
    const firstBorough = borough.split(/,\s*|\s+and\s+|\s*&\s*/)[0].trim();
    annualBandD = COUNCIL_TAX_BAND_D[firstBorough];
  }
  if (annualBandD === undefined) return 0;

  const annual = annualBandD * BAND_RATIOS[band];
  const monthly = annual / 12;
  return singlePerson ? monthly * 0.75 : monthly;
}

export function calculateCommuteCost(zone: number, daysPerWeek: number = DEFAULT_COMMUTE_DAYS): number {
  const clampedZone = Math.min(Math.max(zone, 1), 6);
  const dailyCap = PAYG_DAILY_CAP[clampedZone] ?? PAYG_DAILY_CAP[6];
  return Math.round(dailyCap * daysPerWeek * WEEKS_PER_MONTH);
}

export interface CostBreakdown {
  rentLow: number;
  rentHigh: number;
  councilTax: number;
  commute: number;
  totalLow: number;
  totalHigh: number;
}

export function calculateTotalMonthlyCost(
  rentLow: number,
  rentHigh: number,
  borough: string,
  zone: number,
  band: Band = "C",
  singlePerson: boolean = false,
  commuteDays: number = DEFAULT_COMMUTE_DAYS
): CostBreakdown {
  const councilTax = Math.round(calculateCouncilTax(borough, band, singlePerson));
  const commute = calculateCommuteCost(zone, commuteDays);
  return {
    rentLow,
    rentHigh,
    councilTax,
    commute,
    totalLow: rentLow + councilTax + commute,
    totalHigh: rentHigh + councilTax + commute,
  };
}
