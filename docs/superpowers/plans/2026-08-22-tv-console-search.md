# TV Console Search Implementation Plan

**Goal:** Ship a `/consoles` decision workspace that ranks floor-standing TV units by whether they physically fit a 55" LG OLED55B56LA on its stand, an LG S80TR soundbar in front of it, and a PS5 Slim lying flat in an open bay.

**Architecture:** Mirrors the committed `/beds` feature end to end — research CSV → import script → MongoDB → client-side scoring on a plain JSON payload. The one new component is a **tri-state fit engine** (`pass`/`fail`/`unknown`) in front of the scorer, because internal bay dimensions are frequently unpublished and a binary gate would delete the corpus on absent evidence.

**Tech Stack:** Next.js 16.2 (App Router), React 19, TypeScript strict, Prisma 6 on MongoDB Atlas, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-08-22-tv-console-search-design.md`

**Testing:** Out of scope by user direction (2026-08-22). Verification is `npx tsc --noEmit`, `npx eslint`, and `npx next build`.

## Global Constraints

- **Naming:** the TS interface and Prisma model are both `TvConsole`, not `Console` — `Console` is a global DOM type name and shadowing it in module scope is a readability trap. Collection maps to `tv_consoles`. Route stays `/consoles`.
- **R1** top width ≥ **106 cm** hard, ≥ 122.8 cm preferred.
- **R2** top depth ≥ **37 cm** hard (23.5 TV base + 13.5 soundbar), ≥ 40 cm comfortable.
- **R3** open bay internal ≥ **40 × 25 × 11 cm** (W×D×H).
- **R4** top load ≥ **25 kg**. **R5** open or ported back. **R6** closed storage; books out of scope.
- **R7** overall width **150–180 cm**. **R8** floor-standing only. **R9** landed ≤ **£500**.
- **Missing data rule:** a criterion with no evidence returns `null` and is excluded from the score average — NEVER scored as zero. Most important invariant in the codebase; see the header of `lib/beds/score.ts`.
- **Finance never enters the recommendation score.** Filter and separate sort only.
- **Atlas constraint:** Prisma compiles MongoDB `upsert` into an aggregation pipeline of ~one stage per field; Atlas rejects >50 stages. Wide models use an explicit `findUnique` → `update`/`create` branch, and long-tail fields are single JSON columns. See `lib/beds/store.ts`.
- A null bay dimension means **unpublished**, never zero. Zero would read as a real measurement and fail the gate instead of registering as unknown.

## File Structure

| File | Responsibility |
|---|---|
| `lib/retail/finance.ts` | Retailer finance policy, generic over any landed-cost item (promoted from `lib/beds/finance.ts`) |
| `lib/beds/finance.ts` | Thin re-export so `/beds` is untouched |
| `lib/consoles/types.ts` | `TvConsole`, `Bay`, measured kit constants, derived requirements |
| `lib/consoles/fit.ts` | Tri-state geometry engine. No scoring, no formatting |
| `lib/consoles/score.ts` | Weighted criteria, Bayesian shrinkage, `ScoredConsole` |
| `lib/consoles/store.ts` | Prisma ↔ plain object mapping, JSON column boundary |
| `scripts/consoles-import.ts` | CSV → MongoDB, idempotent, preserves prefs |
| `app/api/consoles/route.ts` | `GET` whole store |
| `app/api/consoles/pref/route.ts` | `POST`/`DELETE` want/reject |
| `app/consoles/page.tsx` | View state, filtering, sorting |
| `components/consoles/ConsoleCard.tsx` | Grid card |
| `components/consoles/ConsoleDetail.tsx` | Detail drawer |
| `components/consoles/ConsoleFilterRail.tsx` | Filter controls |
| `components/consoles/FitDiagram.tsx` | To-scale inline SVG fit diagram |

---

## Task 1 — Promote finance to `lib/retail`

`lib/beds/finance.ts` is retailer-level policy logic with nothing bed-specific but its type signature.

- [ ] Create `lib/retail/finance.ts`: move `FinancePolicy`, `FinanceTier`, `FinanceType`, `NO_FINANCE` (from `lib/beds/types.ts`) and `FinanceOffer`, `financeFor`, `compareFinance`, `financeLabel` (from `lib/beds/finance.ts`). Generalise the functions over `interface Financeable { landedCostGbp: number; finance: FinancePolicy }`.
- [ ] Reduce `lib/beds/finance.ts` to a re-export of the same names.
- [ ] Change `lib/beds/types.ts` to re-export the finance types rather than define them.
- [ ] Verify `/beds` unchanged: `npx tsc --noEmit` clean.

## Task 2 — `lib/consoles/types.ts`

- [ ] `Pref`, `Assembly`, `BayKind` (`open`/`door`/`glass-door`/`drawer`), `BackPanel` (`open`/`ported`/`solid`), `Bay`.
- [ ] Measured kit constants with their sources in comments: TV 122.8 wide / stand 105.7 wide / base 23.5 deep / 14.5 kg / **6.4 cm screen clearance (DERIVED, verify with a tape measure)**; soundbar 99.8 × 13.5 × 6.35; PS5 Slim 35.8 × 21.6 × 9.6.
- [ ] Derived requirement constants R1–R9.
- [ ] `TvConsole` interface.

## Task 3 — `lib/consoles/fit.ts`

- [ ] `Verdict = "pass" | "fail" | "unknown"`, `Fit { tv, soundbar, ps5, overall, notes }`.
- [ ] `largestOpenBay(bays)` — largest by volume among fully-dimensioned open/glass-door bays.
- [ ] `closedStorageLitres(bays)` — sum over door/drawer bays with complete dims; `null` if none measurable.
- [ ] `fitFor(c)`:
  - **tv** — `unknown` if top width or depth missing; else pass if width ≥ 106 and depth ≥ 23.5.
  - **soundbar** — `unknown` if top depth missing; else pass if depth ≥ 37 and top width ≥ 99.8.
  - **ps5** — pass if ANY open bay has complete dims meeting 40 × 25 × 11; else `unknown` if any open bay has incomplete dims or there are no bays recorded; else `fail`. This ordering matters: an unmeasured bay must never turn a `fail` into a false negative or a `pass` into a false positive.
  - **overall** — `fail` if any fail, else `unknown` if any unknown, else `pass`.
- [ ] `notes` carry human-readable shortfalls, e.g. `"35cm top depth — 2cm short for the TV base and soundbar in line"`.

## Task 4 — `lib/consoles/score.ts`

Port the bed scorer's machinery verbatim: per-criterion `evaluate` returning `number | null`, nulls excluded from the average, `rawScore` + `confidence`, shrinkage toward the corpus median with `SHRINKAGE_K = 25`.

- [ ] Weights: PS5 bay fit **18**, top depth **16**, frame material **12**, landed value **12**, ventilation & cable routing **8**, load rating **8**, width & proportion **8**, closed storage **8**, assembly service **6**, warranty & returns **4**.
- [ ] `ScoredConsole extends TvConsole` with `score`, `rawScore`, `confidence`, `reasons`, `gaps`, `fit`.
- [ ] `scoreAll(consoles)` derives the prior from the corpus; `scoreConsole(c, prior?)` for single-item callers.

## Task 5 — Prisma model + `lib/consoles/store.ts`

- [ ] `TvConsole` model `@@map("tv_consoles")` + `ConsolePref` `@@map("console_prefs")`, mirroring `Bed`/`BedPref` including the `pref` relation and `@@index([retailer])`.
- [ ] `bays`, `finance` and `extra` are single JSON `String` columns (Atlas 50-stage limit).
- [ ] `loadConsoles`, `saveConsole` (explicit `findUnique` → `update`/`create`, NOT `upsert`), `saveConsoles`, `setConsolePref`.
- [ ] `npx prisma generate`.

## Task 6 — `scripts/consoles-import.ts`

Direct port of `beds-import.ts`.

- [ ] Reuse its RFC4180 CSV parser, `str`/`num`/`isIncluded` helpers and stable kebab `makeId(retailer, model)`.
- [ ] Parse `bays_json`; on malformed JSON warn and store `[]` rather than throwing — one bad cell must not abandon the import.
- [ ] Drop rows where `mounting` is not floor-standing (R8).
- [ ] Stamp retailer finance from `rows/finance.jsonl` as beds does.
- [ ] Non-promoted columns fall through to `extra`.
- [ ] Idempotent: upsert by id, preserve prefs, delete stale rows.
- [ ] Default CSV path `~/Documents/console-search/tv-consoles.csv`.

## Task 7 — API routes

- [ ] `GET /api/consoles` → `{ consoles }`, nothing derived.
- [ ] `POST /api/consoles/pref` `{ consoleId, pref }`, `DELETE` clears. Validate `pref ∈ {want, reject, null}`.

## Task 8 — UI

- [ ] `ConsoleFilterRail` — landed budget slider (cap £500), fit filter (**tri-state: confirmed fits only / hide confirmed failures (default) / show everything**), top depth, bay fit, overall width band, back panel, assembly, retailer, finance, evidence, hide dismissed.
- [ ] `ConsoleCard` — retailer/model, score + confidence bar, landed cost + breakdown, fit verdict chips, key specs, save/hide, stretched link to the retailer.
- [ ] `FitDiagram` — to-scale inline SVG: top surface in cross-section with TV base and soundbar drawn on it, plus the target bay with a PS5 in it. Renders partial state when dimensions are unknown.
- [ ] `ConsoleDetail` — the diagram, cost breakdown, finance, score explanation, dimensions, bays table, build, service, `extra` fallback.
- [ ] `app/consoles/page.tsx` — URL-encoded view state, sorts: recommended, best measured, cheapest, deepest top, biggest bay, best reviewed, best finance.
- [ ] Sidebar entry `{ href: "/consoles", label: "TV unit", icon: "📺" }`.

## Task 9 — Research corpus

- [ ] Retailers: IKEA, Argos/Habitat, John Lewis, Wayfair, Dunelm, Next, Furniture Village, Oak Furnitureland, Very, B&Q, La Redoute, Barker & Stonehouse, Costco.
- [ ] Filter at source to floor-standing, 150–180 cm wide, ≤ £500 landed.
- [ ] Internal bay dimensions are the hard part. Source order: spec table → dimensions diagram → assembly manual PDF → customer Q&A → record as unpublished. **Never guess a dimension** — an absent value must stay null so the tri-state engine can report it honestly.
- [ ] Retailer finance policy once per retailer into `rows/finance.jsonl`.
- [ ] Import and confirm the corpus loads at `/consoles`.

## Task 10 — Verification

- [ ] `npx tsc --noEmit` clean, `npx eslint` clean, `npx next build` succeeds.
- [ ] `/beds` behaviourally unchanged after the finance move.
- [ ] Report corpus size, and the share of rows whose fit verdict is `unknown` rather than decided.
