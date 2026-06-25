import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as L from "../flat-search/viewer-logic.mjs";

const ROOT = new URL("../", import.meta.url);
const store = JSON.parse(readFileSync(new URL("flat-search/listings.json", ROOT)));

test("meta has areas, budget, staleThresholds", () => {
  assert.ok(Array.isArray(store.meta.areas) && store.meta.areas.length === 8, "8 areas");
  const b = store.meta.budget;
  assert.deepEqual([b.min, b.inMax, b.searchMax], [1600, 1850, 2000], "budget bands");
  assert.ok(store.meta.staleThresholdsDays, "stale thresholds kept");
});

test("area ids are unique and include the anchor", () => {
  const ids = store.meta.areas.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length, "unique area ids");
  const anchor = store.meta.areas.find(a => a.tier === "anchor");
  assert.equal(anchor.id, "beaufort-colindale", "anchor id");
  for (const a of store.meta.areas) {
    assert.ok(a.searchUrls?.zoopla && a.searchUrls?.rightmove, `${a.id} has search urls`);
    assert.ok(Array.isArray(a.buildingRoster), `${a.id} has roster`);
  }
});

test("every listing maps to a known area and is correctly keyed/classified", () => {
  const areaIds = new Set(store.meta.areas.map(a => a.id));
  const seen = new Set();
  for (const x of store.listings) {
    assert.ok(areaIds.has(x.area), `listing ${x.id} has known area ${x.area}`);
    assert.ok(x.id.startsWith(x.area + "-"), `id ${x.id} is area-prefixed`);
    assert.ok(!seen.has(x.id), `id ${x.id} unique`);
    seen.add(x.id);
    assert.ok(x.price <= store.meta.budget.searchMax, `${x.id} within £${store.meta.budget.searchMax}`);
    const expected = x.price > store.meta.budget.inMax ? "over" : "in";
    assert.equal(x.budgetTier, expected, `${x.id} budgetTier`);
    assert.ok(["active", "gone"].includes(x.status), `${x.id} status valid`);
    if ("goneReason" in x) assert.ok(["removed", "let-agreed"].includes(x.goneReason), `${x.id} goneReason enum`);
    if ("unconfirmed" in x) {
      assert.equal(typeof x.unconfirmed, "boolean", `${x.id} unconfirmed boolean`);
      assert.ok(!(x.unconfirmed && x.status === "gone"), `${x.id} gone listings are not unconfirmed`);
    }
  }
});

const BUDGET = { min: 1600, inMax: 1850, searchMax: 2000 };
const TH = { slow: 45, stale: 90, problem: 150 };
const NOW = Date.parse("2026-06-25T00:00:00Z");

test("budgetTier splits at inMax", () => {
  assert.equal(L.budgetTier(1850, BUDGET), "in");
  assert.equal(L.budgetTier(1851, BUDGET), "over");
});

test("daysOnMarket and staleTier honour availableNow", () => {
  assert.equal(L.daysOnMarket(null, NOW), null);
  const old = "2025-12-01";
  assert.ok(L.daysOnMarket(old, NOW) > 150);
  assert.equal(L.staleTier({ listedDate: old, availableNow: false }, TH, NOW), "ok", "future avail never stale");
  assert.equal(L.staleTier({ listedDate: old, availableNow: true }, TH, NOW), "problem");
});

test("compareListings orders by area tier then scheme then phase then price", () => {
  const areaById = { anchor: { tier: "anchor" }, t1: { tier: 1 }, t2: { tier: 2 } };
  const mk = (area, scheme, phaseYear, price) => ({ area, scheme, phaseYear, price });
  const sorted = [
    mk("t2", "btr", 2025, 1600), mk("anchor", "private", 2016, 1800), mk("t1", "private", 2020, 1700)
  ].sort((a, b) => L.compareListings(a, b, areaById));
  assert.deepEqual(sorted.map(x => x.area), ["anchor", "t1", "t2"], "anchor first");
  const within = [mk("t1","private",2021,1600), mk("t1","btr",2018,1900)].sort((a,b)=>L.compareListings(a,b,areaById));
  assert.equal(within[0].scheme, "btr", "BTR floats up within group");
});

test("groupByArea keeps roster order and drops empty areas", () => {
  const areas = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const groups = L.groupByArea([{ area: "c" }, { area: "a" }], areas);
  assert.deepEqual(groups.map(g => g.area.id), ["a", "c"], "roster order, empties dropped");
});

test("flats.html embeds valid data and the logic block matches viewer-logic.mjs", () => {
  const html = readFileSync(new URL("flat-search/flats.html", ROOT), "utf8");
  const data = html.match(/\/\*DATA_START\*\/([\s\S]*?)\/\*DATA_END\*\//);
  assert.ok(data, "DATA markers present");
  const parsed = JSON.parse(data[1]);
  assert.equal(parsed.meta.areas.length, 8, "embedded store has 8 areas");
  const logic = html.match(/\/\*LOGIC_START\*\/([\s\S]*?)\/\*LOGIC_END\*\//);
  assert.ok(logic, "LOGIC markers present");
  const mjs = readFileSync(new URL("flat-search/viewer-logic.mjs", ROOT), "utf8")
    .replace(/^export /gm, "").trim();
  assert.equal(logic[1].trim(), mjs, "inlined logic is byte-identical to viewer-logic.mjs (minus export)");
});
