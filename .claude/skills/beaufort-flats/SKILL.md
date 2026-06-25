---
name: beaufort-flats
description: Run the user's repeatable Beaufort Park (Colindale NW9) 1-bed flat search across Zoopla + Rightmove, dedupe against the saved store, mark genuinely new listings, and regenerate the standalone HTML viewer. Use when the user says "run my flat search", "check flats", "beaufort flats", or invokes /beaufort-flats.
---

# Beaufort Park flat search

Repeatable rental search for the user's flat hunt. Re-runs the same criteria, **accumulates** results into a persistent store (never blindly grows the list — only adds genuinely new flats), marks what's new since last run, flags what has disappeared, and regenerates a standalone HTML viewer.

## Files (all under `flat-search/`)
- `flat-search/listings.json` — canonical store. Source of truth. **Read it first, write it last.**
- `flat-search/flats.html` — self-contained viewer. Has an embedded data block delimited by `/*DATA_START*/` and `/*DATA_END*/`. Regenerate by replacing only that block.

## Search criteria (the user's requirements)
- **Area:** Beaufort Park **AND Colindale Gardens**, Colindale NW9 (user lives in Beaufort Square; widened to include Colindale Gardens on 2026-06-25). Include flats in either development — rosters below. Still exclude other Colindale developments (e.g. Hendon Waterside / Perryfield Way).
- **Colindale Gardens roster** (Redrow, mostly new-build ~2018–22, so generally NEWER than Beaufort Park → ranks high): Lismore Boulevard, Reverence House, Charcot Road, Florence House, Grevillea House (Bute Close). BTR within Colindale Gardens to chase via operator portals: **UNCLE Colindale** (347 units) and **L&Q Colindale Gardens PRS** (211 units) — these are BTR and won't reliably show on Zoopla/Rightmove.
- **1 bed, 1 bath min, furnished.** Exclude retirement / shared / student.
- **Price £1,600–£1,850/month.** Must ideally beat their current Beaufort Square rent.
- **Priority: newest block first.** Newness beats price within budget.

## Procedure

### 1. Fetch both platforms (WebFetch)
- Zoopla: `https://www.zoopla.co.uk/to-rent/flats/1-bedroom/colindale/?baths_min=1&furnished_state=furnished&is_retirement_home=false&is_shared_accommodation=false&is_student_accommodation=false&price_frequency=per_month&price_max=1850&price_min=1600&q=Colindale%2C%20London&radius=0.5&search_source=to-rent`
- Rightmove: `https://www.rightmove.co.uk/property-to-rent/Colindale.html?minBedrooms=1&maxBedrooms=1&minPrice=1500&maxPrice=2000&keywords=Beaufort%20Park&furnishTypes=furnished`
- Ask each fetch to list every listing with: building name, street, price, furnished, available date, EPC, listing URL, agent.
- Keep ONLY listings whose building is in the Beaufort Park roster below. Drop anything ≥£1,851 or <£1,600, and anything outside Beaufort Park (e.g. Colindale Gardens / Lismore Boulevard, Hendon Waterside / Perryfield Way).
- Optionally WebFetch a few detail pages to fill EPC / sqft / availability where the list view omits them.

### 2. Dedupe + group (across platforms AND agents)
- **Identity key** = building (normalised) + price. Two listings with the same building + price are the SAME flat — merge them into one entry with multiple `sources[]` (this is how a flat listed on both Zoopla and Rightmove, or by two agents, gets grouped).
- Each `sources[]` item = `{ platform, url, agent }`.

