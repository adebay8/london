import {
  budgetTier,
  compareListings,
  daysOnMarket,
  furnishingMatches,
  groupByArea,
  moveOutFloorMs,
  noticeDeadlineMs,
  staleTier,
  timingFit,
  timingRefMs,
} from "@/lib/flat-search/view-logic";
import type { Area, Budget, Listing, MoveTiming, StaleThresholds } from "@/lib/flat-search/types";

const BUDGET: Budget = { min: 1600, inMax: 1850, searchMax: 2000, btrMax: 2150 };
const TH: StaleThresholds = { slow: 45, stale: 90, problem: 150 };
const MT: MoveTiming = {
  rentPeriodAnchorDay: 14,
  noticePeriodsRequired: 2,
  overlapIdealDays: 7,
  overlapMaxDays: 14,
  noticeServedDate: null,
};
const NOW = Date.parse("2026-06-25T00:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const L = (p: Partial<Listing>): Listing => ({ scheme: "private", price: 0, ...p } as Listing);
const area = (id: string, tier: string): Area => ({ id, tier } as Area);

describe("furnishingMatches", () => {
  it("empty selection matches everything (no filter)", () => {
    expect(furnishingMatches("furnished", [])).toBe(true);
    expect(furnishingMatches("unfurnished", [])).toBe(true);
    expect(furnishingMatches("either", [])).toBe(true);
  });

  it("matches an exact furnishing selection", () => {
    expect(furnishingMatches("furnished", ["furnished"])).toBe(true);
    expect(furnishingMatches("unfurnished", ["furnished"])).toBe(false);
    expect(furnishingMatches("unfurnished", ["unfurnished"])).toBe(true);
  });

  it("an 'either' flat surfaces under a furnished OR unfurnished filter, never hidden", () => {
    expect(furnishingMatches("either", ["furnished"])).toBe(true);
    expect(furnishingMatches("either", ["unfurnished"])).toBe(true);
    expect(furnishingMatches("either", ["either"])).toBe(true);
  });

  it("ticking only 'either' shows just the explicitly-flexible flats", () => {
    expect(furnishingMatches("furnished", ["either"])).toBe(false);
    expect(furnishingMatches("unfurnished", ["either"])).toBe(false);
    expect(furnishingMatches("either", ["either"])).toBe(true);
  });
});

describe("budgetTier", () => {
  it("splits at inMax with a BTR band above the standard cap", () => {
    expect(budgetTier(1850, BUDGET, "private")).toBe("in");
    expect(budgetTier(1851, BUDGET, "private")).toBe("over");
    expect(budgetTier(2000, BUDGET, "btr")).toBe("btr");
    expect(budgetTier(2150, BUDGET, "btr")).toBe("btr");
    expect(budgetTier(2151, BUDGET, "btr")).toBe("over");
  });
});

describe("staleness", () => {
  it("only flags when availableNow is true", () => {
    expect(daysOnMarket(null, NOW)).toBeNull();
    const old = "2025-12-01";
    expect(daysOnMarket(old, NOW)!).toBeGreaterThan(150);
    expect(staleTier({ listedDate: old, availableNow: false }, TH, NOW)).toBe("ok");
    expect(staleTier({ listedDate: old, availableNow: true }, TH, NOW)).toBe("problem");
  });
});

describe("move timing", () => {
  const floor = (d: string) => iso(moveOutFloorMs(Date.parse(d + "T00:00:00Z"), MT));
  it("steps a month at the anchor-day boundary", () => {
    expect(floor("2026-06-26")).toBe("2026-09-14");
    expect(floor("2026-07-14")).toBe("2026-09-14");
    expect(floor("2026-07-15")).toBe("2026-10-14");
    expect(floor("2026-12-20")).toBe("2027-03-14");
  });
  it("notice deadline is current period end; null once served", () => {
    expect(iso(noticeDeadlineMs(Date.parse("2026-06-26T00:00:00Z"), MT)!)).toBe("2026-07-14");
    expect(noticeDeadlineMs(Date.parse("2026-06-26T00:00:00Z"), { ...MT, noticeServedDate: "2026-07-01" })).toBeNull();
  });
  it("timingRefMs pins the floor once notice is served", () => {
    const today = Date.parse("2026-08-20T00:00:00Z");
    expect(iso(moveOutFloorMs(timingRefMs(today, MT), MT))).toBe("2026-11-14");
    const served = { ...MT, noticeServedDate: "2026-07-10" };
    expect(iso(moveOutFloorMs(timingRefMs(today, served), served))).toBe("2026-09-14");
  });
  it("timingFit buckets around the move-out floor", () => {
    const NOWMS = Date.parse("2026-06-26T00:00:00Z");
    const M = Date.parse("2026-09-14T00:00:00Z");
    const fit = (availableDate: string | null, extra: Partial<Listing> = {}) =>
      timingFit({ availableDate, availableNow: false, ...extra }, M, MT, NOWMS);
    expect(fit("2026-09-14")).toBe("ideal");
    expect(fit("2026-09-07")).toBe("ideal");
    expect(fit("2026-09-06")).toBe("workable");
    expect(fit("2026-08-31")).toBe("workable");
    expect(fit("2026-08-30")).toBe("early");
    expect(fit("2026-09-20")).toBe("late");
    expect(fit(null)).toBe("unknown");
    expect(timingFit({ availableDate: null, availableNow: true }, M, MT, NOWMS)).toBe("early");
  });
});

describe("compareListings", () => {
  const areaById = { anchor: area("anchor", "anchor"), t1: area("t1", "1"), t2: area("t2", "2") };
  it("orders by area tier, then scheme, then phase, then price", () => {
    const sorted = [
      L({ areaId: "t2", scheme: "btr", phaseYear: 2025, price: 1600 }),
      L({ areaId: "anchor", scheme: "private", phaseYear: 2016, price: 1800 }),
      L({ areaId: "t1", scheme: "private", phaseYear: 2020, price: 1700 }),
    ].sort((a, b) => compareListings(a, b, areaById));
    expect(sorted.map((x) => x.areaId)).toEqual(["anchor", "t1", "t2"]);
    const within = [
      L({ areaId: "t1", scheme: "private", phaseYear: 2021, price: 1600 }),
      L({ areaId: "t1", scheme: "btr", phaseYear: 2018, price: 1900 }),
    ].sort((a, b) => compareListings(a, b, areaById));
    expect(within[0].scheme).toBe("btr");
  });
  it("floats well-timed flats up within a tier when timingCtx is passed", () => {
    const byId = { t2: area("t2", "2") };
    const ctx = {
      floorMs: Date.parse("2026-09-14T00:00:00Z"),
      moveTiming: MT,
      nowMs: Date.parse("2026-06-26T00:00:00Z"),
    };
    const early = L({ areaId: "t2", scheme: "btr", phaseYear: 2025, price: 1600, availableNow: true });
    const ideal = L({ areaId: "t2", scheme: "private", phaseYear: 2010, price: 2000, availableDate: "2026-09-10" });
    expect([early, ideal].sort((a, b) => compareListings(a, b, byId))[0]).toBe(early);
    expect([early, ideal].sort((a, b) => compareListings(a, b, byId, ctx))[0]).toBe(ideal);
  });
});

describe("groupByArea", () => {
  it("keeps roster order and drops empty areas", () => {
    const areas = [area("a", "1"), area("b", "1"), area("c", "1")];
    const groups = groupByArea([L({ areaId: "c" }), L({ areaId: "a" })], areas);
    expect(groups.map((g) => g.area.id)).toEqual(["a", "c"]);
  });
});
