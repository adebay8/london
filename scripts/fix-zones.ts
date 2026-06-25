import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";
import districts from "../data/districts.json";
import * as fs from "fs";

const databaseUrl = process.env.DATABASE_URL ?? "file:./london.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

// --- OS Grid Reference to Lat/Lng conversion ---

const GRID_LETTERS: Record<string, [number, number]> = {};
for (let i = 0; i < 5; i++) {
  for (let j = 0; j < 5; j++) {
    const letter1 = String.fromCharCode(65 + i + (i >= 2 ? 1 : 0)); // skip I
    // H=0, N=500000, S=0, T=500000 etc — use SV origin
    // Grid: S=0,0  T=500000,0  N=0,500000  O=500000,500000  H=0,1000000
    // First letter gives 500km square
  }
}

function osGridToLatLng(gridRef: string): { lat: number; lng: number } | null {
  if (!gridRef || gridRef.length < 4) return null;

  const l1 = gridRef.charCodeAt(0) - 65; // first letter
  const l2 = gridRef.charCodeAt(1) - 65; // second letter
  // Adjust for no 'I'
  const a1 = l1 > 7 ? l1 - 1 : l1;
  const a2 = l2 > 7 ? l2 - 1 : l2;

  // First letter: 500km grid (origin at SV = 0,0)
  const e100 = ((a1 - 2) % 5) * 500000 + (a2 % 5) * 100000;
  const n100 = (19 - Math.floor(a1 / 5) * 5 - Math.floor(a2 / 5)) * 100000;

  const digits = gridRef.slice(2).replace(/\s/g, "");
  const half = digits.length / 2;
  if (half === 0) return null;

  const mult = Math.pow(10, 5 - half);
  const easting = e100 + parseInt(digits.slice(0, half)) * mult;
  const northing = n100 + parseInt(digits.slice(half)) * mult;

  // OSGB36 to WGS84 (Helmert transformation via iterative method)
  return osgb36ToWgs84(easting, northing);
}

