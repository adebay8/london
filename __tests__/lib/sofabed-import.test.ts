import { parseCsv, toSofaBed } from "@/scripts/sofabeds-import";

const HEADER =
  "retailer,brand,model,product_url,price_gbp,delivery_cost_gbp,condition,seats,seat_cushions," +
  "mechanism,separate_mattress,bed_width_cm,bed_length_cm,mattress_type,leg_rest,overall_width_cm,notes";

const row = (cells: string) => parseCsv(`${HEADER}\n${cells}`)[0];

describe("parseCsv", () => {
  it("keeps commas inside quoted fields", () => {
    const r = row(`IKEA,IKEA,FRIHETEN,https://x,699,included,new,3,2,fold-out,no,140,200,foam,storage-chaise,230,"Deep, roomy, and cheap"`);
    expect(r.notes).toBe("Deep, roomy, and cheap");
    expect(r.model).toBe("FRIHETEN");
  });
});

describe("toSofaBed", () => {
  it("drops a row with no price or no url", () => {
    expect(toSofaBed(row(`IKEA,IKEA,X,,,,new,3,2,fold-out,no,140,190,foam,none,230,`))).toBeNull();
  });

  it("treats 'included' delivery as landed = price", () => {
    const s = toSofaBed(row(`IKEA,IKEA,FRIHETEN,https://x,699,included,new,3,2,fold-out,no,140,200,foam,storage-chaise,230,`))!;
    expect(s.deliveryIncluded).toBe(true);
    expect(s.landedCostGbp).toBe(699);
    expect(s.overBudget).toBe(false);
  });

  it("flags over-budget rather than dropping the row", () => {
    const s = toSofaBed(row(`W&H,W&H,Chaise,https://x,1800,included,new,3,2,fold-out,yes,140,190,pocket-sprung,storage-chaise,230,`))!;
    expect(s.overBudget).toBe(true);
  });

  it("leaves separateMattress NULL when the cell is empty — never false", () => {
    // The score's main axis. An empty cell means unknown, not "no".
    const s = toSofaBed(row(`DFS,DFS,Y,https://x,900,included,new,3,2,fold-out,,140,190,foam,none,230,`))!;
    expect(s.separateMattress).toBeNull();
  });

  it("reads yes/no into a real boolean", () => {
    expect(toSofaBed(row(`DFS,DFS,Y,https://x,900,included,new,3,2,fold-out,yes,140,190,foam,none,230,`))!.separateMattress).toBe(true);
    expect(toSofaBed(row(`DFS,DFS,Y,https://x,900,included,new,3,2,fold-out,no,140,190,foam,none,230,`))!.separateMattress).toBe(false);
  });

  it("rejects a vocabulary it does not know instead of coercing it", () => {
    const s = toSofaBed(row(`DFS,DFS,Y,https://x,900,included,new,3,2,recliner,yes,140,190,marshmallow,none,230,`))!;
    expect(s.mechanism).toBeNull();
    expect(s.mattressType).toBeNull();
  });

  it("keeps storage-chaise, which the sofa corpus had no word for", () => {
    expect(toSofaBed(row(`IKEA,IKEA,FRIHETEN,https://x,699,included,new,3,2,fold-out,no,140,200,foam,storage-chaise,230,`))!.legRest)
      .toBe("storage-chaise");
  });

  it("builds a stable kebab id from retailer and model", () => {
    const s = toSofaBed(row(`John Lewis & Partners,JL,Sofa Bed 3,https://x,900,included,new,3,2,fold-out,yes,140,190,foam,none,230,`))!;
    expect(s.id).toBe("john-lewis-and-partners-sofa-bed-3");
  });

  it("files unrecognised columns into extra rather than dropping them", () => {
    const r = parseCsv(`retailer,brand,model,product_url,price_gbp,mystery\nIKEA,IKEA,X,https://x,699,wombat`)[0];
    expect(toSofaBed(r)!.extra.mystery).toBe("wombat");
  });
});
