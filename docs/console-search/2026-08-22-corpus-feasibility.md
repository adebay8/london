# TV console corpus — feasibility finding

**Date:** 2026-08-22
**Question:** are internal bay dimensions obtainable often enough for the
tri-state fit engine to be the right design? (Spec §11 risk 1.)

**Verdict: yes — proceed as specced.** Of 13 imported units, 7 (54%) have at
least one fully-measured compartment, comfortably above the 40% threshold the
plan set for a go. Where dimensions are missing they are genuinely unpublished
rather than unobtainable in principle, so the corpus improves with effort
instead of hitting a wall.

## Where the data comes from

| Source tier | Result |
|---|---|
| Retailer spec table | Best by far. Roseland Furniture publishes internal shelf W×D×H for every unit; Dunelm publishes shelf width and height but **not depth** |
| Dimensions diagram | Occasionally carries internal figures, but usually as an image |
| Assembly manual PDF | Not needed for this sample; the obvious fallback for IKEA |
| Customer Q&A | Not needed for this sample |
| Not obtainable | IKEA publishes external dimensions and load ratings but no internal compartment sizes for BESTÅ, HAVSTA or IDANÄS |

Two retailers block automated access outright (Argos, House of Oak, and Currys
during the TV research). Their rows carry whatever the retailer's own search
listing states, and say so in `notes`.

## The finding that actually matters

**The UK market clusters at 35–40cm deep, and the requirement is 37cm.**

Observed top depths: 35, 35, 36, 38, 39, 39.6, 40, 40, 42, 44, 44, 45, 47.

R2 therefore splits the market almost down the middle, and it does so by
centimetres. The Roseland Shorwell misses by **one centimetre** (36 vs 37).
Two otherwise strong Roseland units — London Oak and Farro — have bays that
take a PS5 comfortably and fail purely on a 35cm top.

This validates front-loading the corpus: had the UI been built first, this
would have surfaced as "why is everything ruled out?" rather than as a
measured property of the market.

## Bug found by real data

The Dunelm Bryant has 10cm-high open shelves — definitively too low for a
9.6cm PS5 plus airflow — but its shelf *depth* is unpublished. The first
implementation resolved that to `unknown` because not every axis was measured,
which would have let a definitively-too-small bay survive the default filter.

Fixed in `lib/consoles/fit.ts`: a bay definitively fails if **any measured
axis** is below requirement, and is only `unknown` when every measured axis
passes and some axis is missing. `unknown` is for absent evidence, not for
evidence we have and don't like.

## Corpus state

13 floor-standing units, 1 wall-mounted row dropped at import under R8.

- **1 confirmed** to take the TV, the soundbar in front and a flat PS5
- **7 unconfirmed**, all blocked on unpublished internal bay dimensions
- **5 ruled out** — 3 on top depth, 2 on the bay

## Known gaps

- **Finance is not researched.** `rows/finance.jsonl` does not exist, so every
  unit reports no finance policy. The plumbing works; the retailer research
  has not been done.
- The corpus is a working sample, not a market sweep. Retailers not yet
  covered: John Lewis, Wayfair, Next, Furniture Village, Oak Furnitureland,
  Very, B&Q, La Redoute, Barker & Stonehouse, Costco.
- Assembly position is unverified for House of Oak and defaults to
  self-assembly, which mildly understates its score.