### 2b. Capture listing date + staleness signal (IMPORTANT)
For each kept listing, WebFetch its detail page and extract the listed/added date:
- **Zoopla:** the page schema contains `"datePosted":"YYYY-MM-DDThh:mm:ss"` — use that date as `listedDate` (most reliable; it is NOT shown as visible text, it is in the JSON-LD schema). Ask the fetch prompt: *"What is the datePosted value in the schema? What is the availability date? Does it say Reduced?"*
- **Rightmove:** look for "Added on DD/MM/YYYY" or "Reduced on" (Reduced date resets the clock — treat it as the effective listed date).
- Fallback if no date: lower listing-ID magnitude = older (a Zoopla ID in the 30–60 millions is much older than one in the 70+ millions).
- Set `availableNow` = true only if availability is "Available immediately" / "Now" / a date already in the past. A FUTURE availability date → `availableNow` = false.
- **The staleness rule (the user's key requirement):** a long-listed flat is a red flag ONLY when `availableNow` is true. A flat listed months ago but available from a future date is early-marketing, not stale — never flag it.
- Classify (thresholds in `meta.staleThresholdsDays`, default slow 45 / stale 90 / problem 150). With `daysOnMarket = today − listedDate`:
  - `availableNow` && dom > 150 → **problem** (hidden by default in the viewer; ~5 months).
  - && dom > 90 → stale · && dom > 45 → slow · else ok.
  - `availableNow` false → always ok (early marketing).
- Store `listedDate` and `availableNow` on each listing. The viewer recomputes daysOnMarket live (so it stays current whenever opened) — you only need to store the date + the boolean, not the day count.
- Watch for **evergreen/placeholder listings**: on-site dev agents (e.g. Benham & Reeves at Beaufort Park) sometimes keep a standing listing live for months. These show up as availableNow + very high dom — the problem tier correctly buries them.

### 2c. Tag the letting scheme (BTR vs private landlord)
Set `scheme` = `"btr"` | `"private"` | `"unknown"`, plus `operator` (brand name or null). Decide in this order:
**Beaufort Park is MIXED-tenure** — institutions bought pockets of units inside it and run them as BTR, alongside the many blocks sold to individual landlords. Do not assume "all private."
1. **Building map (scheme follows the block — but verify, see trust model below):**
   - **Confirmed BTR in Beaufort Park:**
     - The Draper / Duxford Tower / Draper House (Block D) → `operator:"Way of Life"` (Long Harbour). `schemeConfidence:"confirmed"`. Usually >£2,100.
     - **Curtiss House** (Aerodrome Road) → `operator:"Savills"`. Genuine BTR, 1-beds have been advertised from ~£1,343–1,600 → **can be in budget**. Does NOT reliably appear on Zoopla/Rightmove — pull from Savills' own portal / newbuildhomes.org.
   - **Unverified / likely-exited (directory says BTR, primary source disagrees):**
     - Folio London @ Beaufort Park (aggregators cite Golding House 1-beds, Ellyson House studios) — BUT Folio's own site lists NO NW9 development. Treat as `schemeConfidence:"unverified"` and default to `private` unless a live Folio-branded listing appears.
   - **Private-landlord buildings (sold leasehold to individual investors):** Beaufort Square (Capri, Goldhawk, Golding, Fairbank, Fermont, Argent), Caversham Road (Castleton, Cornelia, Celeste), Boulevard Drive (Amelia, Allard), Heritage Avenue blocks, Bute Close (Grevillea) → `scheme:"private"`, `schemeConfidence:"confirmed"` when the live lister is a high-street agent.
2. **Operator-brand match on the lister (per-flat override):** if the lister is a known BTR operator brand, tag `btr` + that operator. Known BTR operators around Colindale/London: **Way of Life, UNCLE, Get Living, Greystar, Quintain Living, Essential Living, Fizzy Living, Folio, Vertus, Grainger, Moda, Apo, Dandi, Allsop, Atlas.**
3. **BTR text signals:** "built for renters", "no deposit"/"zero deposit", "no agency/admin fees", "on-site management team", "resident app", "flexible/rolling tenancy", "by [brand]" → lean `btr`.
4. **Private signals:** listed by a high-street letting agent (Benham & Reeves, Dexters, EGRE, Romans & Partners, LDM, London-Tokyo, Foxtons, etc.); standard AST + 5-week deposit. **Tell-tale:** if the same building shows units across several DIFFERENT agents → definitely fragmented private ownership, never BTR.
5. Otherwise `unknown`.
Note: BTR is professionally managed (reliable, often no-deposit/pet-friendly, flexible) but usually pricier; private-landlord flats are often cheaper but management quality varies.

Store `schemeConfidence` ("confirmed" | "likely" | "unverified") and `schemeSource` (e.g. "operator-site", "live-listing", "directory", "building-map") on each listing. A BTR tag is only `confirmed` when backed by the operator's own site OR a live operator-branded listing.

### 2d. BTR discovery (directories are leads, NOT truth)
Aggregators (Zoopla/Rightmove) MISS most BTR because operators list on their own portals. So on each run, also sweep BTR discovery sources to catch in-budget BTR the main search won't show (e.g. Curtiss House):
- Directories: buildtorentdirectory.co.uk (e.g. `/cities/london/barnet`), Foxtons BTR pages, rightnowresidential.co.uk, HomeViews (resident reviews tagged by operator), newbuildhomes.org, the BPF Build-to-Rent map.
- Operator portals for Colindale/NW9: **Way of Life** (The Draper), **Savills** (Curtiss House), **UNCLE** (Colindale Gardens), **L&Q** (Colindale Gardens PRS). Check these directly for 1-beds in budget.
- **Trust rule:** a directory entry is a LEAD ONLY. Before tagging `btr` confidence `confirmed`, corroborate with a primary source: the operator's own website lists the building today, OR a live operator-branded listing exists. If only the directory says so → `schemeConfidence:"unverified"`. Watch freshness: directory "verified/updated" dates are per-entry and often absent; an operator that has dropped a building (e.g. Folio @ Beaufort Park) will still linger in directories for months.
- When a directory and a primary source disagree, **trust the operator site / live listing over the directory.**

### 3. Reconcile against `listings.json` (the dedupe-over-time logic)
Load the existing store, then for each listing found this run:
- **Already in store (same id):** keep its original `firstSeen`; set `lastSeen` = today; `status` = "active"; `isNew` = **false**. Update price/availability/sources if changed.
- **Not in store:** add it. `firstSeen` = today; `lastSeen` = today; `status` = "active"; `isNew` = **true**.
- **In store but NOT found this run:** set `status` = "gone"; `isNew` = false. **Do not delete** — keep for history (renders struck-through).
- `id` = kebab-case building + "-" + price, e.g. `fairbank-house-1800`.
- Set `meta.lastRun` = today's date. (Get today's date from the environment/system context — do not invent one.)

