import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

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
  }
});
