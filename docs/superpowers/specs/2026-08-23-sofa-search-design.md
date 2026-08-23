# Sofa search — design

**Date:** 2026-08-23
**Status:** approved, building
**Precedent:** the TV console search (`lib/consoles/*`), which this mirrors

## 1. Goal

Find a **2-seat sofa with a leg rest** in the style of the Raft Loft modular —
deep seat, wide square arms, low modular blocks, plump neutral cushions — for
**£1,200 landed**, which is roughly a third of what Raft charges new.

The reference product is Raft's Loft Modular (£3,910 for the 4-piece; modules
£719–£1,714 each depending on fabric). Its module geometry is the yardstick:

| Raft Loft module | W × D × H |
|---|---|
| 4-piece unit | 300 × 112 × 90 cm |
| Corner piece | 112 × 112 × 80 cm |
| Infill (armless seat) | 76 × 112 × 80 cm |
| Footstool | 80 × 90 × 43 cm |

**112 cm deep** is the defining feature and the reason it looks the way it does.

## 2. Requirements

| # | Requirement | Value |
|---|---|---|
| R1 | Seats | ≥ **2** |
| R2 | Leg rest | a built-in **chaise** OR a separate **footstool**, either counts |
| R3 | Overall width | ≤ **250 cm** |
| R4 | Landed cost | ≤ **£1,200** (item + delivery) |
| R5 | Condition | new, ex-display, clearance/outlet **and** second-hand all in scope |

Depth is deliberately **not** capped — the user confirmed deep is fine, and
depth is the thing that makes this look like the reference. It is scored, not
gated.

## 3. The two leg-rest routes

Directly analogous to the PS5's bay-or-upright routes in the console search.

- **`chaise`** — built into one end. Cleaner line and a proper lie-down, but
  commits to a left- or right-facing handing.
- **`footstool`** — a separate movable piece, as in the user's outlet photo.
  No handing, doubles as extra seating, can be pushed away.

`fitFor` passes if either exists and records which in `fit.legRestRoute`.
Neither is scored above the other: the user explicitly asked to see both.
Where a sofa offers both, that is a small bonus.

## 4. Style match

Unlike the console search, the *look* is an explicit requirement here, so a
style score sits alongside the fit gates. It rewards, in rough order:

seat depth ≥ 95 cm · modular construction · square/wide arms · feather or
feather-blend filling · low back · neutral fabric · removable covers.

Style is scored, never gated — one person's "square arm" is another's "track
arm", and gating on prose would delete good candidates on vocabulary.

## 5. Condition

New to this search. `condition` is one of `new`, `ex-display`, `clearance`,
`second-hand`, and it is **not** folded into the recommendation score: like
finance in the other searches, it changes what you're buying and what
protection you get, not how good the sofa is. It is a filter and a badge.

It does affect two real things, recorded per row: whether a warranty applies,
and whether the item is one-off stock that cannot be reordered.

## 6. Surface area

Mirrors the console search exactly: `Sofa`/`SofaPref` Prisma models,
`lib/sofas/{types,fit,score,store}.ts`, `scripts/sofas-import.ts`,
`/api/sofas` + `/api/sofas/pref`, `app/sofas/page.tsx`, and
`components/sofas/*`. Plus the three-place navigation change recorded in
memory: a sidebar band entry, a department tile and shelf on the home page,
and a basket department in `/api/summary`.

## 7. Research

Retailers: Costco (explicitly requested), DFS, Sofology, SCS, Furniture
Village, John Lewis, Habitat/Argos, Dunelm, Next, IKEA, Loaf, Swoon, Snug,
Sofa.com, Made/Dusk, Wayfair — plus the outlet and clearance sections of Raft,
Loaf and Sofology, and second-hand listings.

Method as established: `curl` with a browser User-Agent, JSON-LD `ItemList` on
category pages, sitemaps as fallback. Client-rendered sites (Argos, Next,
Bensons-class) stay blocked without headful Chrome.

## 8. Risks

1. **Seat depth is rarely published.** Retailers publish overall depth; seat
   depth is what actually determines the look. Expect the tri-state pattern to
   carry most of the weight again.
2. **Second-hand listings are unstructured** and expire fast. They will be
   recorded with a `condition` of `second-hand` and a note that stock is
   one-off; the corpus will go stale faster than the others.
3. **£1,200 against a £2,700 reference** may simply not buy the deep-modular
   look new. If so the honest answer is that outlet and second-hand are the
   only routes, and the corpus should say so rather than pad with lookalikes.
