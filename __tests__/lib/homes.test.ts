import { mergeSeen, normaliseHistory, priceChange } from "@/lib/homes/track";
import { homeKind, isNewBuildBlock } from "@/lib/homes/types";
import { explain, homeFactors, PRESETS, presetOf, readWeights, scoreFactors, scoreHome, townFactors, ZERO } from "@/lib/homes/score";
import { addressKey, duplicateGroups, flagsFor, guideCeiling, missingChecks } from "@/lib/homes/flags";
import {
  listingId, parseListed, parseMiles, parseNewBuild, parseStatus, parseTenure, rowToListing, ukDate,
} from "@/lib/homes/parse";

const ROW = {
  town: "St Albans",
  listing_url: "https://www.rightmove.co.uk/properties/93658944",
  source: "Rightmove",
  agent: "Frosts, St. Albans",
  price_gbp: "450000",
  price_qualifier: "Premium Listing",
  address: "St. Georges Court, Hatfield Road, St. Albans, Hertfordshire, AL1",
  property_type: "Apartment",
  new_build: "no (not labelled)",
  tenure: "n/c",
  lease_years_remaining: "n/c",
  service_charge_pa: "n/c",
  ground_rent_pa: "n/c",
  beds: "2",
  baths: "2",
  floor_area: "n/c",
  council_tax: "n/c",
  epc: "n/c",
  date_listed_or_changed: "Added 28/09/2026",
  distance_to_station: "0.22 mi (Rightmove)",
  key_features: "Ground floor; en-suite; bay-fronted living room",
  photo_1: "https://media.rightmove.co.uk/a.jpeg",
  photo_2: "",
  photo_3: "",
  checked: "10/11/2026",
};

describe("parsing a research row", () => {
  it("builds a stable id from the portal number", () => {
    expect(listingId("https://www.rightmove.co.uk/properties/93658944", "Rightmove")).toBe("rightmove-93658944");
    expect(listingId("https://www.zoopla.co.uk/new-homes/details/67471530/", "Zoopla")).toBe("zoopla-67471530");
    expect(listingId("https://www.zoopla.co.uk/for-sale/details/68763295/", "Zoopla")).toBe("zoopla-68763295");
  });

  it("reads UK dates day-first", () => {
    expect(ukDate("10/11/2026")).toBe("2026-11-10");
    expect(parseListed("Reduced 03/11/2026")).toEqual({ event: "reduced", date: "2026-11-03" });
    expect(parseListed("n/c (not captured)")).toEqual({ event: null, date: null });
  });

  it("never invents a value marked n/c", () => {
    const l = rowToListing(ROW)!;
    expect(l.tenure).toBeNull();
    expect(l.serviceChargePa).toBeNull();
    expect(l.floorAreaSqFt).toBeNull();
    expect(l.townId).toBe("st-albans");
    expect(l.distanceMiles).toBe(0.22);
    expect(l.photos).toEqual(["https://media.rightmove.co.uk/a.jpeg"]);
    expect(l.keyFeatures).toEqual(["Ground floor", "en-suite", "bay-fronted living room"]);
  });

  it("normalises tenure, new-build and status wording", () => {
    expect(parseTenure("Share of freehold (per tag)")).toBe("share-of-freehold");
    expect(parseTenure("Leasehold (tagged long lease)")).toBe("leasehold");
    expect(parseTenure("n/c (described as long lease)")).toBe("leasehold");
    expect(parseTenure("Freehold")).toBe("freehold");
    expect(parseTenure("n/c")).toBeNull();
    expect(parseNewBuild("described as brand new (not labelled)")).toBe(true);
    expect(parseNewBuild("n/c (same development)")).toBeNull();
    expect(parseStatus("Coming Soon", "")).toBe("coming-soon");
  });

  it("only reads distances stated in miles", () => {
    expect(parseMiles("~0.1 mi (development-level figure)")).toBe(0.1);
    expect(parseMiles("not stated (tagged near a train station)")).toBeNull();
  });

  it("rejects rows with no URL or price", () => {
    expect(rowToListing({ ...ROW, listing_url: "" })).toBeNull();
    expect(rowToListing({ ...ROW, price_gbp: "n/c" })).toBeNull();
  });
});