### 4. Assign block age (for newest-first ranking)
Use this map (approx completion year → `phaseYear`, plus a human `phaseLabel`). Higher year = newer = ranks first.

| Building (street) | phaseYear | Era |
|---|---|---|
| The Draper / Duxford Tower / Draper House (Block D) | 2025 | 2024–26, newest — usually >£2,100, over budget |
| Foxglove House | 2020 | newer |
| Fairbank House (Beaufort Sq) | 2021 | launched 2018, ~2021 |
| Fermont House (Beaufort Sq) | 2020 | late phase ~2018+ |
| Cornelia / Celeste / Castleton House (Caversham Rd) | 2019 | newer |
| Capri House (Beaufort Sq) | 2019 | newer |
| Golding House (Beaufort Sq) | 2016 | launched 2015, older |
| Goldhawk House (Beaufort Sq) | 2016 | launched 2014, completed ~2016, older |
| Claremont Apartments | 2013 | older |
| Amelia / Allard House (Boulevard Dr) | 2012 | ~2010–13, oldest-ish |
| Adrienne Apartments | 2007 | oldest |
| Argent House (Beaufort Sq) | 2017 | est. — confirm if seen |

Rule of thumb when a block isn't listed: EPC B ≈ newer (2018+), EPC C ≈ older. Prefer documented launch dates over EPC.

**Full Beaufort Park roster** (by street; aircraft/RAF-themed names): Beaufort Square — Capri, Goldhawk, Golding, Fairbank, Fermont, Argent. Caversham Road — Castleton, Cornelia, Celeste. Heritage Avenue — Croft, Pinnacle, Bantam, Battalion, Amiot. Boulevard Drive — Amelia, Allard. Bute Close — Grevillea. Block D "The Draper" — Duxford Tower, Draper House. Other — Adrienne, Claremont, Sterling, Foxglove, Dace (shared-ownership).

### 5. Write `listings.json`, then regenerate `flats.html`
- Write the full updated object back to `flat-search/listings.json`.
- In `flat-search/flats.html`, replace everything between `/*DATA_START*/` and `/*DATA_END*/` with the new JSON (a trimmed copy of the store — agent names may be shortened). Use a single Edit; do not rewrite the rest of the HTML/CSS/JS.

### 6. Report to the user
Summarise: total active, **how many NEW this run** (name them), how many newly gone, and the top newest-in-budget pick. Tell them to open `flat-search/flats.html`.

## Notes
- Sort order in the viewer is: **BTR first** (scheme tiebreaker — user preference "show both, BTR on top"), then `phaseYear` desc (newest block), then `price` asc. Keep the £1,600–1,850 budget; BTR just floats above private when one appears in range. The store does not need to be pre-sorted.
- If the user changes criteria (budget, area, building), update the `meta.criteria` block and the two search URLs, and note it.
- Related background: see the user's `flat-search-spec` memory for the full rationale and history.
