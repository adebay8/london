import { reconcile, listingId, type AreaResult } from "@/lib/flat-search/reconcile";
import type { Area, Budget, Listing } from "@/lib/flat-search/types";

const BUDGET: Budget = { min: 1600, inMax: 1850, searchMax: 2000, btrMax: 2150 };
const AREAS: Area[] = [
  { id: "wembley-park", tier: "1", phaseYears: { "Beton House": 2023 } } as unknown as Area,
];
const TODAY = "2026-07-06";

function base(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "wembley-park-beton-house-1995",
    areaId: "wembley-park",
    building: "Beton House",
    street: null,
    phaseYear: 2023,
    phaseLabel: null,
    price: 1995,
    budgetTier: "btr",
    furnishing: "furnished",
    available: "Now",
    availableNow: true,
    availableDate: null,
    listedDate: "2026-06-01",
    epc: null,
    sizeSqft: null,
    scheme: "btr",
    operator: "Quintain",
    schemeConfidence: "confirmed",
    schemeSource: "live-listing",
    firstSeen: "2026-06-01",
    lastSeen: "2026-07-01",
    lastConfirmed: "2026-07-01",
    status: "active",
    goneReason: null,
    unconfirmed: false,
    isNew: false,
    imageUrl: null,
    note: null,
    sources: [{ platform: "zoopla", url: "https://z/1", agent: "A" }],
    ...overrides,
  };
}

const run = (listings: Listing[], results: AreaResult[]) =>
  reconcile({ listings, areas: AREAS, budget: BUDGET, today: TODAY, results });

describe("reconcile — reconfirm verdicts", () => {
  it("live confirms and clears unconfirmed/goneReason; resets isNew", () => {
    const l = base({ unconfirmed: true, isNew: true, status: "active" });
    const { listings } = run([l], [{ area: "wembley-park", reconfirm: [{ id: l.id, verdict: "live" }] }]);
    const out = listings[0];
    expect(out.status).toBe("active");
    expect(out.lastSeen).toBe(TODAY);
    expect(out.lastConfirmed).toBe(TODAY);
    expect(out.unconfirmed).toBe(false);
    expect(out.isNew).toBe(false);
  });

  it("removed / let-agreed mark gone with the right reason", () => {
    const l = base();
    const removed = run([l], [{ area: "wembley-park", reconfirm: [{ id: l.id, verdict: "removed" }] }]);
    expect(removed.listings[0].status).toBe("gone");
    expect(removed.listings[0].goneReason).toBe("removed");
    const let2 = run([l], [{ area: "wembley-park", reconfirm: [{ id: l.id, verdict: "let-agreed" }] }]);
    expect(let2.listings[0].goneReason).toBe("let-agreed");
  });

  it("blocked keeps active but marks unconfirmed and leaves lastSeen untouched", () => {
    const l = base({ lastSeen: "2026-07-01" });
    const { listings } = run([l], [{ area: "wembley-park", reconfirm: [{ id: l.id, verdict: "blocked" }] }]);
    expect(listings[0].status).toBe("active");
    expect(listings[0].unconfirmed).toBe(true);
    expect(listings[0].lastSeen).toBe("2026-07-01");
  });

  it("applies a confirmed price change and reclassifies the budget tier", () => {
    const l = base({ price: 1995, budgetTier: "btr", scheme: "private" });
    const { listings } = run([l], [
      { area: "wembley-park", reconfirm: [{ id: l.id, verdict: "live", newPrice: 1800 }] },
    ]);
    expect(listings[0].price).toBe(1800);
    expect(listings[0].budgetTier).toBe("in");
  });
});

describe("reconcile — candidates", () => {
  it("adds a genuinely new listing flagged isNew with a derived id + tier", () => {
    const { listings, log } = run(
      [],
      [
        {
          area: "wembley-park",
          candidates: [{ building: "Beton House", price: 1700, scheme: "btr", sources: [{ platform: "z", url: "u", agent: null }] }],
        },
      ],
    );
    const id = listingId("wembley-park", "Beton House", 1700);
    const added = listings.find((l) => l.id === id)!;
    expect(added).toBeTruthy();
    expect(added.isNew).toBe(true);
    expect(added.phaseYear).toBe(2023);
    expect(added.budgetTier).toBe("in");
    expect(log.some((x) => x.startsWith("NEW "))).toBe(true);
  });

  it("revives a gone listing at the same id, clearing goneReason and merging sources", () => {
    const gone = base({ status: "gone", goneReason: "removed" });
    const { listings } = run(
      [gone],
      [
        {
          area: "wembley-park",
          candidates: [
            { building: "Beton House", price: 1995, scheme: "btr", sources: [{ platform: "rightmove", url: "https://r/2", agent: "B" }] },
          ],
        },
      ],
    );
    const out = listings.find((l) => l.id === gone.id)!;
    expect(out.status).toBe("active");
    expect(out.goneReason).toBeNull();
    expect(out.isNew).toBe(false); // existing id → not "new"
    expect(out.sources.map((s) => s.url).sort()).toEqual(["https://r/2", "https://z/1"]);
  });

  it("defaults a candidate with no furnishing to 'furnished', and keeps an explicit value", () => {
    const { listings } = run(
      [],
      [
        {
          area: "wembley-park",
          candidates: [
            { building: "Beton House", price: 1700, scheme: "btr", sources: [] },
            { building: "Beton House", price: 1750, scheme: "btr", furnishing: "unfurnished", sources: [] },
            { building: "Beton House", price: 1800, scheme: "btr", furnishing: "either", sources: [] },
          ],
        },
      ],
    );
    const byId = new Map(listings.map((l) => [l.id, l]));
    expect(byId.get(listingId("wembley-park", "Beton House", 1700))!.furnishing).toBe("furnished");
    expect(byId.get(listingId("wembley-park", "Beton House", 1750))!.furnishing).toBe("unfurnished");
    expect(byId.get(listingId("wembley-park", "Beton House", 1800))!.furnishing).toBe("either");
  });

  it("updates furnishing on an existing listing when a candidate provides it", () => {
    const l = base({ furnishing: "furnished" });
    const { listings } = run(
      [l],
      [
        {
          area: "wembley-park",
          candidates: [{ building: "Beton House", price: 1995, scheme: "btr", furnishing: "either", sources: [] }],
        },
      ],
    );
    expect(listings.find((x) => x.id === l.id)!.furnishing).toBe("either");
  });

  it("does not duplicate a source already present", () => {
    const l = base();
    const { listings } = run(
      [l],
      [
        {
          area: "wembley-park",
          candidates: [{ building: "Beton House", price: 1995, scheme: "btr", sources: [{ platform: "zoopla", url: "https://z/1", agent: "A" }] }],
        },
      ],
    );
    expect(listings.find((x) => x.id === l.id)!.sources).toHaveLength(1);
  });
});
