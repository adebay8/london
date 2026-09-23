# Sofa bed search — design

**Date:** 2026-09-23
**Status:** approved, building
**Precedent:** the sofa search (`lib/sofas/*`, `docs/sofa-search/`), which this mirrors

## 1. Goal

Find a **3-seat sofa bed** that sits like the Raft Loft and opens to at least a
small double, for **£1,200 landed**.

This is not a second piece of furniture. It is the **same purchase as the sofa
search, considered a different way**: the buyer will end up with either a sofa
or a sofa bed, not both. So the sofa brief carries over almost intact — the
deep seat, the wide square arms, the low modular blocks, the 250cm wall
allowance, the £1,200 cap — and the bed requirements are added on top rather
than traded against it.

The reference product is unchanged: Raft's Loft Modular, 112cm deep. The one
new thing the buyer said explicitly is that they do not want to end up with a
small sofa in exchange for the mechanism, which is why §2 adds a width
**floor** this repo has not needed before.

## 2. Requirements

| # | Requirement | Value |
|---|---|---|
| R1 | Seating capacity | **3** people |
| R2 | Folded width | **200 – 250 cm** — both ends are gates |
| R3 | Converts to a bed | bed width ≥ **120 cm** (small double) |
| R4 | Landed cost | ≤ **£1,200** (item + delivery) |
| R5 | Condition | new, ex-display, clearance **and** second-hand all in scope |

Scored, never gated: depth, seat depth, **sitting comfort under the mechanism**
(§4), leg rest (§5), mattress quality, bedding storage, and style match (§6).

Depth is not capped, exactly as in the sofa search. Extended depth — how far
the thing reaches into the room when open — is **recorded on every row and
gated on nothing**, because the buyer is still flat-hunting and does not yet
know the floor clearance. It becomes a filter the day they do.

### Why 200cm is a gate and not a preference

"Two seats" in the sofa search always meant **two seat cushions**, not two
people — the Raft Loft look is a 3-person sofa wearing two big plump cushions.
Read as capacity it quietly authorised compact 2-seaters, and a sofa bed brief
is exactly where that error would bite: the compact models are the ones with
the worst mechanisms. So capacity is gated at 3, width is floored at 200cm,
and **cushion count is a style attribute** (§6), which is what it always was.

## 3. The three mechanism routes

Directly analogous to the chaise-or-footstool routes in the sofa search and the
PS5's bay-or-upright routes in the console search. All three are in scope; the
route is recorded per row and the buyer can filter.

- **`fold-out`** — a proper mattress folds away inside the frame on a sprung
  slat or metal action. You sit on real seat cushions and sleep on something
  else entirely. Heavier, dearer, needs floor clearance in front.
- **`pull-out`** — the seat slides forward and the back drops (Italian /
  lampolet action). Also a separate mattress; usually premium.
- **`click-clack` / `futon`** — the back drops flat and the seating surface
  *is* the sleeping surface. Compact and cheap, and the route that genuinely
  costs sitting comfort.

## 4. Sitting comfort is the real axis, and it is not depth

The mechanism lives inside the seat box, so a sofa bed's seat has to be a
firm, rigid, shallow platform. Depth survives that — deep corner sofa beds
exist, and a pull-out action actually needs depth. What does not survive is the
**plump feather-blend cushion** that gives the reference its sink-in feel.
Feather filling over a bed mechanism is close to nonexistent.

So the single field that predicts how a sofa bed sits is not a dimension:

> **`separateMattress`** — is the thing you sleep on a different object from
> the thing you sit on?

When it is true, the seat cushions are free to be ordinary good seat cushions
and sitting comfort is barely compromised. When it is false, the seat is a
mattress and sits like one. This is the sofa bed corpus's equivalent of
`legRestRoute`: recorded, surfaced in the fit label, and weighted heavily in
the score — but not a gate, because the buyer asked to see all three routes.

Supporting evidence, scored alongside it: mattress type (pocket-sprung >
sprung > memory > foam > fibre) and mattress thickness, where under about
10cm is a token mattress and 14cm+ is a real one.

## 5. Leg rest

The sofa search gated on this (its R2). Here it is **scored, not gated**.

At £1,200 landed, 200–250cm wide, deep, three seats *and* a bed mechanism,
gating on a chaise or footstool as well would very likely empty the corpus.
A storage-chaise model — a corner sofa bed whose chaise lifts to store the
bedding — satisfies the leg rest, the bed and the storage at once, and will
rise to the top on score without needing a gate to put it there.

`legRest` keeps the sofa search's vocabulary (`chaise` | `footstool` | `both` |
`none`) plus `storage-chaise`.

## 6. Style match

