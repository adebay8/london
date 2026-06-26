# Move-timing window — design

**Date:** 2026-06-26
**Status:** Approved design (pending implementation)
**Extends:** `.claude/skills/beaufort-flats/SKILL.md` + `flat-search/` (listings.json, viewer-logic.mjs, flats.html)
**Companion design:** `docs/superpowers/specs/2026-06-25-multi-area-flat-search-design.md`

## Goal
Factor the user's **two-month notice constraint** into the flat search so the viewer can tell, for every listing, *how well its availability date lines up with the earliest date the user can actually move out* — and surface the real-world decision the constraint forces (serve notice by a deadline, or the move-out date steps a month later). Timing is **guidance, never a filter**: nothing is dropped on it.

## Domain model — the notice rule

The user's tenancy is periodic, rent periods running **15th → 14th** (move-in was the 15th). To leave, notice must cover **two whole rent periods after the end of the current period**. This yields a **move-out floor** that is a *step function* anchored to the 14th, not a smooth slide:

| Notice served… | Earliest last day (move-out floor) |
|---|---|
| now → **14 Jul 2026** | **14 Sep 2026** |
| 15 Jul → 14 Aug | 14 Oct 2026 |
| 15 Aug → 14 Sep | 14 Nov 2026 |

**Floor algorithm** (reference date `R` = `noticeServedDate` if set, else today):
1. `currentPeriodEnd(R)` = the anchor day (14th) on/after `R`: if `day(R) ≤ 14` → 14th of `R`'s month, else 14th of the next month.
2. `moveOutFloor` = `currentPeriodEnd(R)` + `noticePeriodsRequired` months (each period is one calendar month ending on the 14th).

Worked: `R = 26 Jun` → day 26 > 14 → currentPeriodEnd = 14 Jul → +2 months → **14 Sep**. `R = 15 Jul` → 14 Aug → **14 Oct**.

**Notice deadline** = `currentPeriodEnd(today)` (= **14 Jul 2026**): the last day notice can be served and still keep the *nearest* floor. Serving after it bumps the floor a month. `daysToDeadline = noticeDeadline − today`.

### The structural tension (why this matters now, not just mechanically)
The user's required lead time is **~2.5–3.5 months**, but the market's listing horizon is **~4–6 weeks** — and the two-month-notice rule is new enough that listing behaviour hasn't re-clocked to it yet. Consequence: flats *dated* into the user's window (Sep) barely exist today and won't surface until **~early August** — which is *after* the 14 Jul notice deadline. So the user cannot both see September stock *and* keep a September move-out; committing to 14 Sep means serving notice ~blind. The design's job is to make this trade legible, not to pretend well-timed flats are already there.

