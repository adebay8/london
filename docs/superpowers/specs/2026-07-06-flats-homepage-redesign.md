# /flats homepage redesign — "Decision cockpit"

**Date:** 2026-07-06 · **Status:** approved (direction A)

## Problem
The Summary tab has no focal point (four equal grey tiles, equal-weight stacked sections),
shows the best content (top picks = actual homes) as one-line grey text with no photos,
uses uniform low-contrast slate with no accent rhythm, and buries the most decision-critical
fact (notice deadline / days left) in a plain sentence.

## Principle
Inverted pyramid, decision-first: one hero → supporting metrics → visual listings → clear next
action. Keep the app's slate base + blue accent; add whitespace, type contrast, and *purposeful*
status color. Reuse existing CSS-var tokens (already AA-checked) — no new palette.

## Layout (Summary tab, top → bottom)
1. **Timing hero (focal point).** Full-width band, accent-tinted. Large: "Move out from **<floor>**".
   A prominent **days-left countdown** to the notice deadline. Urgency ramp via token color:
   ≤7 days → red, ≤14 → amber, else accent/neutral. Handles "notice served" (no deadline) and
   past-deadline states. This is the single biggest number on the page.
2. **KPI row.** 4 compact metric cards, big number + label + context/delta:
   Active (96), New this run (+2, green), Well-timed (n), Unconfirmed (n, amber).
3. **Top picks as photo cards.** Section "Where to look first" — one PickCard per tier (anchor/
   T1/T2) using the newest-in-budget pick: listing photo (graceful gradient+initial fallback),
   big price, building · area, scheme badge, timing chip. Whole card clickable → opens in Homes
   (existing `onOpenListing`), with a visible "View →" affordance + keyboard/focus support.
4. **"What changed this run" strip.** Compact chips: new (green, clickable → open) and delisted
   (struck, muted). Replaces the bare bulleted lists.
5. **Primary CTA.** "Browse all N homes →" (accent button) switches to the Homes tab.

## Components
- Rewrite `components/flats/SummaryPanel.tsx` into the cockpit (hero + KPI row + picks + changes + CTA).
- New `components/flats/PickCard.tsx` — presentational photo card for a pick (no want/reject;
  that lives in Homes). Image with `onerror` fallback to a token gradient + building initial.
- Add an `onBrowse: () => void` prop (from page: `setTab("homes")`) for the CTA; keep `onOpenListing`.
- `page.tsx`: pass `onBrowse`; minor header polish (confident type/spacing). Homes/Operators unchanged.

## Craft rules
- Type scale: hero number `text-4xl/5xl` bold; section headings `text-base font-semibold` with
  clear top spacing; body `text-sm`. More whitespace (section gap ~`space-y-8`, card padding `p-4/5`).
- Cards: `rounded-2xl`, subtle border, hover lift + ring for clickable; focus-visible rings.
- Status color used only to mean something (green=positive/new, amber=caution/unconfirmed,
  red=urgency, blue=primary/timing). Everything else stays neutral slate.
- Accessibility preserved: aria-labels on clickable cards/CTA, keyboard operable, AA contrast
  (use `--text-secondary` not `--text-muted` for meaningful text), images have alt.

## Out of scope
Homes filtering/search/sort (already redone), Operators tab, data/schema. Visual only.
