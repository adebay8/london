import {
  bedLengthOf, bedWidthOf, bodyDepthOf, fitFor, fitLabel,
  hasSuspectBedSize, seatDepthOf,
} from "@/lib/sofabeds/fit";
import { NO_FINANCE, type SofaBed } from "@/lib/sofabeds/types";

const base: SofaBed = {
  id: "x", retailer: "R", brand: "B", model: "M", productUrl: "u",
  imageUrl: null, colourwayShown: null,
  priceGbp: 900, rrpGbp: null, deliveryCostGbp: null, deliveryIncluded: true,
  landedCostGbp: 900, overBudget: false,
  condition: "new", inStock: true, oneOff: false,
  seats: 3, seatCushions: 2,
  mechanism: "fold-out", separateMattress: true,
  bedWidthCm: 140, bedLengthCm: 190,
  mattressType: "sprung", mattressThicknessCm: 14, beddingStorage: false,
  legRest: "none", chaiseSide: null, modular: null,
  overallWidthCm: 220, overallDepthCm: 105, overallHeightCm: 85,
  extendedDepthCm: 200, seatDepthCm: null, seatHeightCm: null,
  armStyle: null, fabric: null, easyClean: null, removableCovers: null,
  seatFilling: null, frameMaterial: null,
  warranty: null, returnsWindow: null, deliveryLeadTime: null,
  reviewScore: null, reviewCount: null,
  finance: { ...NO_FINANCE }, notes: null, extra: {}, pref: null,
};

const s = (over: Partial<SofaBed> = {}): SofaBed => ({ ...base, ...over });

describe("bedWidthOf — the 185cm bound exists to catch a bed length", () => {
  it("reads a real bed width", () => {
    expect(bedWidthOf(s({ bedWidthCm: 140 }))).toBe(140);
    expect(bedWidthOf(s({ bedWidthCm: 180 }))).toBe(180);
  });

  it("rejects 190 — that is the standard UK bed LENGTH in the width column", () => {
    // The whole reason the bound is 185 and not 200.
    expect(bedWidthOf(s({ bedWidthCm: 190 }))).toBeNull();
    expect(hasSuspectBedSize(s({ bedWidthCm: 190 }))).toBe(true);
  });

  it("returns null when unpublished, without flagging it as suspect", () => {
    expect(bedWidthOf(s({ bedWidthCm: null }))).toBeNull();
    expect(hasSuspectBedSize(s({ bedWidthCm: null, bedLengthCm: null }))).toBe(false);
  });
});

describe("bedLengthOf — under 170 is a width filed wrongly", () => {
  it("reads a real bed length", () => {
    expect(bedLengthOf(s({ bedLengthCm: 190 }))).toBe(190);
  });

  it("rejects a width in the length column", () => {
    expect(bedLengthOf(s({ bedLengthCm: 140 }))).toBeNull();
    expect(hasSuspectBedSize(s({ bedLengthCm: 140 }))).toBe(true);
  });

  it("rejects an implausibly long bed", () => {
    expect(bedLengthOf(s({ bedLengthCm: 260 }))).toBeNull();
  });
});

describe("depth guards carry over from the sofa corpus", () => {
  it("discards an L-shape footprint sitting in the depth column", () => {
    expect(bodyDepthOf(s({ overallDepthCm: 112 }))).toBe(112);
    expect(bodyDepthOf(s({ overallDepthCm: 165 }))).toBeNull();
  });

  it("discards a chaise length sitting in the seat depth column", () => {
    expect(seatDepthOf(s({ seatDepthCm: 62 }))).toBe(62);
    expect(seatDepthOf(s({ seatDepthCm: 140 }))).toBeNull();
  });
});

describe("fitFor — R1 seats, R2 width band, R3 bed width", () => {
  it("passes a sofa bed that meets all three", () => {
    const f = fitFor(s());
    expect(f.seats).toBe("pass");
    expect(f.width).toBe("pass");
    expect(f.bed).toBe("pass");
    expect(f.overall).toBe("pass");
  });

  it("fails a 2-seater — capacity is gated at 3", () => {
    const f = fitFor(s({ seats: 2 }));
    expect(f.seats).toBe("fail");
    expect(f.overall).toBe("fail");
  });

  it("fails a sofa that is too NARROW — the floor is the point of this search", () => {
    // 190cm is a compact 2-seater wearing a 3-seat label. The sofa search had
    // no floor and this is the gate that was added for it.
    const f = fitFor(s({ overallWidthCm: 190 }));
    expect(f.width).toBe("fail");
    expect(f.notes.join(" ")).toMatch(/narrow|small/i);
  });

  it("fails a sofa that is too wide", () => {
    expect(fitFor(s({ overallWidthCm: 265 })).width).toBe("fail");
  });

  it("fails a bed under the small-double floor", () => {
    expect(fitFor(s({ bedWidthCm: 110 })).bed).toBe("fail");
  });

  it("is unknown, not failed, when a measurement is unpublished", () => {
    expect(fitFor(s({ overallWidthCm: null })).width).toBe("unknown");
    expect(fitFor(s({ seats: null })).seats).toBe("unknown");
    expect(fitFor(s({ bedWidthCm: null })).bed).toBe("unknown");
    expect(fitFor(s({ seats: null })).overall).toBe("unknown");
  });

  it("treats a suspect bed width as unknown rather than as a pass", () => {
    // 190 in the width column must not be read as a generous double.
    expect(fitFor(s({ bedWidthCm: 190 })).bed).toBe("unknown");
  });

  it("records the mechanism route and whether you sleep apart from the seat", () => {
    const f = fitFor(s({ mechanism: "fold-out", separateMattress: true }));
    expect(f.mechanismRoute).toBe("fold-out");
    expect(f.sleepsApart).toBe(true);

    const c = fitFor(s({ mechanism: "click-clack", separateMattress: false }));
    expect(c.sleepsApart).toBe(false);
    expect(c.overall).toBe("pass"); // scored, never gated
  });

  it("leaves sleepsApart null when the listing does not make it clear", () => {
    expect(fitFor(s({ mechanism: null, separateMattress: null })).sleepsApart).toBeNull();
  });
});

describe("fitLabel", () => {
  it("names the route when it passes", () => {
    expect(fitLabel(fitFor(s()))).toMatch(/3 seats/);
  });

  it("lists what failed", () => {
    expect(fitLabel(fitFor(s({ seats: 1, bedWidthCm: 90 })))).toMatch(/Doesn't meet/);
  });
});
