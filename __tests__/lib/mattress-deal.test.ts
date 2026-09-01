import { dealFor, compareDeal, IMPLAUSIBLE_DISCOUNT_PCT } from "@/lib/mattresses/deal";
import type { Mattress } from "@/lib/mattresses/types";

type DealInput = Pick<Mattress,
  "priceGbp" | "landedCostGbp" | "rrpGbp" | "rrpEvidence" | "priceFloorGbp" | "condition">;

const listing = (over: Partial<DealInput> = {}): DealInput => ({
  priceGbp: 400,
  landedCostGbp: 400,
  rrpGbp: null,
  rrpEvidence: null,
  priceFloorGbp: null,
  condition: "new",
  ...over,
});

describe("dealFor — the permanent-sale guard", () => {
  it("treats an unevidenced 'was' price as one observation, not a saving", () => {
    const d = dealFor(listing({ rrpGbp: 800, rrpEvidence: "single-observation" }));
    expect(d.credible).toBe(false);
    expect(d.realSavingGbp).toBeNull();
    expect(d.claimedDiscountPct).toBe(50);
    expect(d.headline).toContain("unverified");
  });

  it("stands behind a saving only when the higher price was verified", () => {
    const d = dealFor(listing({ rrpGbp: 550, rrpEvidence: "verified-higher" }));
    expect(d.credible).toBe(true);
    expect(d.realSavingGbp).toBe(150);
    expect(d.caution).toBeNull();
  });

  it("calls a known permanent sale what it is", () => {
    const d = dealFor(listing({ rrpGbp: 1200, rrpEvidence: "permanent-sale" }));
    expect(d.credible).toBe(false);
    expect(d.realSavingGbp).toBeNull();
    expect(d.headline).toContain("usual price");
    expect(d.caution).toContain("always costs");
  });

  it("downgrades an implausible discount on current-line stock to an anchor", () => {
    // 70% off a new mattress nobody has ever seen at full price.
    const d = dealFor(listing({ priceGbp: 300, landedCostGbp: 300, rrpGbp: 1000 }));
    expect(d.claimedDiscountPct).toBeGreaterThanOrEqual(IMPLAUSIBLE_DISCOUNT_PCT);
    expect(d.evidence).toBe("permanent-sale");
    expect(d.credible).toBe(false);
  });

  it("does not apply the anchor heuristic to genuine clearance", () => {
    const d = dealFor(listing({ priceGbp: 300, landedCostGbp: 300, rrpGbp: 1000, condition: "clearance" }));
    expect(d.evidence).toBe("single-observation");
  });

  it("ignores a rounding-sized 'was' price", () => {
    const d = dealFor(listing({ priceGbp: 400, rrpGbp: 420 }));
    expect(d.claimedDiscountPct).toBeNull();
    expect(d.caution).toBeNull();
  });

  it("says nothing about a saving when there is no claim", () => {
    const d = dealFor(listing());
    expect(d.claimedDiscountPct).toBeNull();
    expect(d.headline).toBe("£400 landed");
  });

  it("notices when today is not the lowest price seen", () => {
    const d = dealFor(listing({ priceGbp: 450, priceFloorGbp: 380 }));
    expect(d.atFloor).toBe(false);
    expect(d.floorGbp).toBe(380);
  });

  it("ranks a small verified saving above a huge unverified one", () => {
    const real = dealFor(listing({ priceGbp: 500, landedCostGbp: 500, rrpGbp: 560, rrpEvidence: "verified-higher" }));
    const fake = dealFor(listing({ priceGbp: 300, landedCostGbp: 300, rrpGbp: 1200 }));
    expect(compareDeal(real, fake)).toBeLessThan(0);
  });
});
