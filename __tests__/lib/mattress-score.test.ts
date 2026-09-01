import { compatFor, ventilatedBase, type BedConstraint } from "@/lib/mattresses/compat";
import { scoreAll, scoreMattress } from "@/lib/mattresses/score";
import { NO_FINANCE, type Mattress } from "@/lib/mattresses/types";

const base: Mattress = {
  id: "x", retailer: "R", brand: "B", model: "M", productUrl: "u", imageUrl: null,
  priceGbp: 400, rrpGbp: null, deliveryCostGbp: null, deliveryIncluded: true,
  disposalCostGbp: null, landedCostGbp: 400, overBudget: false,
  condition: "new", inStock: true, rrpEvidence: null, priceFloorGbp: null,
  size: "double", widthCm: 135, lengthCm: 190, depthCm: 25,
  type: "hybrid", springType: "pocket", springCount: 1000, zoned: null, turnRequired: null,
  firmnessLabel: "Medium firm", firmnessScale: null, firmness: null,
  comfortLayer: null, comfortLayerDepthCm: null, weightKg: null,
  slattedBaseOk: true, platformBaseOk: null, ottomanOk: null,
  coverRemovable: null, coverWashable: null,
  trialNights: 100, trialFreeReturns: true, warrantyYears: 10,
  returnsWindow: null, deliveryLeadTime: null,
  reviewScore: 4.6, reviewCount: 900, testedBy: null, testScore: null,
  finance: { ...NO_FINANCE }, notes: null, extra: {}, pref: null,
};

const m = (id: string, over: Partial<Mattress> = {}): Mattress => ({ ...base, id, ...over });

describe("scoreAll — evidence discipline", () => {
  it("does not score an unpublished spec as a bad spec", () => {
    const known = scoreMattress(m("a"));
    const missing = scoreMattress(m("b", { warrantyYears: null }));
    // Dropping a criterion the mattress scored WELL on lowers confidence, but
    // it must not be treated as a zero — the measured score stays high.
    expect(missing.rawScore).toBeGreaterThan(70);
    expect(missing.confidence).toBeLessThan(known.confidence);
    expect(missing.gaps).toContain("Warranty");
  });

  it("shrinks a thinly-documented mattress toward the corpus median, not toward bad", () => {
    const corpus = [
      ...Array.from({ length: 6 }, (_, i) => m(`full-${i}`)),
      // One row with almost nothing published, and what little there is is good.
      m("thin", {
        firmnessLabel: null, springType: null, trialNights: null, warrantyYears: null,
        reviewScore: null, depthCm: null, springCount: null,
      }),
    ];
    const scored = scoreAll(corpus);
    const thin = scored.find((s) => s.id === "thin")!;
    const full = scored.find((s) => s.id === "full-0")!;
    expect(thin.confidence).toBeLessThan(0.3);
    // Pulled toward the middle from both directions — never to the floor.
    expect(thin.score).toBeGreaterThan(40);
    expect(thin.score).toBeLessThan(full.score);
  });

  it("ranks firmness above spring count", () => {
    const rightFirmness = scoreMattress(m("a", { firmnessLabel: "Medium", springCount: 800 }));
    const springMarketing = scoreMattress(m("b", { firmnessLabel: "Firm", springCount: 3000 }));
    expect(rightFirmness.score).toBeGreaterThan(springMarketing.score);
  });

  it("stops rewarding spring count past the plateau", () => {
    const twoThousand = scoreMattress(m("a", { springCount: 2000 }));
    const threeThousand = scoreMattress(m("b", { springCount: 3000 }));
    expect(threeThousand.score).toBeLessThanOrEqual(twoThousand.score);
  });

  it("marks down open coil, because the bed is shared", () => {
    const pocket = scoreMattress(m("a", { springType: "pocket" }));
    const openCoil = scoreMattress(m("b", { springType: "open-coil" }));
    expect(openCoil.score).toBeLessThan(pocket.score);
  });

  it("discounts a trial you have to pay to use", () => {
    const free = scoreMattress(m("a", { trialFreeReturns: true }));
    const charged = scoreMattress(m("b", { trialFreeReturns: false }));
    expect(charged.score).toBeLessThan(free.score);
  });

  it("never lets the discount touch the ranking", () => {
    // Same mattress, one with a spectacular invented "was" price.
    const plain = scoreMattress(m("a"));
    const anchored = scoreMattress(m("b", { rrpGbp: 1400, rrpEvidence: "permanent-sale" }));
    expect(anchored.score).toBe(plain.score);
  });
});

describe("compatFor — the ottoman badge", () => {
  const louanna: BedConstraint = {
    id: "dreams-louanna", retailer: "Dreams", model: "Louanna",
    maxMattressWeightKg: 35, baseType: "Sprung slats",
  };
  const chilworth: BedConstraint = {
    id: "daals-chilworth", retailer: "Daals", model: "Chilworth",
    maxMattressWeightKg: null, baseType: "solid platform base (solid panel, no slats)",
  };

  it("reads ventilation off the base wording", () => {
    expect(ventilatedBase("Sprung slatted base")).toBe(true);
    expect(ventilatedBase("solid platform base")).toBe(false);
    expect(ventilatedBase(null)).toBeNull();
  });

  it("does not read 'no slats' as slatted", () => {
    // The Daals Chilworth's own wording. A plain /slat/ match gets this
    // exactly backwards and would clear a foam mattress for a solid panel.
    expect(ventilatedBase("solid platform base (solid panel, no slats)")).toBe(false);
    expect(ventilatedBase("Platform top, without slats")).toBe(false);
  });

  it("blocks a mattress heavier than the struts are rated for", () => {
    const c = compatFor(m("a", { weightKg: 42 }), [louanna]);
    expect(c.blocked).toHaveLength(1);
    expect(c.blocked[0].verdict).toBe("too-heavy");
    expect(c.blocked[0].reason).toContain("35kg");
  });

  it("blocks all-foam on a solid base with no slats", () => {
    const c = compatFor(m("a", { type: "memory-foam", springType: "none" }), [chilworth]);
    expect(c.blocked[0].verdict).toBe("unventilated");
  });

  it("lets a sprung mattress sit on the same solid base", () => {
    const c = compatFor(m("a", { type: "pocket-sprung" }), [chilworth]);
    expect(c.fits).toBe(1);
  });

  it("says it cannot tell when the weight is unpublished and the limit matters", () => {
    const c = compatFor(m("a", { weightKg: null }), [louanna]);
    expect(c.unknown).toBe(1);
    expect(c.label).toContain("unpublished");
  });

  it("reports nothing at all when no beds are shortlisted", () => {
    expect(compatFor(m("a"), []).label).toBeNull();
  });
});