describe("flags", () => {
  const base = { ...rowToListing(ROW)! };

  it("asks for the fields a results page never shows", () => {
    expect(missingChecks(base)).toEqual(["tenure", "lease length", "service charge", "council tax", "EPC"]);
    expect(missingChecks({ ...base, tenure: "freehold" })).toEqual(["council tax", "EPC"]);
  });

  it("reads the ceiling of a guide range", () => {
    expect(guideCeiling("Guide Price (range £425k–£475k)")).toBe(475_000);
    expect(guideCeiling("Guide Price")).toBeNull();
  });

  it("flags a guide range that runs past the budget", () => {
    expect(flagsFor({ ...base, priceGbp: 425_000, priceQualifier: "Guide Price (range £425k–£475k)" }).map((f) => f.id)).not.toContain("over-budget");
    const ids = flagsFor({ ...base, priceGbp: 480_000, priceQualifier: "Guide Price (range £480k–£525k)" }).map((f) => f.id);
    expect(ids).toContain("over-budget");
  });

  it("flags short leases and high service charges once known", () => {
    const ids = flagsFor({ ...base, tenure: "leasehold", leaseYears: 80, serviceChargePa: 2904.2 }).map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(["short-lease", "service-charge"]));
  });

  it("treats an unstated distance as something to verify, not a fail", () => {
    const f = flagsFor({ ...base, distanceMiles: null }).find((x) => x.id === "distance");
    expect(f?.tone).toBe("verify");
  });

  it("spots the same flat listed by two agents", () => {
    const a = { ...base, id: "rightmove-91651833", townId: "woking", address: "Heathside Road, Woking, GU22", priceGbp: 285_000, keyFeatures: ["Second floor"] };
    const b = { ...base, id: "rightmove-95329800", townId: "woking", address: "Heathside Road, Woking, Surrey, GU22", priceGbp: 285_000, keyFeatures: ["Second floor", "lift"] };
    expect(addressKey(a.address)).toBe(addressKey(b.address));
    expect(duplicateGroups([a, b]).get(a.id)).toEqual([b.id]);
  });

  it("doesn't merge different flats on the same street at the same price", () => {
    const a = { ...base, id: "rightmove-157453709", townId: "woking", address: "Guildford Road, Woking, Surrey, GU22", priceGbp: 300_000, keyFeatures: ["Fourth floor"] };
    const b = { ...base, id: "rightmove-90539235", townId: "woking", address: "Guildford Road, Woking, Surrey, GU22", priceGbp: 300_000, keyFeatures: ["Town-centre development"] };
    expect(duplicateGroups([a, b]).size).toBe(0);
  });

  it("honours the researcher's own duplicate notes", () => {
    const a = { ...base, id: "rightmove-1", keyFeatures: ["possible duplicate of 2"] };
    const b = { ...base, id: "rightmove-2", address: "Somewhere else", keyFeatures: [] };
    expect(duplicateGroups([a, b]).get(a.id)).toEqual([b.id]);
  });

  it("calls out stale and impossible data", () => {
    const ids = flagsFor(
      { ...base, listedOn: "2024-09-23", floorAreaSqFt: 53 },
      { today: new Date("2026-11-10") },
    ).map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(["stale", "data"]));
  });
});


describe("tracking across passes", () => {
  it("starts a history on first sight", () => {
    expect(mergeSeen(null, "2026-11-10", 300_000)).toMatchObject({
      firstSeenAt: "2026-11-10", lastSeenAt: "2026-11-10", priceHistory: [{ date: "2026-11-10", priceGbp: 300_000 }],
    });
  });

  it("records a reduction as a new point, keeping first sight", () => {
    const first = mergeSeen(null, "2026-11-10", 300_000);
    const second = mergeSeen(first, "2026-12-01", 285_000);
    expect(second.priceGbp).toBe(285_000);
    expect(second.firstSeenAt).toBe("2026-11-10");
    expect(second.lastSeenAt).toBe("2026-12-01");
    expect(priceChange(second.priceHistory)).toEqual({ amount: -15_000, pct: -5 });
  });

  it("an unchanged price adds no point", () => {
    const first = mergeSeen(null, "2026-11-10", 300_000);
    expect(mergeSeen(first, "2026-12-01", 300_000).priceHistory).toHaveLength(1);
  });

  it("re-importing an older pass never overwrites newer facts", () => {
    const now = mergeSeen(mergeSeen(null, "2026-12-01", 285_000), "2026-11-10", 300_000);
    expect(now.newer).toBe(false);
    expect(now.priceGbp).toBe(285_000);
    expect(now.firstSeenAt).toBe("2026-11-10");
    expect(now.priceHistory.map((p) => p.priceGbp)).toEqual([300_000, 285_000]);
  });

  it("is idempotent for the same pass", () => {
    const once = mergeSeen(null, "2026-11-10", 300_000);
    expect(mergeSeen(once, "2026-11-10", 300_000).priceHistory).toEqual(once.priceHistory);
    expect(normaliseHistory([{ date: "a", priceGbp: 1 }, { date: "a", priceGbp: 1 }])).toHaveLength(1);
  });
});

