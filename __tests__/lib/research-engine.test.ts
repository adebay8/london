import { parseAnalysisResponse } from "@/lib/research-engine";

describe("parseAnalysisResponse", () => {
  it("parses valid JSON response into ResearchData", () => {
    const json = JSON.stringify({
      overview: "A great area",
      safety: { score: 7.0, evidence: "Low crime", sources: ["met.police.uk"] },
      transport: { score: 8.5, stations: ["Canada Water"], commuteMins: 22, lines: ["Jubilee"], frequency: "Every 3 mins", sources: ["tfl.gov.uk"] },
      rentValue: { score: 6.5, rangeLow: 1650, rangeHigh: 1900, analysis: "Within budget", sources: ["rightmove.co.uk"] },
      newBuilds: { score: 8.0, developments: [{ name: "Marine Wharf", features: ["concierge", "gym"], priceRange: "£1,700-1,900" }], sources: ["rightmove.co.uk"] },
      amenities: { score: 7.5, details: "Good grocery options", sources: ["google.com"] },
      areaQuality: { score: 6.0, evidence: "Regeneration area", sources: ["local forums"] },
      pros: ["Direct Jubilee line", "New builds"],
      cons: ["Construction noise"],
    });

    const result = parseAnalysisResponse(json);
    expect(result.overview).toBe("A great area");
    expect(result.safety.score).toBe(7.0);
    expect(result.transport.commuteMins).toBe(22);
    expect(result.rentValue.rangeLow).toBe(1650);
    expect(result.newBuilds.developments).toHaveLength(1);
    expect(result.pros).toContain("Direct Jubilee line");
    expect(result.cons).toContain("Construction noise");
  });

  it("handles JSON wrapped in markdown code fences", () => {
    const json = '```json\n{"overview":"Test","safety":{"score":5,"evidence":"ok","sources":[]},"transport":{"score":5,"stations":[],"commuteMins":30,"lines":[],"frequency":"ok","sources":[]},"rentValue":{"score":5,"rangeLow":1500,"rangeHigh":1800,"analysis":"ok","sources":[]},"newBuilds":{"score":5,"developments":[],"sources":[]},"amenities":{"score":5,"details":"ok","sources":[]},"areaQuality":{"score":5,"evidence":"ok","sources":[]},"pros":["a"],"cons":["b"]}\n```';
    const result = parseAnalysisResponse(json);
    expect(result.overview).toBe("Test");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseAnalysisResponse("not json")).toThrow();
  });
});
