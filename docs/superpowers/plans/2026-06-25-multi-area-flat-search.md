# Multi-area flat search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalise the `beaufort-flats` skill from one hardcoded area to a tiered, multi-area flat search with a tabbed/filterable viewer, keeping all existing Beaufort domain knowledge.

**Architecture:** Three hand-maintained artefacts under `flat-search/` (canonical `listings.json`, self-contained `flats.html` viewer, `SKILL.md` procedure). Pure view logic lives in `flat-search/viewer-logic.mjs`, unit-tested by `scripts/verify-flat-search.mjs` and inlined verbatim into the self-contained `flats.html` between `/*LOGIC_START*/…/*LOGIC_END*/` markers so the tested logic and rendered logic cannot drift.

**Tech Stack:** Plain JSON, vanilla ES-module JS (Node 20+, `node --test`), self-contained HTML/CSS/JS. No build step, no framework, no new dependencies.

## Global Constraints

- New areas must be TfL **Zone 3** (Zone 2 only if 1-bed rents ≤ £2,000). Anchor `beaufort-colindale` stays Zone 4 unchanged. — verbatim from spec.
- Budget: `min` £1,600, `inMax` £1,850, `searchMax` £2,000. In-budget = £1,600–1,850; overbudget = £1,851–2,000 (kept, collapsed); >£2,000 dropped at fetch. — verbatim from spec.
- Ranking: anchor(0) < tier1(1) < tier2(2); within group scheme(BTR first) → `phaseYear` desc → price asc. Budget tier never reorders. — verbatim from spec.
- `flats.html` must remain a single self-contained file openable as `file://` (no server, no external fetch). — verbatim from spec/SKILL.
- Final roster (8 areas, ids exact): `beaufort-colindale` (anchor, Z4), `ealing-broadway` (T1, Z3), `acton-gardens` (T1, Z3), `grand-union` (T2, Z3/4, zoneCaveat), `north-acton` (T2, Z2/3, mostlyOverBudget), `cricklewood` (T2, Z2/3, natRail), `hendon-waterside` (T2, Z3/4, safetyCaution+natRail), `brent-cross-town` (T2, Z3, brandNew+mostlyOverBudget+natRail). — verbatim from spec.
- No integration into the Next.js app. — verbatim from spec (out of scope).

---

## Task 1: Multi-area schema + migration of `listings.json`

Migrate the store to the new schema: `meta.areas[]`, `meta.budget`, and per-listing `area` + `budgetTier`, with area-prefixed ids. Backfill the existing 11 listings as `area: "beaufort-colindale"`. The verify script (created here, data-invariants only) is the red/green gate.

**Files:**
- Modify: `flat-search/listings.json` (whole file)
- Create: `scripts/verify-flat-search.mjs`

**Interfaces:**
- Produces: `listings.json` shape — `meta.areas: Area[]`, `meta.budget: {min,inMax,searchMax}`, `meta.staleThresholdsDays`, `meta.lastRun`; each `listing` gains `area: string` (an `Area.id`) and `budgetTier: "in"|"over"`; `listing.id = "<area>-<kebab(building)>-<price>"`.
- `Area = { id, name, borough, zone, tier: "anchor"|1|2, buildingRoster: string[], phaseYears: Record<string,number>, btrOperators: string[], operatorPortals: string[], searchUrls: {zoopla,rightmove}, expectedBand: "in"|"over"|"out", flags: string[] }`.

- [ ] **Step 1: Write the failing verification script (data invariants)**

