import { calculateFitScore } from "@/lib/scoring";

describe("calculateFitScore", () => {
  it("computes weighted average from sub-scores", () => {
    const scores = {
      transport: 8.5,
      safety: 7.0,
      rentValue: 6.5,
      newBuilds: 8.0,
      amenities: 7.5,
      areaQuality: 6.0,
    };
    // (8.5*0.25) + (7.0*0.25) + (6.5*0.20) + (8.0*0.15) + (7.5*0.10) + (6.0*0.05)
    // = 2.125 + 1.75 + 1.30 + 1.20 + 0.75 + 0.30 = 7.425
    const result = calculateFitScore(scores);
    expect(result).toBeCloseTo(7.43, 1);
  });

  it("returns 0 when all scores are 0", () => {
    const scores = { transport: 0, safety: 0, rentValue: 0, newBuilds: 0, amenities: 0, areaQuality: 0 };
    expect(calculateFitScore(scores)).toBe(0);
  });

  it("returns 10 when all scores are 10", () => {
    const scores = { transport: 10, safety: 10, rentValue: 10, newBuilds: 10, amenities: 10, areaQuality: 10 };
    expect(calculateFitScore(scores)).toBe(10);
  });

  it("rounds to 2 decimal places", () => {
    const scores = { transport: 7.3, safety: 6.7, rentValue: 8.1, newBuilds: 5.9, amenities: 7.2, areaQuality: 6.4 };
    const result = calculateFitScore(scores);
    const decimalPlaces = result.toString().split(".")[1]?.length ?? 0;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });
});
