import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as L from "../flat-search/viewer-logic.mjs";

const ROOT = new URL("../", import.meta.url);
const store = JSON.parse(readFileSync(new URL("flat-search/listings.json", ROOT)));

test("meta has areas, budget, staleThresholds, moveTiming", () => {
  assert.ok(Array.isArray(store.meta.areas) && store.meta.areas.length === 9, "9 areas");
  const b = store.meta.budget;
  assert.deepEqual([b.min, b.inMax, b.searchMax], [1600, 1850, 2000], "budget bands");
  assert.equal(b.btrMax, 2150, "btr band ceiling");
  assert.ok(store.meta.staleThresholdsDays, "stale thresholds kept");
  const mt = store.meta.moveTiming;
  assert.ok(mt, "moveTiming present");
  assert.equal(mt.rentPeriodAnchorDay, 14, "anchor day");
  assert.equal(mt.noticePeriodsRequired, 2, "two periods");
  assert.ok(mt.overlapIdealDays <= mt.overlapMaxDays, "ideal ≤ max overlap");
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
    const cap = x.scheme === "btr" ? store.meta.budget.btrMax : store.meta.budget.searchMax;
    assert.ok(x.price <= cap, `${x.id} within £${cap}`);
    const expected = L.budgetTier(x.price, store.meta.budget, x.scheme);
    assert.equal(x.budgetTier, expected, `${x.id} budgetTier`);
    assert.ok(["active", "gone"].includes(x.status), `${x.id} status valid`);
    if ("goneReason" in x) assert.ok(["removed", "let-agreed"].includes(x.goneReason), `${x.id} goneReason enum`);
    if ("unconfirmed" in x) {
      assert.equal(typeof x.unconfirmed, "boolean", `${x.id} unconfirmed boolean`);
      assert.ok(!(x.unconfirmed && x.status === "gone"), `${x.id} gone listings are not unconfirmed`);
    }
  }
});

const BUDGET = { min: 1600, inMax: 1850, searchMax: 2000, btrMax: 2150 };
const TH = { slow: 45, stale: 90, problem: 150 };
const NOW = Date.parse("2026-06-25T00:00:00Z");

test("budgetTier splits at inMax, with a BTR band above", () => {
  assert.equal(L.budgetTier(1850, BUDGET), "in");
  assert.equal(L.budgetTier(1851, BUDGET), "over");
  assert.equal(L.budgetTier(1851, BUDGET, "private"), "over");
  assert.equal(L.budgetTier(2000, BUDGET, "btr"), "btr");
  assert.equal(L.budgetTier(2150, BUDGET, "btr"), "btr");
  assert.equal(L.budgetTier(2151, BUDGET, "btr"), "over");
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

const MT = { rentPeriodAnchorDay: 14, noticePeriodsRequired: 2, overlapIdealDays: 7, overlapMaxDays: 14, noticeServedDate: null };
const iso = ms => new Date(ms).toISOString().slice(0, 10);

test("moveOutFloor steps a month at the anchor-day boundary", () => {
  const floor = d => iso(L.moveOutFloorMs(Date.parse(d + "T00:00:00Z"), MT));
  assert.equal(floor("2026-06-26"), "2026-09-14", "26 Jun → 14 Sep");
  assert.equal(floor("2026-07-10"), "2026-09-14", "10 Jul (≤14) → 14 Sep");
  assert.equal(floor("2026-07-14"), "2026-09-14", "14 Jul (on anchor) → 14 Sep");
  assert.equal(floor("2026-07-15"), "2026-10-14", "15 Jul (>14) → steps to 14 Oct");
  assert.equal(floor("2026-12-20"), "2027-03-14", "Dec rollover → 14 Mar 2027");
});

test("noticeDeadline is the current period end; null once notice served", () => {
  assert.equal(iso(L.noticeDeadlineMs(Date.parse("2026-06-26T00:00:00Z"), MT)), "2026-07-14");
  assert.equal(L.noticeDeadlineMs(Date.parse("2026-06-26T00:00:00Z"), { ...MT, noticeServedDate: "2026-07-01" }), null);
});

test("timingRefMs pins the floor once notice is served (rolls otherwise)", () => {
  const today = Date.parse("2026-08-20T00:00:00Z"); // well past the 14 Jul step
  // rolling (not served): floor rolls forward to 14 Nov
  assert.equal(iso(L.moveOutFloorMs(L.timingRefMs(today, MT), MT)), "2026-11-14");
  // served 10 Jul: floor pinned to 14 Sep regardless of today
  const served = { ...MT, noticeServedDate: "2026-07-10" };
  assert.equal(iso(L.moveOutFloorMs(L.timingRefMs(today, served), served)), "2026-09-14");
});

test("timingFit buckets around the move-out floor", () => {
  const NOWMS = Date.parse("2026-06-26T00:00:00Z");
  const M = Date.parse("2026-09-14T00:00:00Z"); // floor for today
  const fit = (availableDate, extra = {}) => L.timingFit({ availableDate, ...extra }, M, MT, NOWMS);
  assert.equal(fit("2026-09-14"), "ideal", "available on move-out day (0d) → ideal");
  assert.equal(fit("2026-09-07"), "ideal", "7d overlap → ideal");
  assert.equal(fit("2026-09-06"), "workable", "8d overlap → workable");
  assert.equal(fit("2026-08-31"), "workable", "14d overlap → workable");
  assert.equal(fit("2026-08-30"), "early", "15d overlap → early (costly)");
  assert.equal(fit("2026-09-20"), "late", "available after move-out → late (gap)");
  assert.equal(fit(null), "unknown", "no date → unknown");
  assert.equal(L.timingFit({ availableNow: true }, M, MT, NOWMS), "early", "available now → early");
});

test("compareListings: timingCtx floats well-timed flats up within a tier", () => {
  const areaById = { t2: { tier: 2 } };
  const ctx = { floorMs: Date.parse("2026-09-14T00:00:00Z"), moveTiming: MT, nowMs: Date.parse("2026-06-26T00:00:00Z") };
  const early = { area: "t2", scheme: "btr", phaseYear: 2025, price: 1600, availableNow: true };
  const ideal = { area: "t2", scheme: "private", phaseYear: 2010, price: 2000, availableDate: "2026-09-10" };
  // without ctx: BTR/newest/cheapest wins (existing behaviour)
  assert.equal([early, ideal].sort((a, b) => L.compareListings(a, b, areaById))[0], early);
  // with ctx: the ideally-timed flat floats up despite worse scheme/phase/price
  assert.equal([early, ideal].sort((a, b) => L.compareListings(a, b, areaById, ctx))[0], ideal);
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
  assert.equal(parsed.meta.areas.length, 9, "embedded store has 9 areas");
  const logic = html.match(/\/\*LOGIC_START\*\/([\s\S]*?)\/\*LOGIC_END\*\//);
  assert.ok(logic, "LOGIC markers present");
  const mjs = readFileSync(new URL("flat-search/viewer-logic.mjs", ROOT), "utf8")
    .replace(/^export /gm, "").trim();
  assert.equal(logic[1].trim(), mjs, "inlined logic is byte-identical to viewer-logic.mjs (minus export)");
});
