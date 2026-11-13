# Buying a home: 2–3 bed homes near commuter stations

Tracks 2–3 bedroom homes for sale within a mile of 17 commuter stations. It
appears at `/buying` under the **Buying** project. To run a pass, use the
`home-buying-search` skill ("run my buying search").

## The brief

Set in `lib/homes/types.ts` (`BRIEF`). Changing it re-flags every listing; nothing is stored.

| | |
|---|---|
| Bedrooms | 2–3 |
| Price | £200,000–£500,000 (£500k is the hard cap) |
| Distance | searched to 1 mi; "short walk" is 1.2 km (about 0.75 mi) |
| Types | houses, maisonettes and flats; new-build blocks tagged and ranked lower |
| Garden | optional, recorded when stated |
| Lease | 90+ years, once known |
| Service charge | flagged above £2,500 a year, once known |

## Train times and map positions

`lib/homes/stations.ts` holds each town's map position and its approximate
fastest train to the London terminus (rounded to 5 minutes). They drive the
map, the "train time" filter and sort, and the three answers at the top.
They're a guide for comparing towns, so check the real journey and season
ticket before deciding. Correct a time there, and add a town there when you
add one to `towns.json`.

## Files

- `towns.json`: the 17 station towns, with what was searched, why coverage
  is thin, any decision needed (`policy`), the next research step, and leads
  seen without a link. Edit it by hand between passes.
- `YYYY-MM-DD-*.csv`: one file per research pass, using the CSV header from
  the research brief (`town,listing_url,source,…,checked`). Write "n/c" for
  anything not captured. Never guess.

## Running a new pass

The scraper does the searching (Rightmove and OnTheMarket; Zoopla blocks
scripts):

```bash
npx tsx scripts/homes-scrape.ts            # all towns, ~30–40 min
npx tsx scripts/homes-scrape.ts --towns woking,reading
```

It writes `YYYY-MM-DD-scrape.csv` here, caches each town's portal ids in
`towns.json`, and re-checks homes that dropped out (withdrawn, sold STC).
A hand-researched pass works too: save it as `YYYY-MM-DD-<name>.csv` with
the same header.

Then import:

   ```bash
   npx tsx scripts/homes-import.ts
   ```

   It prints how many listings are new, which changed price, and which were
   re-seen. It's safe to run again: nothing is duplicated.

## How tracking works

- **One record per listing**, keyed by the portal's own id (`rightmove-93658944`).
- **`firstSeenAt` / `lastSeenAt`**: the first and latest pass that saw it.
- **Price history**: a point is added only when the price changes, so
  reductions show on the card ("↓ £15k since 10/11").
- **Nothing is deleted** when a listing is missing from a pass, because passes
  are partial by town. Set a listing's status to `sold-stc` or `withdrawn` in
  the CSV when you confirm it.
- **Save / Hide** on the page are stored in `home_listing_prefs` and survive re-imports.

## What the page checks

Derived live by `lib/homes/flags.ts` (tests in `__tests__/lib/homes.test.ts`):

- **Check N details**: tenure, lease, service charge, council tax and EPC
  aren't on a results page; open the listing.
- **Distance unknown** / **Beyond walking range**
- **Guide runs over budget**: for example, a "£425k–£475k" guide range.
- **Short lease**, **High service charge**: once those fields are filled in.
- **Possible duplicate**: the researcher's "possible duplicate of …" notes,
  or the same address, price and stated floor.
- **Coming soon**, **Incentive or scheme**, **Possibly stale**, **Data looks wrong**

## Collections (MongoDB)

`buy_towns`, `home_listings`, `home_listing_prefs`. The schema is in
`prisma/schema.prisma`. After schema changes, run `npx prisma db push`.