function osgb36ToWgs84(E: number, N: number): { lat: number; lng: number } {
  // Airy 1830 ellipsoid
  const a = 6377563.396;
  const b = 6356256.909;
  const F0 = 0.9996012717;
  const lat0 = (49 * Math.PI) / 180;
  const lon0 = (-2 * Math.PI) / 180;
  const N0 = -100000;
  const E0 = 400000;
  const e2 = 1 - (b * b) / (a * a);
  const n = (a - b) / (a + b);

  let lat = lat0;
  let M = 0;
  do {
    lat = ((N - N0 - M) / (a * F0)) + lat;
    M = b * F0 * (
      (1 + n + (5 / 4) * n * n + (5 / 4) * n * n * n) * (lat - lat0) -
      (3 * n + 3 * n * n + (21 / 8) * n * n * n) * Math.sin(lat - lat0) * Math.cos(lat + lat0) +
      ((15 / 8) * n * n + (15 / 8) * n * n * n) * Math.sin(2 * (lat - lat0)) * Math.cos(2 * (lat + lat0)) -
      (35 / 24) * n * n * n * Math.sin(3 * (lat - lat0)) * Math.cos(3 * (lat + lat0))
    );
  } while (Math.abs(N - N0 - M) >= 0.00001);

  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const tanLat = Math.tan(lat);
  const nu = a * F0 / Math.sqrt(1 - e2 * sinLat * sinLat);
  const rho = a * F0 * (1 - e2) / Math.pow(1 - e2 * sinLat * sinLat, 1.5);
  const eta2 = nu / rho - 1;

  const VII = tanLat / (2 * rho * nu);
  const VIII = tanLat / (24 * rho * nu * nu * nu) * (5 + 3 * tanLat * tanLat + eta2 - 9 * tanLat * tanLat * eta2);
  const IX = tanLat / (720 * rho * Math.pow(nu, 5)) * (61 + 90 * tanLat * tanLat + 45 * Math.pow(tanLat, 4));
  const X = 1 / (cosLat * nu);
  const XI = 1 / (6 * cosLat * nu * nu * nu) * (nu / rho + 2 * tanLat * tanLat);
  const XII = 1 / (120 * cosLat * Math.pow(nu, 5)) * (5 + 28 * tanLat * tanLat + 24 * Math.pow(tanLat, 4));

  const dE = E - E0;
  const osgbLat = lat - VII * dE * dE + VIII * Math.pow(dE, 4) - IX * Math.pow(dE, 6);
  const osgbLon = lon0 + X * dE - XI * Math.pow(dE, 3) + XII * Math.pow(dE, 5);

  // Helmert transformation OSGB36 -> WGS84
  const oLat = osgbLat * 180 / Math.PI;
  const oLon = osgbLon * 180 / Math.PI;

  // Approximate Helmert (good enough for UK)
  const tx = 446.448, ty = -125.157, tz = 542.060;
  const s = -20.4894 / 1e6;
  const rx = (0.1502 / 3600) * Math.PI / 180;
  const ry = (0.2470 / 3600) * Math.PI / 180;
  const rz = (0.8421 / 3600) * Math.PI / 180;

  // Convert to cartesian
  const aOSGB = 6377563.396, bOSGB = 6356256.909;
  const eOSGB2 = 1 - (bOSGB * bOSGB) / (aOSGB * aOSGB);
  const sinO = Math.sin(osgbLat), cosO = Math.cos(osgbLat);
  const nuO = aOSGB / Math.sqrt(1 - eOSGB2 * sinO * sinO);

  const x1 = nuO * cosO * Math.cos(osgbLon);
  const y1 = nuO * cosO * Math.sin(osgbLon);
  const z1 = nuO * (1 - eOSGB2) * sinO;

  const x2 = tx + (1 + s) * x1 + (-rz) * y1 + (ry) * z1;
  const y2 = ty + (rz) * x1 + (1 + s) * y1 + (-rx) * z1;
  const z2 = tz + (-ry) * x1 + (rx) * y1 + (1 + s) * z1;

  // Convert back to lat/lng on WGS84 ellipsoid
  const aWGS = 6378137.000, bWGS = 6356752.3142;
  const eWGS2 = 1 - (bWGS * bWGS) / (aWGS * aWGS);
  const p = Math.sqrt(x2 * x2 + y2 * y2);
  let wgsLat = Math.atan2(z2, p * (1 - eWGS2));
  for (let i = 0; i < 10; i++) {
    const nuW = aWGS / Math.sqrt(1 - eWGS2 * Math.sin(wgsLat) * Math.sin(wgsLat));
    wgsLat = Math.atan2(z2 + eWGS2 * nuW * Math.sin(wgsLat), p);
  }
  const wgsLon = Math.atan2(y2, x2);

  return { lat: wgsLat * 180 / Math.PI, lng: wgsLon * 180 / Math.PI };
}

// --- Haversine distance ---

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Main ---

interface TflStation {
  name: string;
  lat: number;
  lng: number;
  zone: number;
}

async function fetchTflStations(): Promise<TflStation[]> {
  console.log("[zones] Fetching stations from TfL API...");
  const modes = ["tube", "dlr", "overground", "elizabeth-line"];
  const allStops: any[] = [];
  for (const mode of modes) {
    console.log(`[zones] Fetching ${mode} stations...`);
    const res = await fetch(`https://api.tfl.gov.uk/StopPoint/Mode/${mode}`);
    if (!res.ok) {
      console.warn(`[zones] Failed to fetch ${mode}: ${res.status}`);
      continue;
    }
    const data = await res.json();
    allStops.push(...(data.stopPoints ?? []));
    console.log(`[zones] Got ${data.stopPoints?.length ?? 0} ${mode} stops`);
  }

  // Manual corrections for known TfL data errors
  const ZONE_OVERRIDES: Record<string, number> = {
    "Nine Elms": 1,
    "Battersea Power Station": 1,
  };

  const seen = new Map<string, TflStation>();
  for (const stop of allStops) {
    const zoneProp = stop.additionalProperties?.find((p: { key: string }) => p.key === "Zone");
    if (!zoneProp) continue;
    const zoneStr: string = zoneProp.value;
    // Parse zone: "4", "2+3", "2/3" → take lowest
    const zone = Math.min(...zoneStr.split(/[+\/]/).map(Number).filter((n) => !isNaN(n)));
    if (isNaN(zone)) continue;

    const name = stop.commonName?.replace(/ Underground Station$| Station$| Rail Station$| DLR Station$/i, "").trim();
    if (!name || seen.has(name)) continue;

    const correctedZone = ZONE_OVERRIDES[name] ?? zone;
    seen.set(name, { name, lat: stop.lat, lng: stop.lon, zone: correctedZone });
  }

  const stations = Array.from(seen.values());
  console.log(`[zones] Got ${stations.length} unique stations with zones`);
  return stations;
}