Create `scripts/verify-flat-search.mjs`:

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test scripts/verify-flat-search.mjs`
Expected: FAIL — the current `listings.json` has `meta.criteria` (no `meta.areas`/`meta.budget`), listings have no `area`/`budgetTier`, ids are not area-prefixed.

- [ ] **Step 3: Rewrite `flat-search/listings.json` to the new schema**

Replace the whole file. Preserve the 11 existing listings' data; only re-key ids (`beaufort-colindale-` prefix), add `area` + `budgetTier` (all current prices ≤1850 ⇒ `"in"`). Add `meta.areas` (8) and `meta.budget`; drop `meta.criteria`.

```json
{
  "meta": {
    "lastRun": "2026-06-25",
    "budget": { "min": 1600, "inMax": 1850, "searchMax": 2000 },
    "staleThresholdsDays": { "slow": 45, "stale": 90, "problem": 150 },
    "staleRule": "Days-on-market is only a red flag when availableNow is true. A long-listed flat with a FUTURE availability date is early-marketing, not stale. tier 'problem' (>150d & availableNow) is hidden by default.",
    "areas": [
      {
        "id": "beaufort-colindale", "name": "Beaufort Park + Colindale Gardens (NW9)",
        "borough": "Barnet", "zone": "4", "tier": "anchor",
        "buildingRoster": ["Capri House","Goldhawk House","Golding House","Fairbank House","Fermont House","Argent House","Castleton House","Cornelia House","Celeste House","Croft House","Pinnacle House","Bantam House","Battalion House","Amiot House","Amelia House","Allard House","Grevillea House","Duxford Tower","Draper House","Adrienne Apartments","Claremont Apartments","Sterling House","Foxglove House","Curtiss House","Lismore Boulevard","Reverence House","Charcot Road","Florence House"],
        "phaseYears": {"Duxford Tower":2025,"Draper House":2025,"Foxglove House":2020,"Fairbank House":2021,"Fermont House":2020,"Cornelia House":2019,"Celeste House":2019,"Castleton House":2019,"Capri House":2019,"Golding House":2016,"Goldhawk House":2016,"Argent House":2017,"Claremont Apartments":2013,"Amelia House":2012,"Allard House":2012,"Adrienne Apartments":2007,"Lismore Boulevard":2021,"Reverence House":2021,"Grevillea House":2020},
        "btrOperators": ["Way of Life","Savills","UNCLE","L&Q"],
        "operatorPortals": ["https://www.wayoflife.co.uk/","https://www.uncle.co.uk/colindale/","https://www.lqpricedin.co.uk/"],
        "searchUrls": {
          "zoopla": "https://www.zoopla.co.uk/to-rent/flats/1-bedroom/colindale/?baths_min=1&furnished_state=furnished&is_retirement_home=false&is_shared_accommodation=false&is_student_accommodation=false&price_frequency=per_month&price_max=2000&price_min=1600&q=Colindale%2C%20London&radius=0.5&search_source=to-rent",
          "rightmove": "https://www.rightmove.co.uk/property-to-rent/Colindale.html?minBedrooms=1&maxBedrooms=1&minPrice=1500&maxPrice=2000&keywords=Beaufort%20Park&furnishTypes=furnished"
        },
        "expectedBand": "in", "flags": []
      },
      {
        "id": "ealing-broadway", "name": "Ealing Broadway — Dickens Yard / Filmworks",
        "borough": "Ealing", "zone": "3", "tier": 1,
        "buildingRoster": ["Dickens Yard","Filmworks","Bond Street","Longfield Avenue"],
        "phaseYears": {"Dickens Yard":2016,"Filmworks":2021},
        "btrOperators": ["Berkeley/St George","Landsec"],
        "operatorPortals": ["https://www.dickensyard.co.uk/","https://www.filmworksealing.com/"],
        "searchUrls": {
          "zoopla": "https://www.zoopla.co.uk/to-rent/flats/1-bedroom/london/w5/?baths_min=1&furnished_state=furnished&is_retirement_home=false&is_shared_accommodation=false&is_student_accommodation=false&price_frequency=per_month&price_max=2000&price_min=1600&q=Ealing%20Broadway%2C%20London&radius=0.5&search_source=to-rent",
          "rightmove": "https://www.rightmove.co.uk/property-to-rent/Ealing-Broadway.html?minBedrooms=1&maxBedrooms=1&minPrice=1500&maxPrice=2000&keywords=Dickens%20Yard&furnishTypes=furnished"
        },
        "expectedBand": "over", "flags": []
      },
      {
        "id": "acton-gardens", "name": "Acton Gardens / South Acton",
        "borough": "Ealing", "zone": "3", "tier": 1,
        "buildingRoster": ["Acton Gardens","Bollo Lane","Bridge House","The Square","Vista Apartments","Watercolour Apartments"],
        "phaseYears": {"Acton Gardens":2019},
        "btrOperators": ["L&Q","Countryside/Vistry"],
        "operatorPortals": ["https://www.youractongardens.co.uk/homes-rent"],
        "searchUrls": {
          "zoopla": "https://www.zoopla.co.uk/to-rent/flats/1-bedroom/london/w3/?baths_min=1&furnished_state=furnished&is_retirement_home=false&is_shared_accommodation=false&is_student_accommodation=false&price_frequency=per_month&price_max=2000&price_min=1600&q=South%20Acton%2C%20London&radius=0.5&search_source=to-rent",
          "rightmove": "https://www.rightmove.co.uk/property-to-rent/South-Acton.html?minBedrooms=1&maxBedrooms=1&minPrice=1500&maxPrice=2000&keywords=Acton%20Gardens&furnishTypes=furnished"
        },
        "expectedBand": "over", "flags": []
      },
      {
        "id": "grand-union", "name": "Grand Union, Alperton",
        "borough": "Brent", "zone": "3/4", "tier": 2,
        "buildingRoster": ["Grand Union","Waterview House","Beresford Avenue","Lyon Square","Cassia House","Vista House"],
        "phaseYears": {"Grand Union":2021},
        "btrOperators": ["Berkeley/St George"],
        "operatorPortals": ["https://www.berkeleygroup.co.uk/developments/london/alperton/grand-union","https://www.johnsand.co/development/grand-union"],
        "searchUrls": {
          "zoopla": "https://www.zoopla.co.uk/to-rent/flats/1-bedroom/alperton/?baths_min=1&furnished_state=furnished&is_retirement_home=false&is_shared_accommodation=false&is_student_accommodation=false&price_frequency=per_month&price_max=2000&price_min=1600&q=Alperton%2C%20London&radius=0.5&search_source=to-rent",
          "rightmove": "https://www.rightmove.co.uk/property-to-rent/Alperton.html?minBedrooms=1&maxBedrooms=1&minPrice=1500&maxPrice=2000&keywords=Grand%20Union&furnishTypes=furnished"
        },
        "expectedBand": "over", "flags": ["zoneCaveat"]
      },
      {
        "id": "north-acton", "name": "North Acton / Portal Way",
        "borough": "Ealing", "zone": "2/3", "tier": 2,
        "buildingRoster": ["One West Point","Icon Tower","UNCLE Acton","Rehearsal Rooms","The Verdean","Legacy Point","Residence Building","Portal Way","Victoria Road"],
        "phaseYears": {"One West Point":2022,"Icon Tower":2019,"UNCLE Acton":2021,"Rehearsal Rooms":2018,"The Verdean":2023},
        "btrOperators": ["AWOL","UNCLE"],
        "operatorPortals": ["https://www.uncle.co.uk/acton/","https://www.onewestpoint.com/"],
        "searchUrls": {
          "zoopla": "https://www.zoopla.co.uk/to-rent/flats/1-bedroom/north-acton/?baths_min=1&furnished_state=furnished&is_retirement_home=false&is_shared_accommodation=false&is_student_accommodation=false&price_frequency=per_month&price_max=2000&price_min=1600&q=North%20Acton%2C%20London&radius=0.5&search_source=to-rent",
          "rightmove": "https://www.rightmove.co.uk/property-to-rent/North-Acton.html?minBedrooms=1&maxBedrooms=1&minPrice=1500&maxPrice=2000&furnishTypes=furnished"
        },
        "expectedBand": "out", "flags": ["mostlyOverBudget"]
      },
      {
        "id": "cricklewood", "name": "Cricklewood / Brent Cross West",
        "borough": "Brent", "zone": "2/3", "tier": 2,
        "buildingRoster": ["Gerard Court","Chichele Road","Cricklewood Lane","B&Q site","Exchange House"],
        "phaseYears": {},
        "btrOperators": ["Akelius"],
        "operatorPortals": ["https://www.akelius.co.uk/en/search?city=London"],
        "searchUrls": {
          "zoopla": "https://www.zoopla.co.uk/to-rent/flats/1-bedroom/cricklewood/?baths_min=1&furnished_state=furnished&is_retirement_home=false&is_shared_accommodation=false&is_student_accommodation=false&price_frequency=per_month&price_max=2000&price_min=1600&q=Cricklewood%2C%20London&radius=0.5&search_source=to-rent",
          "rightmove": "https://www.rightmove.co.uk/property-to-rent/Cricklewood.html?minBedrooms=1&maxBedrooms=1&minPrice=1500&maxPrice=2000&furnishTypes=furnished"
        },
        "expectedBand": "in", "flags": ["natRail"]
      },
      {
        "id": "hendon-waterside", "name": "Hendon Waterside / West Hendon",
        "borough": "Barnet", "zone": "3/4", "tier": 2,
        "buildingRoster": ["Hendon Waterside","Pacific House","Reflection House","Compass House","Schooner House","York House"],
        "phaseYears": {"Hendon Waterside":2018},
        "btrOperators": ["Barratt London"],
        "operatorPortals": ["https://www.barratthomes.co.uk/new-homes/greater-london/H600901-Hendon-Waterside/"],
        "searchUrls": {
          "zoopla": "https://www.zoopla.co.uk/to-rent/flats/1-bedroom/west-hendon/?baths_min=1&furnished_state=furnished&is_retirement_home=false&is_shared_accommodation=false&is_student_accommodation=false&price_frequency=per_month&price_max=2000&price_min=1500&q=West%20Hendon%2C%20London&radius=0.5&search_source=to-rent",
          "rightmove": "https://www.rightmove.co.uk/property-to-rent/West-Hendon.html?minBedrooms=1&maxBedrooms=1&minPrice=1400&maxPrice=2000&keywords=Hendon%20Waterside&furnishTypes=furnished"
        },
        "expectedBand": "in", "flags": ["safetyCaution","natRail"]
      },
      {
        "id": "brent-cross-town", "name": "Brent Cross Town",
        "borough": "Barnet", "zone": "3", "tier": 2,
        "buildingRoster": ["The Maple","Brent Cross Town","Claremont Park","Edward Street"],
        "phaseYears": {"The Maple":2025},
        "btrOperators": ["Related Argent"],
        "operatorPortals": ["https://brentcrosstown.co.uk/rent-here","https://www.themaplenw2.com/"],
        "searchUrls": {
          "zoopla": "https://www.zoopla.co.uk/to-rent/flats/1-bedroom/brent-cross/?baths_min=1&furnished_state=furnished&is_retirement_home=false&is_shared_accommodation=false&is_student_accommodation=false&price_frequency=per_month&price_max=2000&price_min=1600&q=Brent%20Cross%2C%20London&radius=0.5&search_source=to-rent",
          "rightmove": "https://www.rightmove.co.uk/property-to-rent/Brent-Cross.html?minBedrooms=1&maxBedrooms=1&minPrice=1500&maxPrice=2000&keywords=Brent%20Cross%20Town&furnishTypes=furnished"
        },
        "expectedBand": "out", "flags": ["brandNew","mostlyOverBudget","natRail"]
      }
    ]
  },
  "listings": [
    { "id": "beaufort-colindale-fairbank-house-1800", "area": "beaufort-colindale", "building": "Fairbank House", "street": "Beaufort Square", "phaseYear": 2021, "phaseLabel": "Launched 2018, completed ~2021 — newer", "price": 1800, "budgetTier": "in", "furnished": true, "available": "Now", "availableNow": true, "listedDate": "2025-10-09", "epc": "B", "sizeSqft": null, "sources": [{ "platform": "zoopla", "url": "https://www.zoopla.co.uk/to-rent/details/71520089/", "agent": "Benham and Reeves" }], "scheme": "private", "operator": null, "schemeConfidence": "confirmed", "schemeSource": "live-listing", "firstSeen": "2026-06-25", "lastSeen": "2026-06-25", "status": "active", "isNew": false },
    { "id": "beaufort-colindale-golding-house-1750", "area": "beaufort-colindale", "building": "Golding House", "street": "Beaufort Square", "phaseYear": 2016, "phaseLabel": "Launched 2015 — older", "price": 1750, "budgetTier": "in", "furnished": true, "available": "Now", "availableNow": true, "listedDate": "2025-10-09", "epc": "C", "sizeSqft": null, "sources": [{ "platform": "zoopla", "url": "https://www.zoopla.co.uk/to-rent/details/71522249/", "agent": "Benham and Reeves" }], "scheme": "private", "operator": null, "schemeConfidence": "confirmed", "schemeSource": "live-listing", "firstSeen": "2026-06-25", "lastSeen": "2026-06-25", "status": "active", "isNew": false },
    { "id": "beaufort-colindale-fermont-house-1850", "area": "beaufort-colindale", "building": "Fermont House", "street": "Beaufort Square", "phaseYear": 2020, "phaseLabel": "Late phase ~2018+ — newer", "price": 1850, "budgetTier": "in", "furnished": true, "available": "9 Aug 2026", "availableNow": false, "listedDate": "2026-06-05", "epc": "B", "sizeSqft": null, "sources": [{ "platform": "zoopla", "url": "https://www.zoopla.co.uk/to-rent/details/73380845/", "agent": "Benham and Reeves" }], "scheme": "private", "operator": null, "schemeConfidence": "confirmed", "schemeSource": "live-listing", "firstSeen": "2026-06-25", "lastSeen": "2026-06-25", "status": "active", "isNew": false },
    { "id": "beaufort-colindale-cornelia-house-1800", "area": "beaufort-colindale", "building": "Cornelia House", "street": "Caversham Road", "phaseYear": 2019, "phaseLabel": "Completed ~2019 — newer", "price": 1800, "budgetTier": "in", "furnished": true, "available": "1 Jul 2026", "availableNow": false, "listedDate": "2026-04-23", "epc": "B", "sizeSqft": 553, "sources": [{ "platform": "zoopla", "url": "https://www.zoopla.co.uk/to-rent/details/73014569/", "agent": "EGRE" }], "scheme": "private", "operator": null, "schemeConfidence": "confirmed", "schemeSource": "live-listing", "firstSeen": "2026-06-25", "lastSeen": "2026-06-25", "status": "active", "isNew": false },
    { "id": "beaufort-colindale-celeste-house-1733", "area": "beaufort-colindale", "building": "Celeste House", "street": "Caversham Road", "phaseYear": 2019, "phaseLabel": "Completed ~2019/20 — newer", "price": 1733, "budgetTier": "in", "furnished": true, "available": "Ask agent", "availableNow": false, "listedDate": "2026-06-24", "epc": null, "sizeSqft": null, "sources": [{ "platform": "rightmove", "url": "https://www.rightmove.co.uk/properties/128666687", "agent": "LDM Properties" }], "scheme": "private", "operator": null, "schemeConfidence": "confirmed", "schemeSource": "live-listing", "firstSeen": "2026-06-25", "lastSeen": "2026-06-25", "status": "active", "isNew": false },
    { "id": "beaufort-colindale-castleton-house-1700", "area": "beaufort-colindale", "building": "Castleton House", "street": "Caversham Road", "phaseYear": 2019, "phaseLabel": "Completed ~2019 — newer (EPC C, age uncertain)", "price": 1700, "budgetTier": "in", "furnished": true, "available": "5 Aug 2026", "availableNow": false, "listedDate": "2026-06-03", "epc": "C", "sizeSqft": 548, "sources": [{ "platform": "zoopla", "url": "https://www.zoopla.co.uk/to-rent/details/73367780/", "agent": "Romans & Partners" }, { "platform": "rightmove", "url": "https://www.rightmove.co.uk/properties/89267967", "agent": "Romans & Partners" }], "scheme": "private", "operator": null, "schemeConfidence": "confirmed", "schemeSource": "live-listing", "firstSeen": "2026-06-25", "lastSeen": "2026-06-25", "status": "active", "isNew": false },
    { "id": "beaufort-colindale-amelia-house-1650", "area": "beaufort-colindale", "building": "Amelia House", "street": "Boulevard Drive", "phaseYear": 2012, "phaseLabel": "Earlier phase ~2010–13 — oldest (secure parking)", "price": 1650, "budgetTier": "in", "furnished": true, "available": "Now", "availableNow": true, "listedDate": "2026-04-18", "epc": "C", "sizeSqft": 454, "sources": [{ "platform": "zoopla", "url": "https://www.zoopla.co.uk/to-rent/details/72968081/", "agent": "London-Tokyo Property Services" }], "scheme": "private", "operator": null, "schemeConfidence": "confirmed", "schemeSource": "live-listing", "firstSeen": "2026-06-25", "lastSeen": "2026-06-25", "status": "active", "isNew": false },
    { "id": "beaufort-colindale-lismore-boulevard-1750", "area": "beaufort-colindale", "building": "Lismore Boulevard", "street": "Colindale Gardens", "phaseYear": 2021, "phaseLabel": "Colindale Gardens (Redrow) new build — newer", "price": 1750, "budgetTier": "in", "furnished": true, "available": "Ask agent", "availableNow": false, "listedDate": "2026-06-04", "epc": "B", "sizeSqft": null, "sources": [{ "platform": "zoopla", "url": "https://www.zoopla.co.uk/to-rent/details/73371279/", "agent": "Dexters" }], "scheme": "private", "operator": null, "schemeConfidence": "confirmed", "schemeSource": "live-listing", "firstSeen": "2026-06-25", "lastSeen": "2026-06-25", "status": "active", "isNew": true },
    { "id": "beaufort-colindale-reverence-house-1850", "area": "beaufort-colindale", "building": "Reverence House", "street": "Colindale Gardens (Lismore Blvd)", "phaseYear": 2021, "phaseLabel": "Colindale Gardens (Redrow) — newer", "price": 1850, "budgetTier": "in", "furnished": true, "available": "Now", "availableNow": true, "listedDate": "2026-06-08", "epc": "B", "sizeSqft": null, "sources": [{ "platform": "zoopla", "url": "https://www.zoopla.co.uk/to-rent/details/62846794/", "agent": "Empire Chase" }], "scheme": "private", "operator": null, "schemeConfidence": "confirmed", "schemeSource": "live-listing", "firstSeen": "2026-06-25", "lastSeen": "2026-06-25", "status": "active", "isNew": true },
    { "id": "beaufort-colindale-grevillea-house-1820", "area": "beaufort-colindale", "building": "Grevillea House", "street": "Colindale Gardens (Bute Close)", "phaseYear": 2020, "phaseLabel": "Colindale Gardens (Redrow) — newer", "price": 1820, "budgetTier": "in", "furnished": true, "available": "15 Aug 2026", "availableNow": false, "listedDate": "2026-06-16", "epc": "B", "sizeSqft": null, "sources": [{ "platform": "zoopla", "url": "https://www.zoopla.co.uk/to-rent/details/63823885/", "agent": "Charles William" }], "scheme": "private", "operator": null, "schemeConfidence": "confirmed", "schemeSource": "live-listing", "firstSeen": "2026-06-25", "lastSeen": "2026-06-25", "status": "active", "isNew": true },
    { "id": "beaufort-colindale-lismore-boulevard-1850", "area": "beaufort-colindale", "building": "Lismore Boulevard", "street": "Colindale Gardens", "phaseYear": 2021, "phaseLabel": "Colindale Gardens (Redrow) new build — newer", "price": 1850, "budgetTier": "in", "furnished": true, "available": "Ask agent", "availableNow": false, "listedDate": null, "epc": null, "sizeSqft": null, "sources": [{ "platform": "zoopla", "url": "https://www.zoopla.co.uk/to-rent/details/73380741/", "agent": "Benham and Reeves" }], "scheme": "private", "operator": null, "schemeConfidence": "confirmed", "schemeSource": "live-listing", "firstSeen": "2026-06-25", "lastSeen": "2026-06-25", "status": "active", "isNew": true }
  ]
}
```

- [ ] **Step 4: Run the verification to confirm it passes**

Run: `node --test scripts/verify-flat-search.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add flat-search/listings.json scripts/verify-flat-search.mjs
git commit -m "feat(flat-search): multi-area store schema + migration"
```

---

## Task 2: Pure view logic module + unit tests

Extract the budget/sort/group/staleness logic into a tested ES module. This module is the single source of truth that Task 3 inlines into `flats.html`.

**Files:**
- Create: `flat-search/viewer-logic.mjs`
- Modify: `scripts/verify-flat-search.mjs` (append logic tests)

**Interfaces:**
- Consumes: `Area`, `listing` shapes from Task 1.
- Produces (all exported from `viewer-logic.mjs`):
  - `budgetTier(price, budget) -> "in"|"over"`
  - `daysOnMarket(listedDate, nowMs) -> number|null`
  - `staleTier(listing, thresholds, nowMs) -> "ok"|"slow"|"stale"|"problem"`
  - `tierRank(tier) -> number` (anchor→0, 1→1, 2→2)
  - `compareListings(a, b, areaById) -> number` (area tier → scheme → phaseYear desc → price asc)
  - `groupByArea(listings, areas) -> {area, listings}[]` (areas in roster order; only areas with ≥1 listing)

- [ ] **Step 1: Write the failing tests (append to `scripts/verify-flat-search.mjs`)**

```js
import * as L from "../flat-search/viewer-logic.mjs";

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/verify-flat-search.mjs`
Expected: FAIL — `Cannot find module '../flat-search/viewer-logic.mjs'`.

- [ ] **Step 3: Implement `flat-search/viewer-logic.mjs`**

```js
// Pure view logic. Single source of truth — inlined verbatim into flats.html between
// /*LOGIC_START*/ and /*LOGIC_END*/ so the tested logic and the rendered logic cannot drift.
export function budgetTier(price, budget) {
  return price > budget.inMax ? "over" : "in";
}
export function daysOnMarket(listedDate, nowMs) {
  if (!listedDate) return null;
  return Math.floor((nowMs - Date.parse(listedDate + "T00:00:00Z")) / 86400000);
}
export function staleTier(listing, thresholds, nowMs) {
  const d = daysOnMarket(listing.listedDate, nowMs);
  if (d == null || !listing.availableNow) return "ok";
  if (d > thresholds.problem) return "problem";
  if (d > thresholds.stale) return "stale";
  if (d > thresholds.slow) return "slow";
  return "ok";
}
export function tierRank(tier) {
  return tier === "anchor" ? 0 : Number(tier);
}
export function compareListings(a, b, areaById) {
  const at = tierRank(areaById[a.area]?.tier ?? 2) - tierRank(areaById[b.area]?.tier ?? 2);
  if (at) return at;
  const sr = (a.scheme === "btr" ? 0 : 1) - (b.scheme === "btr" ? 0 : 1);
  if (sr) return sr;
  return (b.phaseYear - a.phaseYear) || (a.price - b.price);
}
export function groupByArea(listings, areas) {
  return areas
    .map(area => ({ area, listings: listings.filter(x => x.area === area.id) }))
    .filter(g => g.listings.length > 0);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test scripts/verify-flat-search.mjs`
Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
git add flat-search/viewer-logic.mjs scripts/verify-flat-search.mjs
git commit -m "feat(flat-search): pure tested view logic module"
```

---

## Task 3: Tabbed, filterable viewer (`flats.html`)

Rewrite the viewer: tab bar (`All` + one tab per area, anchor first), per-area tabs with collapse of over-budget/problem/gone, and an `All` tab with search + filters. Inline `viewer-logic.mjs` verbatim between markers.

**Files:**
- Modify: `flat-search/flats.html` (whole file)
- Modify: `scripts/verify-flat-search.mjs` (append HTML-integrity tests)

**Interfaces:**
- Consumes: `viewer-logic.mjs` exports (Task 2); `listings.json` shape (Task 1).
- Produces: `flats.html` containing `/*DATA_START*/…/*DATA_END*/` (JSON store) and `/*LOGIC_START*/…/*LOGIC_END*/` (exact copy of `viewer-logic.mjs` body with `export ` removed).

- [ ] **Step 1: Write the failing HTML-integrity tests (append to `scripts/verify-flat-search.mjs`)**

```js
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
  assert.ok(logic[1].includes("function compareListings"), "logic inlined");
  assert.ok(logic[1].includes(mjs.split("\n").slice(-8).join("\n")), "inlined logic matches module tail");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/verify-flat-search.mjs`
Expected: FAIL — current `flats.html` has no `LOGIC` markers and its embedded store has no `meta.areas`.

- [ ] **Step 3: Rewrite `flat-search/flats.html`**

Replace the whole file. Keep the existing card/badge CSS; add `.tabs/.tab`, `.filters`, `.areahead` styles; embed the new store in the DATA block and the `viewer-logic.mjs` body (minus `export `) in the LOGIC block.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>London flat search</title>
<style>
  :root {
    --bg:#0f1115; --card:#181b22; --line:#262b35; --txt:#e7e9ee; --muted:#9aa3b2;
    --new:#2ecc71; --gone:#ff6b6b; --accent:#4d8dff; --slow:#f1c40f; --stale:#e67e22;
    --problem:#ff5757; --over:#c08a3e;
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--txt);
    font:15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width:960px; margin:0 auto; padding:24px 18px 80px; }
  h1 { font-size:22px; margin:0 0 4px; }
  .sub { color:var(--muted); font-size:13px; margin-bottom:16px; }
  .tabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:18px; border-bottom:1px solid var(--line); padding-bottom:10px; }
  .tab { background:var(--card); border:1px solid var(--line); border-radius:20px; padding:6px 13px;
    font-size:13px; cursor:pointer; color:var(--muted); white-space:nowrap; }
  .tab.active { color:var(--txt); border-color:var(--accent); }
  .tab .z { font-size:10px; color:var(--muted); margin-left:5px; }
  .areahead { margin:6px 0 14px; color:var(--muted); font-size:13px; }
  .areahead .chip { display:inline-block; font-size:10px; font-weight:700; text-transform:uppercase;
    letter-spacing:.04em; padding:2px 7px; border-radius:20px; margin-left:6px; border:1px solid var(--line); }
  .chip.t-anchor { color:#d6ffee; } .chip.t-1 { color:#bcd6ff; } .chip.t-2 { color:#cbb0ff; }
  .chip.warn { color:#ffd27a; border-color:#4a3a1a; }
  .filters { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
  .filters input, .filters select { background:var(--card); border:1px solid var(--line);
    color:var(--txt); border-radius:8px; padding:7px 10px; font-size:13px; }
  .stats { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:18px; }
  .stat { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:8px 13px; min-width:84px; }
  .stat .n { font-size:20px; font-weight:700; } .stat .l { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px; margin-bottom:12px; position:relative; }
  .card.gone, .card.problem, .card.over { opacity:.62; }
  .card.gone .title { text-decoration:line-through; } .card.problem { border-color:#4a2a2a; } .card.over { border-color:#4a3a1a; }
  .row1 { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
  .title { font-size:17px; font-weight:600; }
  .price { margin-left:auto; font-size:18px; font-weight:700; color:var(--accent); }
  .badge { font-size:10px; font-weight:700; padding:2px 7px; border-radius:20px; text-transform:uppercase; letter-spacing:.04em; }
  .badge.new { background:var(--new); color:#06210f; } .badge.gone { background:var(--gone); color:#2a0606; }
  .badge.slow { background:var(--slow); color:#2a2300; } .badge.stale { background:var(--stale); color:#2a1500; }
  .badge.problem { background:var(--problem); color:#2a0606; } .badge.over { background:var(--over); color:#241500; }
  .badge.btr { background:#1f6f54; color:#d6ffee; } .badge.private { background:#33384a; color:#c3cad8; }
  .badge.area { background:#222838; color:#9fb4dd; }
  .meta { color:var(--muted); font-size:13px; margin-top:6px; display:flex; gap:14px; flex-wrap:wrap; }
  .meta .k { color:var(--txt); } .dom { font-weight:700; } .phase { font-size:12px; color:var(--muted); margin-top:6px; }
  .src { display:inline-flex; gap:6px; margin-top:10px; flex-wrap:wrap; }
  .src a { font-size:12px; text-decoration:none; color:var(--accent); border:1px solid var(--line); border-radius:7px; padding:4px 9px; }
  .src a:hover { border-color:var(--accent); }
  .sect { margin:22px 0 10px; font-size:13px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); }
  .epc { font-weight:700; } .epc.B { color:#2ecc71; } .epc.C { color:#f1c40f; } .epc.D { color:#e67e22; }
  details { margin-top:16px; } summary { cursor:pointer; color:var(--muted); font-size:13px; text-transform:uppercase; letter-spacing:.05em; padding:6px 0; }
  footer { color:var(--muted); font-size:12px; margin-top:30px; text-align:center; } footer code { color:var(--accent); }
</style>
</head>
<body>
<div class="wrap">
  <h1>🏢 London flat search</h1>
  <div class="sub" id="sub"></div>
  <div class="tabs" id="tabs"></div>
  <div id="view"></div>
  <footer>Regenerate with <code>/beaufort-flats</code> · anchor (Beaufort) first, then Tier 1, then Tier 2 · days-on-market live · over-budget (&gt;£1,850) &amp; stale collapsed.</footer>
</div>

<script id="data">
window.FLAT_DATA = /*DATA_START*/{ "meta": { "PLACEHOLDER": "paste the exact object from flat-search/listings.json here" }, "listings": [] }/*DATA_END*/;
</script>

<script>
/*LOGIC_START*/
function budgetTier(price, budget) { return price > budget.inMax ? "over" : "in"; }
function daysOnMarket(listedDate, nowMs) { if (!listedDate) return null; return Math.floor((nowMs - Date.parse(listedDate + "T00:00:00Z")) / 86400000); }
function staleTier(listing, thresholds, nowMs) {
  const d = daysOnMarket(listing.listedDate, nowMs);
  if (d == null || !listing.availableNow) return "ok";
  if (d > thresholds.problem) return "problem";
  if (d > thresholds.stale) return "stale";
  if (d > thresholds.slow) return "slow";
  return "ok";
}
function tierRank(tier) { return tier === "anchor" ? 0 : Number(tier); }
function compareListings(a, b, areaById) {
  const at = tierRank(areaById[a.area]?.tier ?? 2) - tierRank(areaById[b.area]?.tier ?? 2);
  if (at) return at;
  const sr = (a.scheme === "btr" ? 0 : 1) - (b.scheme === "btr" ? 0 : 1);
  if (sr) return sr;
  return (b.phaseYear - a.phaseYear) || (a.price - b.price);
}
function groupByArea(listings, areas) {
  return areas.map(area => ({ area, listings: listings.filter(x => x.area === area.id) })).filter(g => g.listings.length > 0);
}
/*LOGIC_END*/

  const D = window.FLAT_DATA, M = D.meta;
  const TH = M.staleThresholdsDays, BUD = M.budget, NOW = Date.now();
  const areaById = Object.fromEntries(M.areas.map(a => [a.id, a]));
  document.getElementById("sub").textContent =
    "Last run " + M.lastRun + " · " + M.areas.length + " areas · £" + BUD.min + "–" + BUD.inMax +
    " in budget, to £" + BUD.searchMax + " shown (over collapsed) · days-on-market live";

  function flagChips(area) {
    const names = { safetyCaution:"⚠ safety", zoneCaveat:"⚠ zone 3/4", natRail:"🚂 NatRail", brandNew:"🆕 new build", mostlyOverBudget:"£ mostly >budget" };
    return (area.flags || []).map(f => '<span class="chip warn">' + (names[f] || f) + '</span>').join("");
  }
  function tierLabel(t) { return t === "anchor" ? "ANCHOR" : "TIER " + t; }

  function domBadge(x) {
    const d = daysOnMarket(x.listedDate, NOW); if (d == null) return "";
    const t = staleTier(x, TH, NOW), colour = t === "ok" ? "var(--muted)" : "var(--" + t + ")";
    const tag = t === "ok" ? "" : ' <span class="badge ' + t + '">' + t + '</span>';
    return '<span class="dom" style="color:' + colour + '">on market ' + d + 'd' + (x.availableNow ? "" : " (avail later)") + '</span>' + tag;
  }
  function card(x, showArea) {
    const st = staleTier(x, TH, NOW), over = budgetTier(x.price, BUD) === "over";
    const cls = x.status === "gone" ? "gone" : (st === "problem" ? "problem" : (over ? "over" : ""));
    const badge = x.status === "gone" ? '<span class="badge gone">gone</span>' : (x.isNew ? '<span class="badge new">new</span>' : "");
    const overB = over && x.status !== "gone" ? ' <span class="badge over">over £' + BUD.inMax + '</span>' : "";
    const areaB = showArea ? ' <span class="badge area">' + areaById[x.area].name.split(" — ")[0].split(" / ")[0] + '</span>' : "";
    const epc = x.epc ? '<span class="k">EPC <span class="epc ' + x.epc + '">' + x.epc + '</span></span>' : '<span>EPC —</span>';
    const size = x.sizeSqft ? '<span><span class="k">' + x.sizeSqft + '</span> sqft</span>' : "";
    const avail = x.available ? '<span>avail <span class="k">' + x.available + '</span></span>' : "";
    const srcs = x.sources.map(s => '<a href="' + s.url + '" target="_blank" rel="noopener">' + s.platform.charAt(0).toUpperCase() + s.platform.slice(1) + ' · ' + s.agent + ' ↗</a>').join("");
    const dupe = x.sources.length > 1 ? ' <span class="badge" style="background:#33384a;color:#9aa3b2">' + x.sources.length + ' sources</span>' : "";
    const unverified = x.schemeConfidence && x.schemeConfidence !== "confirmed";
    const scheme = x.scheme === "btr"
      ? ' <span class="badge btr" title="' + (x.schemeConfidence || "") + (x.schemeSource ? " · " + x.schemeSource : "") + '">' + (unverified ? "BTR?" : "BTR") + (x.operator ? " · " + x.operator : "") + '</span>'
      : (x.scheme === "private" ? ' <span class="badge private">private landlord</span>' : "");
    return '<div class="card ' + cls + '"><div class="row1"><span class="title">' + x.building + '</span>' + badge + scheme + overB + areaB + dupe +
      '<span class="price">£' + x.price.toLocaleString() + '</span></div>' +
      '<div class="meta"><span>' + x.street + '</span>' + avail + epc + size + domBadge(x) + '<span>first seen ' + x.firstSeen + '</span></div>' +
      '<div class="phase">📅 ' + x.phaseLabel + '</div><div class="src">' + srcs + '</div></div>';
  }
  // Split a list into shown (in-budget, active, not stale) and hidden (over / problem / gone).
  function partition(list) {
    const shown = [], over = [], problems = [], gone = [];
    for (const x of list) {
      if (x.status === "gone") gone.push(x);
      else if (staleTier(x, TH, NOW) === "problem") problems.push(x);
      else if (budgetTier(x.price, BUD) === "over") over.push(x);
      else shown.push(x);
    }
    return { shown, over, problems, gone };
  }
  function collapsible(label, list, showArea) {
    return list.length ? '<details><summary>' + label + ' (' + list.length + ')</summary>' + list.map(x => card(x, showArea)).join("") + '</details>' : "";
  }

  function renderArea(area) {
    const list = D.listings.filter(x => x.area === area.id).sort((a, b) => compareListings(a, b, areaById));
    const p = partition(list);
    return '<div class="areahead"><b>' + area.name + '</b> · ' + area.borough + ' · Zone ' + area.zone +
      '<span class="chip t-' + area.tier + '">' + tierLabel(area.tier) + '</span>' + flagChips(area) + '</div>' +
      '<div class="sect">In budget — newest block first</div>' + (p.shown.map(x => card(x, false)).join("") || '<div class="sub">No in-budget listings this run.</div>') +
      collapsible('💷 Over £' + BUD.inMax + ' — click to show', p.over, false) +
      collapsible('🔴 Stale — available &gt;5 months', p.problems, false) +
      collapsible('No longer listed — kept for history', p.gone, false);
  }

  function renderAll() {
    let q = "", fArea = "", fScheme = "", showOver = false, hideGone = true;
    const box = document.createElement("div");
    function draw() {
      let list = D.listings.slice();
      if (fArea) list = list.filter(x => x.area === fArea);
      if (fScheme) list = list.filter(x => x.scheme === fScheme);
      if (!showOver) list = list.filter(x => budgetTier(x.price, BUD) === "in");
      if (hideGone) list = list.filter(x => x.status !== "gone");
      if (q) { const s = q.toLowerCase(); list = list.filter(x => (x.building + " " + x.street + " " + x.sources.map(z => z.agent).join(" ")).toLowerCase().includes(s)); }
      list.sort((a, b) => compareListings(a, b, areaById));
      const stats = [["Showing", list.length], ["New", list.filter(x => x.isNew).length], ["BTR", list.filter(x => x.scheme === "btr").length]];
      box.querySelector("#allStats").innerHTML = stats.map(s => '<div class="stat"><div class="n">' + s[1] + '</div><div class="l">' + s[0] + '</div></div>').join("");
      box.querySelector("#allList").innerHTML = list.map(x => card(x, true)).join("") || '<div class="sub">Nothing matches.</div>';
    }
    const areaOpts = '<option value="">All areas</option>' + M.areas.map(a => '<option value="' + a.id + '">' + a.name.split(" — ")[0] + '</option>').join("");
    box.innerHTML =
      '<div class="filters"><input id="q" placeholder="Search building / street / agent" size="26" />' +
      '<select id="fa">' + areaOpts + '</select>' +
      '<select id="fs"><option value="">BTR + private</option><option value="btr">BTR only</option><option value="private">Private only</option></select>' +
      '<label style="color:var(--muted);font-size:13px"><input type="checkbox" id="fo" /> include over-budget</label>' +
      '<label style="color:var(--muted);font-size:13px"><input type="checkbox" id="fg" /> show gone</label></div>' +
      '<div class="stats" id="allStats"></div><div id="allList"></div>';
    box.querySelector("#q").oninput = e => { q = e.target.value; draw(); };
    box.querySelector("#fa").onchange = e => { fArea = e.target.value; draw(); };
    box.querySelector("#fs").onchange = e => { fScheme = e.target.value; draw(); };
    box.querySelector("#fo").onchange = e => { showOver = e.target.checked; draw(); };
    box.querySelector("#fg").onchange = e => { hideGone = !e.target.checked; draw(); };
    draw();
    return box;
  }

  const view = document.getElementById("view"), tabsEl = document.getElementById("tabs");
  const tabs = [{ id: "__all", label: "All", z: "" }].concat(M.areas.map(a => ({ id: a.id, label: a.name.split(" — ")[0].split(" / ")[0], z: "Z" + a.zone })));
  function select(id) {
    [...tabsEl.children].forEach(c => c.classList.toggle("active", c.dataset.id === id));
    view.innerHTML = "";
    if (id === "__all") view.appendChild(renderAll());
    else view.innerHTML = renderArea(areaById[id]);
  }
  tabsEl.innerHTML = tabs.map(t => '<div class="tab" data-id="' + t.id + '">' + t.label + (t.z ? '<span class="z">' + t.z + '</span>' : "") + '</div>').join("");
  [...tabsEl.children].forEach(c => c.onclick = () => select(c.dataset.id));
  select("beaufort-colindale");
</script>
</body>
</html>
```

- [ ] **Step 4: Paste the real store into the DATA block**

Replace the `PLACEHOLDER` data object between `/*DATA_START*/` and `/*DATA_END*/` with the exact contents of `flat-search/listings.json` (the object Task 1 wrote). The LOGIC block is already a verbatim copy of `viewer-logic.mjs` (with `export ` removed) — keep them identical.

- [ ] **Step 5: Run verification and a render smoke check**

Run: `node --test scripts/verify-flat-search.mjs`
Expected: PASS (8 tests total).

Run: `node -e "const h=require('fs').readFileSync('flat-search/flats.html','utf8'); const m=h.match(/DATA_START\*\/([\s\S]*?)\/\*DATA_END/); JSON.parse(m[1]); console.log('embedded store parses OK');"`
Expected: prints `embedded store parses OK`.

Then open `flat-search/flats.html` in a browser: confirm tabs render (Beaufort selected first), area tabs show tier/zone/flag chips, over-budget rows are collapsed, and the All tab's search + filters work.

- [ ] **Step 6: Commit**

```bash
git add flat-search/flats.html scripts/verify-flat-search.mjs
git commit -m "feat(flat-search): tabbed, filterable multi-area viewer"
```

---

## Task 4: Rewrite `SKILL.md` for the multi-area procedure

Update the procedure to iterate `meta.areas`, document the new budget/collapse model, ranking, area roster, and BTR portals. Keep all existing Beaufort BTR/staleness domain knowledge (now framed as the anchor area's data).

**Files:**
- Modify: `.claude/skills/beaufort-flats/SKILL.md` (whole file)

**Interfaces:**
- Consumes: `listings.json` schema (Task 1), `flats.html` markers (Task 3).
- Produces: documentation only (no code contract).

- [ ] **Step 1: Rewrite `SKILL.md`**

Replace the whole file with the version below. (Front-matter `name`/`description` and trigger phrases are unchanged so existing invocations keep working.)

````markdown
---
name: beaufort-flats
description: Run the user's repeatable London 1-bed flat search across multiple areas (Beaufort Park/Colindale anchor + Zone-3 NW/W developments) on Zoopla + Rightmove, dedupe against the saved store, mark genuinely new listings, and regenerate the standalone tabbed HTML viewer. Use when the user says "run my flat search", "check flats", "beaufort flats", or invokes /beaufort-flats.
---

# London multi-area flat search

Repeatable rental search across several areas. Re-runs the same criteria per area, **accumulates** results into a persistent store (only adds genuinely new flats), marks what's new, flags what disappeared, and regenerates a standalone tabbed HTML viewer. Areas are **tiered**: `anchor` (Beaufort Park/Colindale, the baseline) → Tier 1 (established Zone-3 master-planned) → Tier 2 (newer/compromise Zone-3 developments).

## Files (all under `flat-search/`)
- `flat-search/listings.json` — canonical store. **Read first, write last.** `meta.areas[]` is the area roster; `meta.budget` is the global budget.
- `flat-search/viewer-logic.mjs` — pure view logic (budget/sort/group/staleness). Source of truth for the viewer's logic.
- `flat-search/flats.html` — self-contained tabbed viewer. Embeds the store between `/*DATA_START*/…/*DATA_END*/` and an exact copy of `viewer-logic.mjs` (minus `export `) between `/*LOGIC_START*/…/*LOGIC_END*/`.
- `scripts/verify-flat-search.mjs` — run `node --test scripts/verify-flat-search.mjs` after any edit.

Background: `docs/flat-search/2026-06-25-area-expansion-research.md` (area dossier + sources); `docs/superpowers/specs/2026-06-25-multi-area-flat-search-design.md` (design).

## Criteria
- **1 bed, 1 bath min, furnished.** Exclude retirement / shared / student.
- **Budget (`meta.budget`):** search to £2,000; **in budget £1,600–1,850**; **over budget £1,851–2,000** (kept, collapsed in viewer); drop `<£1,600` or `>£2,000`.
- **Priority:** anchor first (baseline), then Tier 1, then Tier 2; within an area, BTR first, then newest block (`phaseYear` desc), then cheapest.
- **Areas:** defined entirely in `meta.areas[]`. New areas must be Zone 3 (Zone 2 only if 1-beds land ≤£2,000). Each area carries its own roster, phase-years, BTR operators, operator portals, search URLs, and `flags`.

## Procedure

### 1. Load the store
Read `flat-search/listings.json`. Iterate `meta.areas`. For each area run steps 2–4 using that area's `searchUrls`, `buildingRoster`, `btrOperators`, `operatorPortals`.

### 2. Fetch both platforms (WebFetch), per area
- Fetch `area.searchUrls.zoopla` and `area.searchUrls.rightmove` (both already carry `price_max=2000`).
- Ask each fetch to list every listing with: building, street, price, furnished, available date, EPC, listing URL, agent.
- **Keep only buildings in `area.buildingRoster`** (match on normalised name; allow the area keyword in the Rightmove URL to pre-filter). Drop `<£1,600` or `>£2,000`, and anything outside the roster.
- Optionally WebFetch a few detail pages to fill EPC / sqft / availability.

### 3. Capture listing date + staleness signal (per listing)
WebFetch each kept listing's detail page; extract the listed/added date:
- **Zoopla:** `"datePosted":"YYYY-MM-DDThh:mm:ss"` in the JSON-LD schema → `listedDate`. Ask: *"What is datePosted in the schema? What is the availability date? Does it say Reduced?"*
- **Rightmove:** "Added on DD/MM/YYYY" or "Reduced on" (Reduced resets the clock → use as effective `listedDate`).
- Fallback: lower listing-ID magnitude = older.
- `availableNow` = true only if availability is "now"/immediate/a past date. A FUTURE date → false.
- **Staleness rule:** a long-listed flat is a red flag ONLY when `availableNow` is true. Future-dated availability = early marketing, never flag.
- Thresholds in `meta.staleThresholdsDays` (slow 45 / stale 90 / problem 150). The viewer recomputes daysOnMarket live — store only `listedDate` + `availableNow`.
- Watch evergreen/placeholder listings (on-site dev agents keep standing listings live for months → availableNow + very high dom → buried in the problem tier).

### 4. Tag the letting scheme (BTR vs private)
Set `scheme` = `"btr"|"private"|"unknown"`, plus `operator`. Decide in order:
1. **Per-area building map / operators** — use `area.btrOperators`. **Anchor (Beaufort Park) is MIXED-tenure** — institutions run BTR pockets alongside many private-landlord blocks. Confirmed BTR there: The Draper/Duxford Tower (Way of Life, usually >£2,100); Curtiss House (Savills, 1-beds can be in budget, pull from Savills/newbuildhomes). Private blocks: Beaufort Square (Capri/Goldhawk/Golding/Fairbank/Fermont/Argent), Caversham Road (Castleton/Cornelia/Celeste), Boulevard Drive (Amelia/Allard), Bute Close (Grevillea). Treat Folio @ Beaufort Park as `unverified` → default private unless a live Folio listing appears.
2. **Operator-brand match on the lister** → tag `btr` + operator. Known NW/W operators: Way of Life, UNCLE, AWOL, Akelius, Get Living, Greystar, Quintain Living, Essential Living, Fizzy, Folio, Vertus, Grainger, Moda, Apo, Dandi, Allsop, Atlas, Berkeley/St George, Related Argent, L&Q PRS.
3. **BTR text signals:** "built for renters", "no/zero deposit", "no agency/admin fees", "on-site management", "resident app", "flexible/rolling tenancy", "by [brand]".
4. **Private signals:** high-street letting agent (Benham & Reeves, Dexters, EGRE, Romans & Partners, LDM, Foxtons…); standard AST + 5-week deposit. Same building across several DIFFERENT agents → fragmented private ownership, never BTR.
5. Else `unknown`. Store `schemeConfidence` ("confirmed"|"likely"|"unverified") and `schemeSource`. A BTR tag is `confirmed` only with the operator's own site OR a live operator-branded listing.

### 4b. BTR discovery sweep (directories are leads, not truth)
Aggregators MISS most BTR. Each run, also sweep:
- Directories: buildtorentdirectory.co.uk, rightnowresidential.co.uk, HomeViews, newbuildhomes.org, Foxtons BTR, the BPF BTR map.
- Operator portals (from each `area.operatorPortals`): e.g. **UNCLE Acton** (uncle.co.uk/acton), **One West Point / AWOL** (onewestpoint.com), **Akelius** (Cricklewood), **Berkeley/St George** (Grand Union, Dickens Yard), **Related Argent** (Brent Cross Town / themaplenw2.com), plus the anchor's Way of Life / Savills / UNCLE Colindale / L&Q.
- **Trust rule:** a directory entry is a LEAD only. Tag `btr` `confirmed` only when the operator's own site lists the building today OR a live operator-branded listing exists. Trust operator site / live listing over the directory.

### 5. Reconcile against the store (dedupe over time)
**Identity key** `id` = `area` + "-" + kebab(building) + "-" + price (area-scoped, so the same building name in two areas never collides). Across platforms/agents, same area+building+price = the SAME flat → merge into one entry with multiple `sources[]` (`{platform,url,agent}`).
- Already in store (same id): keep `firstSeen`; `lastSeen` = today; `status` = "active"; `isNew` = **false**. Update price/availability/sources if changed.
- Not in store: add. `firstSeen` = `lastSeen` = today; `status` = "active"; `isNew` = **true**.
- In store but NOT found this run: `status` = "gone"; `isNew` = false. **Do not delete** (renders struck-through).
- Set `area` and `budgetTier` (`"over"` if `price > meta.budget.inMax`, else `"in"`) on every listing.
- Set `meta.lastRun` = today (from environment/system context — do not invent).

### 6. Assign block age (newest-first ranking)
Use `area.phaseYears[building]` where present (higher year = newer = ranks first). For the anchor, the full Beaufort/Colindale phase map lives there (Duxford Tower 2025 … Adrienne 2007). When a block isn't listed: EPC B ≈ newer (2018+), EPC C ≈ older; prefer documented launch dates over EPC. Refine new-area phase-years as live listings reveal completion dates.

### 7. Write the store, then regenerate the viewer
- Write the full updated object back to `flat-search/listings.json`.
- In `flat-search/flats.html`, replace everything between `/*DATA_START*/` and `/*DATA_END*/` with the new store (a trimmed copy; agent names may be shortened). Single Edit; do not touch the rest of the HTML/CSS/JS.
- If `flat-search/viewer-logic.mjs` changed, re-inline its body (minus `export `) between `/*LOGIC_START*/…/*LOGIC_END*/`.
- Run `node --test scripts/verify-flat-search.mjs` — must pass before reporting.

### 8. Report
Summarise per area: active count, **how many NEW this run** (name them), how many newly gone, and the top newest-in-budget pick **per tier** (anchor / Tier 1 / Tier 2). Tell the user to open `flat-search/flats.html`.

## Maintaining areas
- **Add an area:** append an object to `meta.areas[]` (id, name, borough, zone, tier, buildingRoster, phaseYears, btrOperators, operatorPortals, searchUrls with `price_max=2000`, expectedBand, flags) and run. No code change needed.
- **Flags** drive viewer chips: `safetyCaution`, `zoneCaveat`, `natRail`, `brandNew`, `mostlyOverBudget`.
- New areas must be Zone 3 (Zone 2 only if 1-beds ≤£2,000). Keep the anchor (`beaufort-colindale`, Zone 4) unchanged.
````

- [ ] **Step 2: Verify the store still passes and the skill references are accurate**

Run: `node --test scripts/verify-flat-search.mjs`
Expected: PASS (8 tests).

Manually confirm: every file path named in `SKILL.md` exists (`flat-search/listings.json`, `flat-search/viewer-logic.mjs`, `flat-search/flats.html`, `scripts/verify-flat-search.mjs`, both `docs/…` files).

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/beaufort-flats/SKILL.md
git commit -m "docs(flat-search): multi-area SKILL procedure"
```

---

## Task 5: End-to-end dry run of one new area

Validate the live procedure against one real new area (Grand Union) without polluting the store, to confirm search URLs + roster filtering behave.

**Files:** none modified (read-only validation; the user runs `/beaufort-flats` separately later).

- [ ] **Step 1: Fetch the Grand Union search URLs and confirm roster filtering**

WebFetch `meta.areas[grand-union].searchUrls.rightmove` and `.zoopla`. Confirm at least some returned buildings match `buildingRoster` (e.g. "Grand Union", "Waterview House") and that prices ≤£2,000 are returned. If the roster misses obvious buildings, note them for a roster update (do not edit in this task).

- [ ] **Step 2: Record findings**

Append a short "dry-run notes" subsection to `docs/flat-search/2026-06-25-area-expansion-research.md` listing any roster gaps or URL fixes discovered, so the first real run starts clean.

- [ ] **Step 3: Commit (if notes were added)**

```bash
git add docs/flat-search/2026-06-25-area-expansion-research.md
git commit -m "docs(flat-search): grand union dry-run notes"
```

---

## Self-Review

**Spec coverage:**
- Area config `meta.areas[]` → Task 1. ✓
- £2k ceiling + overbudget collapse → Task 1 (`budgetTier`, `meta.budget`), Task 3 (`partition`/`collapsible`). ✓
- Tier-first ranking → Task 2 (`compareListings`), tested. ✓
- Area-scoped identity key → Task 1 (id format) + Task 4 (§5). ✓
- Tabbed viewer + filterable All tab + anchor first → Task 3 (`renderArea`/`renderAll`/`select("beaufort-colindale")`). ✓
- Flags → chips → Task 1 (flags) + Task 3 (`flagChips`). ✓
- Procedure loops over areas; new BTR portals → Task 4. ✓
- Backfill 11 listings, none lost → Task 1 (all 11 re-keyed), verified by Task 1 invariants. ✓
- Self-contained HTML (logic inlined, no drift) → Task 3 (LOGIC markers) + Task 3 Step 1 test. ✓
- Out of scope: no app integration → respected (no Next.js files touched). ✓

**Placeholder scan:** The only literal "PLACEHOLDER" is in Task 3 Step 3's DATA block, explicitly replaced in Step 4 with the Task 1 object — intentional, not a gap. No TODO/TBD/"handle edge cases". ✓

**Type consistency:** `budgetTier`, `staleTier`, `compareListings`, `groupByArea`, `daysOnMarket`, `tierRank` have identical signatures in Task 2 (module), Task 2 tests, and Task 3 (inlined). `meta.budget` `{min,inMax,searchMax}` consistent across Tasks 1/2/3/4. Listing `id` format identical in Task 1 and Task 4 §5. ✓
