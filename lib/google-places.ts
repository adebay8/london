export interface GooglePlaceResult {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  googleMapsUri: string;
  types: string[];
}

const FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.types";

export async function searchPlaces(query: string, includedType?: string): Promise<GooglePlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn("[apartments] GOOGLE_PLACES_API_KEY not set, skipping");
    return [];
  }

  console.log(`[apartments] Searching: "${query}"${includedType ? ` (type: ${includedType})` : ""}`);

  const body: Record<string, unknown> = { textQuery: query };
  if (includedType) body.includedType = includedType;

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[apartments] Google Places API error: ${response.status} ${text}`);
    throw new Error(`Google Places API error: ${response.status} ${text}`);
  }

  const data = await response.json();
  const places = data.places ?? [];

  console.log(`[apartments] Got ${places.length} results`);

  return places.map((p: Record<string, unknown>) => ({
    placeId: p.id as string,
    name: (p.displayName as Record<string, string>)?.text ?? "",
    address: (p.formattedAddress as string) ?? "",
    lat: (p.location as Record<string, number>)?.latitude ?? 0,
    lng: (p.location as Record<string, number>)?.longitude ?? 0,
    googleMapsUri: (p.googleMapsUri as string) ?? "",
    types: (p.types as string[]) ?? [],
  }));
}

export async function fetchApartmentBuildings(
  area: string,
  borough: string,
  options?: { radiusMeters?: number; centerLat?: number; centerLng?: number }
): Promise<GooglePlaceResult[]> {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.warn("[apartments] GOOGLE_PLACES_API_KEY not set, skipping apartment fetch");
    return [];
  }

  const radius = options?.radiusMeters ?? 0;
  console.log(`[apartments] Fetching apartments for ${area}, ${borough}${radius ? ` (radius: ${radius}m)` : ""}`);

  // Text-based search (always runs)
  const [complexes, buildings] = await Promise.all([
    searchPlaces(`apartment complexes in ${area}, ${borough}, London`, "apartment_complex"),
    searchPlaces(`apartment buildings in ${area}, ${borough}, London`, "apartment_building"),
  ]);

  // Nearby search (only when radius is set and we have coordinates)
  let nearbyResults: GooglePlaceResult[] = [];
  if (radius > 0 && options?.centerLat && options?.centerLng) {
    console.log(`[apartments] Also running nearby search (${radius}m radius)`);
    nearbyResults = await searchNearby(
      options.centerLat,
      options.centerLng,
      ["apartment_building", "apartment_complex"],
      radius
    );
  }

  // Deduplicate by placeId
  const seen = new Map<string, GooglePlaceResult>();
  for (const place of [...complexes, ...buildings, ...nearbyResults]) {
    if (!seen.has(place.placeId)) {
      seen.set(place.placeId, place);
    }
  }

  const results = Array.from(seen.values());
  console.log(`[apartments] Found ${results.length} unique apartments for ${area} (text: ${complexes.length + buildings.length}, nearby: ${nearbyResults.length}, dedup: ${results.length})`);

  return results;
}

// --- Nearby Search for walkability ---

const AMENITY_CATEGORIES: { category: string; types: string[] }[] = [
  { category: "grocery", types: ["supermarket", "grocery_store"] },
  { category: "station", types: ["subway_station", "train_station", "light_rail_station"] },
  { category: "bus", types: ["bus_station"] },
  { category: "cafe", types: ["cafe", "restaurant", "bakery"] },
  { category: "convenience", types: ["convenience_store", "pharmacy"] },
];

export async function searchNearby(
  lat: number,
  lng: number,
  includedTypes: string[],
  radiusMeters: number = 800
): Promise<GooglePlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  console.log(`[walkability] Nearby search at ${lat.toFixed(4)},${lng.toFixed(4)} for types: ${includedTypes.join(", ")}`);

  const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
      includedTypes,
      maxResultCount: 10,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[walkability] Nearby search error: ${response.status} ${text}`);
    throw new Error(`Google Places Nearby error: ${response.status} ${text}`);
  }

  const data = await response.json();
  const places = data.places ?? [];
  console.log(`[walkability] Found ${places.length} results for ${includedTypes.join(", ")}`);

  return places.map((p: Record<string, unknown>) => ({
    placeId: p.id as string,
    name: (p.displayName as Record<string, string>)?.text ?? "",
    address: (p.formattedAddress as string) ?? "",
    lat: (p.location as Record<string, number>)?.latitude ?? 0,
    lng: (p.location as Record<string, number>)?.longitude ?? 0,
    googleMapsUri: (p.googleMapsUri as string) ?? "",
    types: (p.types as string[]) ?? [],
  }));
}

export async function getWalkingTime(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<{ walkMins: number; walkMeters: number }> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { walkMins: 0, walkMeters: 0 };

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&mode=walking&key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    console.error(`[walkability] Directions API HTTP error: ${response.status} ${text}`);
    return { walkMins: 0, walkMeters: 0 };
  }

  const data = await response.json();

  if (data.status !== "OK") {
    console.error(`[walkability] Directions API status: ${data.status} — ${data.error_message ?? "no details"}`);
    return { walkMins: 0, walkMeters: 0 };
  }

  const leg = data.routes?.[0]?.legs?.[0];
  if (!leg) {
    console.error("[walkability] Directions API returned OK but no route legs");
    return { walkMins: 0, walkMeters: 0 };
  }

  return {
    walkMins: Math.round(leg.duration.value / 60),
    walkMeters: leg.distance.value,
  };
}

export interface NearbyAmenity {
  category: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string;
  googleMapsUri: string;
  walkMins: number;
  walkMeters: number;
}

export async function scanBuildingAmenities(
  buildingLat: number,
  buildingLng: number
): Promise<NearbyAmenity[]> {
  console.log(`[walkability] Scanning amenities at ${buildingLat.toFixed(4)},${buildingLng.toFixed(4)}`);

  // Search all categories in parallel
  const categoryResults = await Promise.all(
    AMENITY_CATEGORIES.map(async ({ category, types }) => {
      const places = await searchNearby(buildingLat, buildingLng, types);
      return { category, places };
    })
  );

  // Get walking times for all results in parallel
  const amenities: NearbyAmenity[] = [];
  const walkingPromises: Promise<void>[] = [];

  for (const { category, places } of categoryResults) {
    for (const place of places) {
      walkingPromises.push(
        getWalkingTime(buildingLat, buildingLng, place.lat, place.lng).then(({ walkMins, walkMeters }) => {
          amenities.push({
            category,
            name: place.name,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
            placeId: place.placeId,
            googleMapsUri: place.googleMapsUri,
            walkMins,
            walkMeters,
          });
        })
      );
    }
  }

  await Promise.all(walkingPromises);

  // Sort by category then walk time
  amenities.sort((a, b) => a.category.localeCompare(b.category) || a.walkMins - b.walkMins);

  console.log(`[walkability] Scan complete — ${amenities.length} amenities found across ${AMENITY_CATEGORIES.length} categories`);
  return amenities;
}