## Configuration — `meta.moveTiming`
New block in `listings.json` `meta`:
```jsonc
"moveTiming": {
  "rentPeriodAnchorDay": 14,     // tenancy period ends on the 14th
  "noticePeriodsRequired": 2,    // two whole rent periods after current period end
  "overlapIdealDays": 7,         // ≤1 week holding both places = ideal
  "overlapMaxDays": 14,          // willing to double-pay up to ~2 weeks for a strong flat
  "noticeServedDate": null       // ISO once notice is actually served → fixes the floor; null = rolling from today
}
```
- `noticeServedDate: null` → **rolling**: floor recomputed from today each render (today that's 14 Sep, steps to 14 Oct after 14 Jul).
- Setting `noticeServedDate` (e.g. `"2026-07-14"`) → floor **fixed** thereafter, deadline banner disappears.

## Listing shape change
Add **one stored field**:
- `availableDate` — ISO `"YYYY-MM-DD"` or `null`. The concrete availability date parsed during fetch, alongside the existing human `available` string and `availableNow` bool. `null` when the listing says "Ask agent"/no date.

`timingFit` itself is **not stored** — like `daysOnMarket` and `budgetTier`, it is **recomputed live by the viewer** from `availableDate` + the current `moveOutFloor` (which depends on today). Storing it would make it stale the next day.

## `timingFit` classifier (viewer-logic.mjs, computed live)
Let `M = moveOutFloor`, `a = availableDate`. Define `d = daysBetween(a, M)` (positive ⇒ flat available *before* move-out ⇒ overlap/double-rent days; negative ⇒ available *after* ⇒ gap):

| Condition | `timingFit` | Meaning |
|---|---|---|
| `a` is null | `unknown` | "Ask agent" — can't place; could still be a fit |
| `availableNow` true (and no future date) | `early` | available now ⇒ `d ≈ M − today` (large) ⇒ too early |
| `0 ≤ d ≤ overlapIdeal` (0–7) | `ideal` | move in within a week of leaving old place |
| `overlapIdeal < d ≤ overlapMax` (7–14) | `workable` | 1–2 weeks double rent — acceptable for a strong flat |
| `d > overlapMax` (>14) | `early` | >2 weeks double rent — costly; annotate cost = `d` days |
| `d < 0` | `late` | available after move-out ⇒ gap of `|d|` days, or delay notice (bumps floor a month) |

**BTR-flex hint:** when `scheme === "btr"`, the viewer adds a "start date often negotiable" note to `early`/`unknown` BTR rows — operators routinely let you pick a future start, so an `early` BTR unit is bridgeable to the window where a private immediate-let is not. Heuristic chip, not stored truth.

## Ranking interaction
Existing sort (tier → scheme BTR-first → `phaseYear` desc → price asc) is **preserved**. Add a **"Well-timed first" toggle, default ON**, that prepends a `timingFit` rank (`ideal < workable < unknown < early < late`) as the first *within-area* key, falling back to the existing key. With the toggle off, behaviour is identical to today. (Right now nearly everything is `early`, so the fallback order dominates — by design.)

## Viewer — `flats.html`
- **Move-out banner** (top, recomputed live): *"Earliest move-out if you give notice today: **14 Sep 2026**. Serve notice by **14 Jul** (N days left) to keep it — after that it steps to 14 Oct."* When `noticeServedDate` is set, it reads *"Notice served DD MMM → move out 14 Sep (fixed)."*
- **Per-listing timing chip:** ✅ ideal · 🟡 workable (Nd overlap) · ⏳ early (Nd double rent) · ⛔ late (Nd gap) · ❔ unknown; BTR rows get a "start negotiable" sub-note.
- **Filter:** "timing" filter on the All tab (ideal / workable / include early / include late / unknown).
- **Sort:** "Well-timed first" toggle (default on).
- All live from current date + `meta.moveTiming`; no rebuild step.

## Procedure changes — SKILL.md
- **Step 3 (capture listing date):** additionally record `availableDate` (ISO) from the same detail-page fetch already done — prefer an exact date; leave `null` for "Ask agent"/unknown. (No extra fetches.)
- **Step 7 (write):** add `meta.moveTiming` (once); when `viewer-logic.mjs` gains `moveOutFloor`/`timingFit`, re-inline the logic block.
- **Step 8 (report):** add a **timing line** — current move-out floor, notice deadline + days left, and the best **well-timed** (ideal/workable) pick per tier *separately* from the newest-in-budget pick. State plainly when nothing is well-timed yet ("all live stock is too early; September-dated stock expected from ~early August — hold or negotiate a BTR start date").

## Out of scope (YAGNI)
- No calendar/notification to remind the user to serve notice — the banner surfaces the deadline; acting on it is theirs.
- No per-landlord scrape of how negotiable a start date is — BTR-flex is a scheme-based heuristic chip only.
- No change to budget logic, area roster, or dedupe/reconcile.
- `noticePeriodsRequired`/`anchorDay` are config, not auto-derived from any contract document.

## Testing / verification (`scripts/verify-flat-search.mjs`)
- `moveOutFloor`: `26 Jun → 14 Sep`; `10 Jul → 14 Sep`; `14 Jul → 14 Sep`; `15 Jul → 14 Oct`; December rollover (`20 Dec 2026 → 14 Mar 2027`); `noticeServedDate` set → fixed regardless of today.
- `noticeDeadline`: today `26 Jun → 14 Jul`; `daysToDeadline` non-negative until it passes.
- `timingFit` buckets: `a = M → ideal`; `M−7 → ideal`; `M−8 → workable`; `M−14 → workable`; `M−15 → early`; `M+3 → late`; `a = null → unknown`; `availableNow → early`.
- Viewer: timing recomputes live as simulated "today" advances across the 14 Jul step; "Well-timed first" toggle off ⇒ identical order to the pre-existing ranking test.

## Risks
- **Transition-period emptiness:** the `ideal`/`workable` buckets will be sparse for weeks. Mitigation: copy/report frames an empty well-timed bucket as "not listed yet," never "no options"; BTR-flex hint keeps `early` BTR units in play.
- **Soft availability data:** `availableDate` is often "Ask agent" (`null` ⇒ `unknown`) and dates are negotiable — so timing is advisory; the keep-don't-drop rule is essential.
- **Anchor-day assumption:** the 14th anchor and 2-period rule are hard-coded config; if the contract differs, one `meta.moveTiming` edit corrects everything.
