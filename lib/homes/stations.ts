// Where each station town is, and how long the train takes into London.
//
// `mins` is the approximate fastest regular direct train to the London
// terminus at peak, rounded to 5 minutes. It's a guide for comparing towns,
// not a timetable: check the real journey (and the season ticket) before
// deciding. `label` says which side of the map dot the name sits on, so
// neighbouring towns don't collide.

export interface StationInfo {
  lat: number;
  lng: number;
  mins: number;
  terminus: string;
  label: "left" | "right" | "above" | "below";
}

export const LONDON = { lat: 51.507, lng: -0.128 };

export const STATIONS: Record<string, StationInfo> = {
  croydon: { lat: 51.375, lng: -0.093, mins: 15, terminus: "Victoria", label: "below" },
  slough: { lat: 51.512, lng: -0.591, mins: 20, terminus: "Paddington", label: "above" },
  "st-albans": { lat: 51.75, lng: -0.327, mins: 20, terminus: "St Pancras", label: "left" },
  hatfield: { lat: 51.764, lng: -0.215, mins: 25, terminus: "King's Cross", label: "below" },
  stevenage: { lat: 51.902, lng: -0.207, mins: 25, terminus: "King's Cross", label: "right" },
  woking: { lat: 51.318, lng: -0.557, mins: 25, terminus: "Waterloo", label: "above" },
  reading: { lat: 51.459, lng: -0.972, mins: 25, terminus: "Paddington", label: "above" },
  "high-wycombe": { lat: 51.63, lng: -0.745, mins: 25, terminus: "Marylebone", label: "above" },
  luton: { lat: 51.882, lng: -0.414, mins: 25, terminus: "St Pancras", label: "left" },
  dartford: { lat: 51.447, lng: 0.219, mins: 30, terminus: "London Bridge", label: "below" },
  harlow: { lat: 51.781, lng: 0.095, mins: 35, terminus: "Liverpool Street", label: "above" },
  chelmsford: { lat: 51.736, lng: 0.469, mins: 35, terminus: "Liverpool Street", label: "above" },
  "milton-keynes": { lat: 52.034, lng: -0.774, mins: 35, terminus: "Euston", label: "left" },
  guildford: { lat: 51.237, lng: -0.58, mins: 35, terminus: "Waterloo", label: "right" },
  medway: { lat: 51.386, lng: 0.51, mins: 40, terminus: "St Pancras", label: "below" },
  bedford: { lat: 52.136, lng: -0.479, mins: 40, terminus: "St Pancras", label: "right" },
  basingstoke: { lat: 51.268, lng: -1.087, mins: 45, terminus: "Waterloo", label: "right" },
};
