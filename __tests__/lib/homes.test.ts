import { mergeSeen, normaliseHistory, priceChange } from "@/lib/homes/track";
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
    const ids = flagsFor({ ...base, priceGbp: 425_000, priceQualifier: "Guide Price (range £425k–£475k)" }).map((f) => f.id);
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
