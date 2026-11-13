---
name: home-buying-search
description: Run the user's repeatable home-buying search — 2–3 bed homes for sale, £200k–£500k, within a mile of the 17 commuter stations in docs/home-buying/towns.json — across Rightmove and OnTheMarket (Zoopla when reachable), re-check homes that dropped out, load the pass into MongoDB and report what's new, where the houses are, and where the sweet spots are (rendered at /buying). Use when the user says "run my buying search", "find homes to buy", "check homes for sale", "home buying search", or invokes /home-buying-search. For renting, use beaufort-flats instead.
---

# Home-buying search (commuter towns)

The buying counterpart of `beaufort-flats`. Same shape: search each area with
fixed criteria, **accumulate** into the database (never delete), mark what's
new, re-check what disappeared before calling it gone, then report. The
difference is that most of the fetching is done by a script, not by reading
pages one at a time, so a pass covers every town and every results page.

## The brief (what we're looking for)

Defined once in `lib/homes/types.ts` (`BRIEF`). Change it there, and the
scraper, the flags and the page all follow.

| | |
|---|---|
| Bedrooms | 2–3 |
| Price | £200k–£500k. **£500k is the hard cap**; above it is flagged, not chased |
| Search radius | 1 mile of the station; "short walk" is 0.75 mi (1.2 km) |
| Types | Terraced, end-terrace, semi-detached, maisonettes, conversions **and** flats. Don't exclude anything that could qualify: this is research |
| Preference | The user leans **away from new-build flats in tall blocks** and towards houses and low-rise homes. Those blocks are kept but tagged "New-build block" and ranked lower by the page's "Best match" sort |
| Garden | Optional. Recorded when the listing says so; the page can filter on it |
| Excluded | Shared ownership, retirement / over-55s, park homes, auctions, cash-buyers-only, plots |
| Lease / costs | Lease 90+ years and service charge under £2,500 a year, once known (flagged, not excluded) |

The 17 towns, their stations and the research state of each live in
`docs/home-buying/towns.json`. Map positions and approximate train times are
in `lib/homes/stations.ts`.

## Where things live

- `scripts/homes-scrape.ts`: the scraper (Rightmove + OnTheMarket). Writes
  `docs/home-buying/<today>-scrape.csv` and updates each town's `searched`,
  `rightmoveStationId` and `onthemarketSlug` in `towns.json`. Re-checks
  listings it didn't see and records only definite answers (withdrawn /
  sold STC / under offer / still live).
- `scripts/homes-import.ts`: loads `towns.json` and every CSV in date order
  into MongoDB (`buy_towns`, `home_listings`, `home_listing_prefs`). It's safe
  to re-run.
- `lib/homes/`: `types.ts` (brief, home kind, new-build block), `flags.ts`
  (labels, duplicates across portals), `parse.ts` (CSV row → listing),
  `track.ts` (first/last seen, price history), `store.ts`.
- Page: `/buying` (`app/buying/page.tsx`, `components/homes/*`).
- Process doc: `docs/home-buying/README.md`.

## Procedure

### 1. Start the scrape in the background
The scrape is the long step (about 2 minutes a town, 30–40 minutes for all
17), so start it first and do the rest while it runs:

```bash
npx tsx scripts/homes-scrape.ts > <scratchpad>/scrape.log 2>&1
```

Run it with the Bash tool's `run_in_background: true`. You're notified when it
finishes; don't poll or sleep. Options:
- `--towns woking,reading`: only some towns (ids from `towns.json`)
- `--sources rightmove` or `--sources onthemarket`
- `--no-details`: skip Rightmove listing pages (faster, but no lease, costs or garden)
- `--no-recheck`: skip re-checking listings that dropped out
- `--today YYYY-MM-DD`: only if the environment date is wrong

A partial run (`--towns`) writes its own file (`<today>-scrape-<towns>.csv`),
so it never overwrites the full pass. Use one to fill a gap the log reports,
for example "Rightmove station id not found". Station ids and slugs are cached
in `towns.json`; set one there by hand if the lookup picks the wrong station.
Known quirks: Rightmove calls St Albans City "St. Albans Station" (8573), and
OnTheMarket has no Reading station page, so the town-wide page is used and
filtered to 1 mile.

