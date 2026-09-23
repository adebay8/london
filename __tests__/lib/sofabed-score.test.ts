import { scoreAll, scoreSofaBed, CRITERIA, TOTAL_WEIGHT } from "@/lib/sofabeds/score";
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

describe("the weights", () => {
  it("sum to 100, with sitting comfort the heaviest", () => {
    expect(TOTAL_WEIGHT).toBe(100);
    const heaviest = [...CRITERIA].sort((a, b) => b.weight - a.weight)[0];
    expect(heaviest.key).toBe("sitting");
  });
});

describe("sitting comfort is the axis, and it is a boolean not a dimension", () => {
  it("ranks a separate mattress above a seat-is-the-mattress at equal everything else", () => {
    const apart = scoreSofaBed(s({ separateMattress: true, mechanism: "fold-out" }));
    const onSeat = scoreSofaBed(s({ separateMattress: false, mechanism: "click-clack" }));
    expect(apart.score).toBeGreaterThan(onSeat.score);
  });

  it("does not punish an unclear listing — it scores it as unknown", () => {
    const unclear = scoreSofaBed(s({ separateMattress: null, mechanism: null }));
    expect(unclear.gaps).toContain("Sitting comfort");
    // Excluded from the average, NOT counted as zero.
    const onSeat = scoreSofaBed(s({ separateMattress: false, mechanism: "click-clack" }));
    expect(unclear.rawScore).toBeGreaterThan(onSeat.rawScore);
  });
});

describe("a missing spec is never a bad spec", () => {
  it("gives a sparse row lower confidence, not a lower raw score", () => {
    const full = scoreSofaBed(s({ seatDepthCm: 62, frameMaterial: "solid hardwood" }));
    const sparse = scoreSofaBed(s({ seatDepthCm: null, frameMaterial: null }));
    expect(sparse.confidence).toBeLessThan(full.confidence);
  });

  it("shrinks a low-confidence score toward the corpus prior", () => {
    const rows = [
      s({ id: "a" }), s({ id: "b" }), s({ id: "c" }),
      s({ id: "sparse", seatDepthCm: null, frameMaterial: null, mattressType: null,
          mattressThicknessCm: null, separateMattress: null, mechanism: null,
          overallDepthCm: null, bedWidthCm: null }),
    ];
    const scored = scoreAll(rows);
    const sparse = scored.find((r) => r.id === "sparse")!;
    expect(sparse.confidence).toBeLessThan(0.4);
    expect(sparse.score).toBeGreaterThan(0);
  });
});

describe("bed size is scored above the floor, not just gated at it", () => {
  it("ranks a full double above a small double", () => {
    expect(scoreSofaBed(s({ bedWidthCm: 140 })).score)
      .toBeGreaterThan(scoreSofaBed(s({ bedWidthCm: 120 })).score);
  });

  it("refuses to reward a bed width that is really a length", () => {
    const suspect = scoreSofaBed(s({ bedWidthCm: 190 }));
    const real = scoreSofaBed(s({ bedWidthCm: 140 }));
    expect(suspect.score).toBeLessThanOrEqual(real.score);
    expect(suspect.gaps).toContain("Bed size");
  });
});

describe("depth still matters — this is the same buyer and the same reference", () => {
  it("rewards the reference depth", () => {
    expect(scoreSofaBed(s({ overallDepthCm: 112 })).score)
      .toBeGreaterThan(scoreSofaBed(s({ overallDepthCm: 92 })).score);
  });
});

describe("the leg rest is scored, not gated", () => {
  it("ranks a storage chaise top and 'none' bottom, without failing either", () => {
    const storage = scoreSofaBed(s({ legRest: "storage-chaise" }));
    const none = scoreSofaBed(s({ legRest: "none" }));
    expect(storage.score).toBeGreaterThan(none.score);
    expect(none.fit.overall).toBe("pass");
  });
});

describe("styleMatch", () => {
  it("is reported separately from the score", () => {
    const r = scoreSofaBed(s({ overallDepthCm: 112, seatCushions: 2, armStyle: "wide square" }));
    expect(r.styleMatch).toBeGreaterThan(0.5);
    expect(r.styleMatch).toBeLessThanOrEqual(1);
  });

  it("rewards two cushions across a 3-seat width — the Raft Loft look", () => {
    const two = scoreSofaBed(s({ seatCushions: 2, overallWidthCm: 220 }));
    const three = scoreSofaBed(s({ seatCushions: 3, overallWidthCm: 220 }));
    expect(two.styleMatch).toBeGreaterThan(three.styleMatch);
  });

  it("does not consider filling — no sofa bed has feather cushions", () => {
    const a = scoreSofaBed(s({ seatFilling: "foam" }));
    const b = scoreSofaBed(s({ seatFilling: null }));
    expect(a.styleMatch).toBe(b.styleMatch);
  });
});
