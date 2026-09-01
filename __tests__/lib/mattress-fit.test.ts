import { depthOf, firmnessOf, fitFor, hasSuspectDepth } from "@/lib/mattresses/fit";
import { NO_FINANCE, type Mattress } from "@/lib/mattresses/types";

const base: Mattress = {
  id: "x", retailer: "R", brand: "B", model: "M", productUrl: "u", imageUrl: null,
  priceGbp: 400, rrpGbp: null, deliveryCostGbp: null, deliveryIncluded: true,
  disposalCostGbp: null, landedCostGbp: 400, overBudget: false,
  condition: "new", inStock: true, rrpEvidence: null, priceFloorGbp: null,
  size: "double", widthCm: 135, lengthCm: 190, depthCm: 25,
  type: "hybrid", springType: "pocket", springCount: 1000, zoned: null, turnRequired: null,
  firmnessLabel: null, firmnessScale: null, firmness: null,
  comfortLayer: null, comfortLayerDepthCm: null, weightKg: null,
  slattedBaseOk: true, platformBaseOk: null, ottomanOk: null,
  coverRemovable: null, coverWashable: null,
  trialNights: null, trialFreeReturns: null, warrantyYears: null,
  returnsWindow: null, deliveryLeadTime: null,
  reviewScore: null, reviewCount: null, testedBy: null, testScore: null,
  finance: { ...NO_FINANCE }, notes: null, extra: {}, pref: null,
};

const m = (over: Partial<Mattress> = {}): Mattress => ({ ...base, ...over });

describe("firmnessOf — reads the retailer's words without inventing any", () => {
  it("reads compound labels before the plain ones", () => {
    // The trap: /firm/ matches "medium firm" and lands two buckets away.
    expect(firmnessOf(m({ firmnessLabel: "Medium Firm" })).value).toBe("medium-firm");
    expect(firmnessOf(m({ firmnessLabel: "medium-to-firm" })).value).toBe("medium-firm");
    expect(firmnessOf(m({ firmnessLabel: "Medium Soft" })).value).toBe("medium-soft");
  });

  it("reads the plain labels", () => {
    expect(firmnessOf(m({ firmnessLabel: "Medium" })).value).toBe("medium");
    expect(firmnessOf(m({ firmnessLabel: "Firm" })).value).toBe("firm");
    expect(firmnessOf(m({ firmnessLabel: "Extra firm" })).value).toBe("firm");
    expect(firmnessOf(m({ firmnessLabel: "Soft / plush" })).value).toBe("soft");
  });

  it("refuses to read firmness out of marketing words", () => {
    // These are the ones that put a side sleeper on a board.
    for (const label of ["Orthopaedic", "Supportive", "Luxury", "Posture care"]) {
      expect(firmnessOf(m({ firmnessLabel: label })).value).toBeNull();
    }
  });

  it("reads a numeric position only from an explicit scale, and says so", () => {
    const r = firmnessOf(m({ firmnessLabel: "7 out of 10", firmnessScale: "1-10 (Emma)" }));
    expect(r.value).toBe("medium-firm");
    expect(r.source).toBe("scale");
  });

  it("prefers a deliberately stored bucket over the wording", () => {
    const r = firmnessOf(m({ firmness: "medium", firmnessLabel: "Firm" }));
    expect(r.value).toBe("medium");
    expect(r.source).toBe("stored");
  });
});

describe("depthOf — the carton guard", () => {
  it("keeps a plausible mattress depth", () => {
    expect(depthOf(m({ depthCm: 28 }))).toBe(28);
  });

  it("discards a shipping-carton height rather than calling it a deep mattress", () => {
    expect(depthOf(m({ depthCm: 48 }))).toBeNull();
    expect(hasSuspectDepth(m({ depthCm: 48 }))).toBe(true);
  });

  it("treats an unpublished depth as unknown, not as zero", () => {
    expect(depthOf(m({ depthCm: null }))).toBeNull();
    expect(hasSuspectDepth(m({ depthCm: null }))).toBe(false);
  });
});

describe("fitFor", () => {
  it("passes a double in the target band on a slatted base", () => {
    const f = fitFor(m({ firmnessLabel: "Medium firm" }));
    expect(f.size).toBe("pass");
    expect(f.firmness).toBe("pass");
    expect(f.base).toBe("pass");
    expect(f.overall).toBe("pass");
  });

  it("fails a firm mattress for a sleeper who spends nights on their side", () => {
    const f = fitFor(m({ firmnessLabel: "Firm" }));
    expect(f.firmness).toBe("fail");
    expect(f.notes.join(" ")).toContain("side");
  });

  it("fails the wrong size", () => {
    expect(fitFor(m({ widthCm: 150, lengthCm: 200 })).size).toBe("fail");
  });

  it("allows manufacturing tolerance on the size", () => {
    expect(fitFor(m({ widthCm: 137, lengthCm: 188 })).size).toBe("pass");
  });

  it("reports an unpublished firmness as unknown rather than unsuitable", () => {
    const f = fitFor(m({ firmnessLabel: null }));
    expect(f.firmness).toBe("unknown");
    expect(f.overall).toBe("unknown");
  });

  it("reports an unstated base rating as unknown", () => {
    expect(fitFor(m({ slattedBaseOk: null, ottomanOk: null })).base).toBe("unknown");
  });
});