The import takes a while for a full pass (thousands of rows, two database
calls each), so run it in the background too.

What it does per town:
1. **Rightmove:** finds the station id once (typeahead) and caches it in
   `towns.json`. Pages through the station search (2–3 bed, £200k–£500k, 1 mi,
   no shared ownership or retirement) and reads results from `__NEXT_DATA__`.
   Distance to the station comes from Rightmove. Each listing not yet
   detailed gets its page read (`window.__PAGE_MODEL`, a flattened array the
   script decodes) for tenure, lease years, service charge, ground rent,
   council tax band, garden, parking and floor area.
2. **OnTheMarket:** finds the station slug once (`woking-station`) and checks
   it against the station's coordinates, then pages through results from
   `__NEXT_DATA__`. Distance is measured from the map pin, because OTM's own
   radius is loose.
3. Drops auctions, shared ownership, retirement, park homes and anything
   outside beds or price.

Requests are sequential with a ~1 s pause. Keep it that way: it's one
person's research, not a crawler.

### 2. While it runs: sources the script can't reach
- **Zoopla / PrimeLocation** block scripted requests (403). Try one Zoopla
  station search in the built-in browser:
  `https://www.zoopla.co.uk/for-sale/property/station/rail/<station-slug>/?beds_min=2&beds_max=3&price_min=200000&price_max=500000&radius=1&is_shared_ownership=false&is_retirement_home=false`.
  If it loads, read the listings (`get_page_text`, or `__NEXT_DATA__` via the
  JS tool). Keep only homes **not already** in the scrape: same price, beds
  and street = the same home. Write them to
  `docs/home-buying/<today>-zoopla.csv` with the same header as the scrape
  CSV (`n/c` for unknowns, never guess). If it shows a challenge, CAPTCHA or
  error, **stop and skip Zoopla for this run**. Never try to get past a
  bot check. On 11 Nov 2026 it failed to load, so expect to skip it.
- **Town notes:** read each town's `gap`, `policy` and `nextAction` in
  `towns.json`. After the scrape, rewrite the ones it has made stale. A town
  that's now well covered needs no `gap`. Keep `policy` (a decision for the
  user, such as Bedford's) until the user answers it.

### 3. Import
When the scrape finishes, read the log's last lines for per-town counts,
status changes and the CSV path. Then run:

```bash
npx tsx scripts/homes-import.ts
```

It prints new / price changes / re-seen. Then run `npx jest homes`; it must
pass.

### 4. Report (lead with what's useful for deciding)
Answer in this order, short:
1. **What's new this pass**: count per town, and name the best few (houses
   first, then by distance).
2. **Houses**: how many per town, the cheapest house overall, and which
   towns have houses under about £400k.
3. **Sweet spots**: towns where a 3-bed house or 2-bed with a garden sits
   inside the budget **and** the train is ≤ 30 min. Use the ranking on
   /buying (train time against "from" and "typical").
4. **Gone**: listings re-checked as withdrawn / sold STC since last pass.
5. **Gaps**: towns with little or nothing, sources skipped (Zoopla) and why,
   and any `policy` decision still waiting on the user.
Then tell the user to open **/buying** (Buying → Homes for sale).

## Rules
- **Never delete** listings. Absence from a pass isn't proof of sale; only a
  definite re-check changes status (the script does this).
- **Never guess** a field. Unknown is `n/c` and shows as "Check listing".
- Listing ids are `<source>-<portal id>` (`rightmove-91651833`). Keep them
  stable so Save / Hide survive.
- The same home on Rightmove and OnTheMarket is merged on the page
  automatically (same price and beds, pins within ~40 m). Don't hand-dedupe.
- The brief changes in **one place** (`BRIEF`). If the user moves the cap
  or the beds, change it there and re-run. Old rows stay and get re-flagged.
- Train times in `stations.ts` are approximate. If the user corrects one,
  edit it there.

## Adding a town
Add an entry to `towns.json` (`id`, `town`, `station`) and to
`lib/homes/stations.ts` (lat/lng, minutes, terminus, label side), then run
`npx tsx scripts/homes-scrape.ts --towns <id>` and import. The scraper finds
the portal ids itself.