async function main() {
  const stations = await fetchTflStations();

  // Manual neighbourhood zone overrides (for bad grid refs with no station name match)
  const NEIGHBOURHOOD_OVERRIDES: Record<string, number> = {
    "Chinatown::Westminster": 1,
  };

  // Build station name lookup for direct matching
  const stationByName = new Map<string, TflStation>();
  for (const s of stations) {
    stationByName.set(s.name.toLowerCase(), s);
  }

  // Get all neighbourhoods from DB
  const allNeighbourhoods = await prisma.neighbourhood.findMany();
  console.log(`[zones] Processing ${allNeighbourhoods.length} neighbourhoods from database`);

  const results: { name: string; borough: string; zone: number; nearestStation: string; distance: number }[] = [];
  let failures = 0;
  let directMatches = 0;

  for (const n of allNeighbourhoods) {
    // Strategy 0: Manual override
    const overrideKey = `${n.name}::${n.borough}`;
    if (NEIGHBOURHOOD_OVERRIDES[overrideKey] !== undefined) {
      results.push({
        name: n.name,
        borough: n.borough,
        zone: NEIGHBOURHOOD_OVERRIDES[overrideKey],
        nearestStation: "(manual override)",
        distance: 0,
      });
      continue;
    }

    // Strategy 1: Direct station name match (most accurate)
    const directMatch = stationByName.get(n.name.toLowerCase());
    if (directMatch) {
      results.push({
        name: n.name,
        borough: n.borough,
        zone: directMatch.zone,
        nearestStation: directMatch.name + " (direct match)",
        distance: 0,
      });
      directMatches++;
      continue;
    }

    // Strategy 2: OS Grid Ref → nearest station
    type DistrictEntry = { location: string; borough: string; osGridRef: string };
    const match = (districts as DistrictEntry[]).find(
      (d) => d.location === n.name && d.borough === n.borough
    );
    let lat: number | null = null;
    let lng: number | null = null;
    if (match?.osGridRef) {
      const coords = osGridToLatLng(match.osGridRef);
      if (coords) { lat = coords.lat; lng = coords.lng; }
    }

    if (lat === null || lng === null) {
      console.warn(`[zones] Could not locate ${n.name} (${n.borough})`);
      failures++;
      continue;
    }

    let nearest: TflStation | null = null;
    let minDist = Infinity;
    for (const station of stations) {
      const dist = haversineKm(lat, lng, station.lat, station.lng);
      if (dist < minDist) {
        minDist = dist;
        nearest = station;
      }
    }

    if (nearest) {
      // Sanity check: if nearest station is very far (>10km), the grid ref is probably wrong
      // In that case, warn but still use the result
      if (minDist > 10) {
        console.warn(`[zones] ${n.name} (${n.borough}): nearest station ${nearest.name} is ${minDist.toFixed(1)}km away — grid ref may be inaccurate`);
      }
      results.push({
        name: n.name,
        borough: n.borough,
        zone: nearest.zone,
        nearestStation: nearest.name,
        distance: Math.round(minDist * 100) / 100,
      });
    }
  }

  console.log(`[zones] ${directMatches} direct station name matches, ${results.length - directMatches} via nearest station`);

  console.log(`[zones] Computed zones for ${results.length} neighbourhoods (${failures} failures)`);

  // Save to JSON for seed script
  const zonesData = results.map((r) => ({ name: r.name, borough: r.borough, zone: r.zone }));
  fs.writeFileSync("data/neighbourhood_zones.json", JSON.stringify(zonesData, null, 2));
  console.log("[zones] Saved data/neighbourhood_zones.json");

  // Update database
  let changed = 0;
  for (const r of results) {
    const existing = await prisma.neighbourhood.findUnique({
      where: { name_borough: { name: r.name, borough: r.borough } },
    });
    if (!existing) continue;
    if (existing.zone !== r.zone) {
      console.log(`[zones] ${r.name} (${r.borough}): zone ${existing.zone} → ${r.zone} (nearest: ${r.nearestStation}, ${r.distance}km)`);
      await prisma.neighbourhood.update({
        where: { name_borough: { name: r.name, borough: r.borough } },
        data: { zone: r.zone },
      });
      changed++;
    }
  }

  console.log(`[zones] Updated ${changed} neighbourhoods in database`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