Carried over from the sofa search unchanged in spirit, with one addition.
It rewards, in rough order:

seat depth ≥ 95cm · **two seat cushions across a 3-seat width**
(`seatCushions`, recorded per row) · modular construction · square/wide arms ·
low back · neutral fabric · removable covers.

Feather filling drops out of the style score here — penalising its absence
would penalise every row in the corpus for a property the category cannot
have. Style is scored, never gated, for the same reason as before: gating on
prose deletes good candidates over vocabulary.

## 7. Condition

Unchanged from the sofa search. `condition` is one of `new`, `ex-display`,
`clearance`, `second-hand`; it is a filter and a badge, kept **out** of the
recommendation score because it changes what you are buying and what
protection you get, not how good the sofa bed is. It drives two recorded
facts: whether a warranty applies, and whether the stock is one-off.

Second-hand carries one extra caution in this category: a used sofa bed has a
used **mattress**, which is a different proposition from a used sofa. Rows
recorded as `second-hand` with `separateMattress` true should note whether the
mattress is included and its condition, since replacing it is a real cost.

## 8. Sanity bounds

The sofa corpus taught us that retailers put the wrong number in the right
column, and that an unguarded figure ranks the corpus backwards. The existing
guards carry over (body depth > 130cm is an L-shape footprint; seat depth >
90cm is a chaise length), plus two new ones:

- **Bed width > 200cm is a bed *length*.** A super king is 180cm, so anything
  above 200 in that column is the 190cm-ish length filed wrongly. Treated as
  unknown, never as a magnificent bed.
- **Bed length < 170cm is a width.** Same error, mirrored.

As everywhere else: unknown means unpublished, never unsuitable.

## 9. Surface area

Mirrors the sofa vertical exactly: a `SofaBed` / `SofaBedPref` Prisma model,
`lib/sofabeds/{types,fit,score,store}.ts`, `scripts/sofabeds-import.ts`,
`/api/sofa-beds` + `/api/sofa-beds/pref`, `app/sofa-beds/page.tsx`, and
`components/sofabeds/*`. Plus the three-place navigation change recorded in
memory: a sidebar band entry, a department tile and shelf on the home page,
and a basket department in `/api/summary`.

Deliberately **not** done: merging this into the `Sofa` model. The 222 rows
already in the sofa corpus were graded against a different brief — no width
floor, capacity read as cushion count — and re-grading them is a change to the
sofa search, not part of this one. If the head-to-head comparison is wanted
later, the cheap version is a link between the two pages.

## 10. Research

Five buckets, one agent each, mirroring the sofa search's split:

| Bucket | Targets |
|---|---|
| `design` | Willow & Hall (the chaise-sofa-bed-with-storage specialist, and the closest thing to a direct hit), Loaf outlet, Snug via ScS and the eBay outlet, Sofa.com, Swoon, Arlo & Jacob, Dusk, Raft outlet |
| `volume` | DFS, Sofology, ScS, Furniture Village, John Lewis, Habitat |
| `warehouse` | IKEA (FRIHETEN, HOLMSUND, VIMLE, BACKSÄLEN, LANDSKRONA — FRIHETEN is a 230cm storage-chaise corner sofa bed and should be treated as a benchmark row, not an afterthought), Costco UK, Dunelm, Wayfair UK |
| `clearance` | the outlet / ex-display / clearance sections of every retailer above |
| `secondhand` | eBay UK, Gumtree, Vinterior, Narchie, Preloved, London-focused resale |

Method as established: `curl` with full browser headers, JSON-LD `ItemList` on
category pages, Shopify `/products.json`, sitemaps as fallback. Client-rendered
sites (Argos, Next, Bensons-class) stay blocked without headful Chrome, and an
agent that cannot reach a site **says so rather than inventing listings**.

## 11. Risks

1. **The budget may not buy the brief.** £1,200 landed for a 200–250cm, deep,
   3-seat sofa bed with a separate mattress is a hard ask new. The expected
   honest answer is that IKEA's storage-chaise models, clearance and
   second-hand are the routes, and the corpus should say so plainly rather
   than pad itself with shallow 2-seaters to hit a row count.
2. **Seat depth is still rarely published**, and mattress thickness is
   published even less often. The tri-state pattern carries most of the weight
   again.
3. **Mechanism vocabulary is inconsistent across retailers.** "Sofa bed",
   "click-clack", "pull-out" and "day bed" are used loosely and sometimes
   wrongly. Where the listing does not make the mechanism unambiguous, the
   route is recorded as unknown and `separateMattress` left null — inferring it
   from the marketing name would corrupt the field the whole score leans on.
4. **Second-hand listings are unstructured and expire fast**, and here they
   carry a used mattress. This corpus goes stale faster than the others.
