import { buildView, type FlatStore } from "@/lib/flat-search/view-model";
import type { Area, FlatConfig, Listing } from "@/lib/flat-search/types";

const CONFIG: FlatConfig = {
  budget: { min: 1600, inMax: 1850, searchMax: 2000, btrMax: 2150 },
  staleThresholds: { slow: 45, stale: 90, problem: 150 },
  moveTiming: {
    rentPeriodAnchorDay: 14,
    noticePeriodsRequired: 2,
    overlapIdealDays: 7,
    overlapMaxDays: 14,
    noticeServedDate: null,
  },
  lastRun: "2026-07-06",
};
const NOW = Date.parse("2026-07-06T00:00:00Z");
const area = (id: string, tier: string): Area => ({ id, tier, sortOrder: 0 } as Area);
const L = (o: Partial<Listing>): Listing =>
  ({ status: "active", scheme: "private", budgetTier: "in", price: 0, sources: [], ...o } as Listing);

describe("buildView picks", () => {
  it("newest in-budget pick is BTR-first, then newest block, then cheapest", () => {
    const store: FlatStore = {
      config: CONFIG,
      areas: [area("t1", "1")],
      listings: [
        L({ id: "a", areaId: "t1", building: "Old Private", scheme: "private", phaseYear: 2016, price: 1800, budgetTier: "in" }),
        L({ id: "b", areaId: "t1", building: "New BTR", scheme: "btr", phaseYear: 2025, price: 1925, budgetTier: "btr" }),
        L({ id: "c", areaId: "t1", building: "Older BTR", scheme: "btr", phaseYear: 2020, price: 1700, budgetTier: "in" }),
      ],
    };
    const v = buildView(store, NOW);
    const t1 = v.picks.find((p) => p.tier === "1")!;
    expect(t1.newest?.building).toBe("New BTR"); // BTR beats the newer-year? no — BTR first, then newest year
  });

  it("excludes over-budget listings from the newest pick", () => {
    const store: FlatStore = {
      config: CONFIG,
      areas: [area("anchor", "anchor")],
      listings: [
        L({ id: "x", areaId: "anchor", building: "Over", scheme: "private", phaseYear: 2025, price: 2000, budgetTier: "over" }),
        L({ id: "y", areaId: "anchor", building: "InBudget", scheme: "private", phaseYear: 2019, price: 1700, budgetTier: "in" }),
      ],
    };
    const v = buildView(store, NOW);
    expect(v.picks.find((p) => p.tier === "anchor")!.newest?.building).toBe("InBudget");
  });

  it("counts active / new / unconfirmed", () => {
    const store: FlatStore = {
      config: CONFIG,
      areas: [area("t2", "2")],
      listings: [
        L({ id: "1", areaId: "t2", status: "active", isNew: true }),
        L({ id: "2", areaId: "t2", status: "active", unconfirmed: true }),
        L({ id: "3", areaId: "t2", status: "gone", goneReason: "removed" }),
      ],
    };
    const v = buildView(store, NOW);
    expect(v.counts.active).toBe(2);
    expect(v.counts.isNew).toBe(1);
    expect(v.counts.unconfirmed).toBe(1);
    expect(v.counts.gone).toBe(1);
  });
});
