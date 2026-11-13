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
  /** Approximate weekday 07:00–09:00 trains per hour from this station into
   *  any London terminus. Estimated from typical published timetables, not
   *  checked one by one: verify before deciding, like `mins`. */
  peakPerHour: number;
}

export const LONDON = { lat: 51.507, lng: -0.128 };

export const STATIONS: Record<string, StationInfo> = {
  croydon: { lat: 51.375, lng: -0.093, mins: 15, terminus: "Victoria", peakPerHour: 20, label: "below" },
  slough: { lat: 51.512, lng: -0.591, mins: 20, terminus: "Paddington", peakPerHour: 10, label: "left" },
  "st-albans": { lat: 51.75, lng: -0.327, mins: 20, terminus: "St Pancras", peakPerHour: 10, label: "left" },
  hatfield: { lat: 51.764, lng: -0.215, mins: 25, terminus: "King's Cross", peakPerHour: 6, label: "below" },
  stevenage: { lat: 51.902, lng: -0.207, mins: 25, terminus: "King's Cross", peakPerHour: 6, label: "right" },
  woking: { lat: 51.318, lng: -0.557, mins: 25, terminus: "Waterloo", peakPerHour: 14, label: "above" },
  reading: { lat: 51.459, lng: -0.972, mins: 25, terminus: "Paddington", peakPerHour: 14, label: "below" },
  "high-wycombe": { lat: 51.63, lng: -0.745, mins: 25, terminus: "Marylebone", peakPerHour: 5, label: "left" },
  luton: { lat: 51.882, lng: -0.414, mins: 25, terminus: "St Pancras", peakPerHour: 8, label: "left" },
  dartford: { lat: 51.447, lng: 0.219, mins: 30, terminus: "London Bridge", peakPerHour: 10, label: "below" },
  harlow: { lat: 51.781, lng: 0.095, mins: 35, terminus: "Liverpool Street", peakPerHour: 4, label: "right" },
  chelmsford: { lat: 51.736, lng: 0.469, mins: 35, terminus: "Liverpool Street", peakPerHour: 10, label: "below" },
  "milton-keynes": { lat: 52.034, lng: -0.774, mins: 35, terminus: "Euston", peakPerHour: 8, label: "left" },
  guildford: { lat: 51.237, lng: -0.58, mins: 35, terminus: "Waterloo", peakPerHour: 8, label: "right" },
  medway: { lat: 51.386, lng: 0.51, mins: 40, terminus: "St Pancras", peakPerHour: 8, label: "below" },
  bedford: { lat: 52.136, lng: -0.479, mins: 40, terminus: "St Pancras", peakPerHour: 8, label: "right" },
  basingstoke: { lat: 51.268, lng: -1.087, mins: 45, terminus: "Waterloo", peakPerHour: 6, label: "right" },
};