describe("the buying brief", () => {
  const base = { ...rowToListing(ROW)! };

  it("sorts homes into house, maisonette and flat", () => {
    expect(homeKind({ propertyType: "Mid-terrace house" })).toBe("house");
    expect(homeKind({ propertyType: "Semi-Detached" })).toBe("house");
    expect(homeKind({ propertyType: "Terraced" })).toBe("house");
    expect(homeKind({ propertyType: "Ground-floor maisonette" })).toBe("maisonette");
    expect(homeKind({ propertyType: "Apartment (Leon House)" })).toBe("flat");
  });

  it("tags new-build and tall-block flats, but not houses or period flats", () => {
    expect(isNewBuildBlock({ propertyType: "Flat", newBuild: true, keyFeatures: [] })).toBe(true);
    expect(isNewBuildBlock({ propertyType: "Apartment", newBuild: false, keyFeatures: ["Second floor apartment with lift access"] })).toBe(true);
    expect(isNewBuildBlock({ propertyType: "Flat", newBuild: false, keyFeatures: ["Victorian conversion", "Garden"] })).toBe(false);
    expect(isNewBuildBlock({ propertyType: "Terraced", newBuild: true, keyFeatures: [] })).toBe(false);
  });

  it("reads garden, parking and position from a scraped row", () => {
    const l = rowToListing({ ...ROW, garden: "yes", parking: "Allocated", lat: "51.31", lng: "-0.55" })!;
    expect(l.garden).toBe(true);
    expect(l.parking).toBe("Allocated");
    expect([l.lat, l.lng]).toEqual([51.31, -0.55]);
    expect(rowToListing({ ...ROW, garden: "no" })!.garden).toBe(false);
    expect(rowToListing(ROW)!.garden).toBeNull();
  });

  it("merges the same home across two portals, never two flats on one", () => {
    const rm = { ...base, id: "rightmove-1", source: "Rightmove", beds: 2, priceGbp: 300_000, lat: 51.3151, lng: -0.5551, keyFeatures: [] };
    const otm = { ...rm, id: "onthemarket-9", source: "OnTheMarket", lat: 51.3152, lng: -0.5552 };
    const twin = { ...rm, id: "rightmove-2" };
    const d = duplicateGroups([rm, otm, twin]);
    expect(d.get("onthemarket-9")).toEqual(expect.arrayContaining(["rightmove-1", "rightmove-2"]));
    expect(d.get("rightmove-1")).toEqual(["onthemarket-9"]);
  });
});

describe("weighted ranking", () => {
  const base = { ...rowToListing(ROW)!, townId: "croydon" };
  const house = { ...base, propertyType: "Terraced house", priceGbp: 200_000, beds: 3, baths: 2, distanceMiles: 0.25, garden: true, newBuild: false, keyFeatures: [] };
  const balanced = PRESETS.find((p) => p.id === "balanced")!.weights;

  it("scores each factor on a fixed scale from the brief", () => {
    const f = homeFactors(house);
    expect(f.price).toBe(1);
    expect(f.kind).toBe(1);
    expect(f.beds).toBe(1);
    expect(f.walk).toBe(1);
    expect(f.trainTime).toBe(1); // Croydon, 15 min
    expect(homeFactors({ ...house, priceGbp: 500_000 }).price).toBe(0);
    expect(homeFactors({ ...house, distanceMiles: 1 }).walk).toBe(0);
  });

  it("puts new-build blocks at the bottom of home type", () => {
    const block = { ...base, propertyType: "Apartment", newBuild: true, keyFeatures: ["lift"] };
    expect(homeFactors(block).kind).toBe(0);
  });

  it("treats an unknown as neutral, not bad", () => {
    const w = { ...ZERO, garden: 3 as const };
    expect(scoreFactors({ ...homeFactors(house), garden: null }, w)).toBe(50);
    expect(scoreFactors(homeFactors(house), w)).toBe(100);
  });

  it("has no score when nothing is weighted", () => {
    expect(scoreHome(house, ZERO)).toBeNull();
  });

  it("gives a home the same score whatever else is on screen", () => {
    expect(scoreHome(house, balanced)).toBe(scoreHome({ ...house }, balanced));
  });

  it("recognises each preset", () => {
    for (const p of PRESETS) expect(presetOf(p.weights)).toBe(p.id);
    expect(presetOf({ ...balanced, garden: 3 })).toBeNull();
  });

  it("falls back to Balanced on stored garbage", () => {
    expect(readWeights("garbage")).toEqual(balanced);
    expect(readWeights(null)).toEqual(balanced);
    expect(readWeights(JSON.stringify({ ...balanced, price: 9 }))).toEqual(balanced);
    expect(readWeights(JSON.stringify({ ...balanced, garden: 3 }))).toEqual({ ...balanced, garden: 3 });
  });

  it("explains a score in words, naming unknowns that matter", () => {
    const w = { ...ZERO, trainTime: 3 as const, garden: 2 as const, walk: 1 as const };
    const why = explain(homeFactors({ ...house, garden: null, distanceMiles: 0.95 }), w, { ...house, distanceMiles: 0.95 });
    expect(why.pros[0]).toMatch(/15 min/);
    expect(why.cons[0]).toMatch(/0\.95 mi/);
    expect(why.unknown).toContain("garden unknown");
  });

  it("scores a town from its station and the typical home there", () => {
    const f = townFactors("croydon", [house, { ...house, garden: false }]);
    expect(f.trainTime).toBe(1);
    expect(f.garden).toBe(1); // half list a garden
    expect(townFactors("croydon", [{ ...house, garden: null }]).garden).toBe(0);
    expect(townFactors("croydon", []).price).toBeNull();
  });
});
