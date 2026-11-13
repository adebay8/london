"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import HomeCard from "@/components/homes/HomeCard";
import TownPanel from "@/components/homes/TownPanel";
import WeightsPanel, { presetLabel } from "@/components/homes/WeightsPanel";
import { flagsFor, type Flag } from "@/lib/homes/flags";
import { CRITERIA, explain, homeFactors, scoreFactors, whyLine, type CriterionId } from "@/lib/homes/score";
import { STATIONS } from "@/lib/homes/stations";
import { BRIEF, homeKind, isNewBuildBlock, type HomeKind, type HomeListing } from "@/lib/homes/types";
import { useHomes } from "@/lib/homes/useHomes";
import { useWeights } from "@/lib/homes/useWeights";

// Buying a home: 2–3 bed homes for sale near commuter stations.
//
// The working list: every home, ranked by the user's weights (shared with the
// Towns page, which holds the map, the standout answers and the research
// notes). Search, sort and filters sit in plain sight above the cards, and
// the whole view is remembered between visits.

type Sort = "recommended" | "match" | "price" | "price-desc" | "commute" | "distance" | "size" | "recent";
const SORTS: Record<Sort, string> = {
  recommended: "Recommended (your weights)",
  match: "Best match (houses first)",
  price: "Cheapest first",
  "price-desc": "Most expensive first",
  commute: "Shortest train to London",
  distance: "Closest to the station",
  size: "Biggest first (where stated)",
  recent: "Newest listing",
};

type Kind = "any" | "house" | "house-maisonette" | "flat";
type Build = "any" | "new" | "resale";

interface Filters {
  q: string;
  town: string | null;
  maxPrice: number | null;
  maxMins: number | null;
  kind: Kind;
  beds: number | null;
  garden: boolean;
  hideBlocks: boolean;
  newOnly: boolean;
  twoBaths: boolean;
  build: Build;
  walkableOnly: boolean;
  hideDuplicates: boolean;
  hideComingSoon: boolean;
  hideHidden: boolean;
  savedOnly: boolean;
  sort: Sort;
}

const DEFAULTS: Filters = {
  q: "",
  town: null,
  maxPrice: null,
  maxMins: null,
  kind: "any",
  beds: null,
  garden: false,
  hideBlocks: false,
  newOnly: false,
  twoBaths: false,
  build: "any",
  walkableOnly: false,
  hideDuplicates: true,
  hideComingSoon: false,
  hideHidden: true,
  savedOnly: false,
  sort: "recommended",
};

const VIEW_KEY = "buying.view";
const KINDS: Kind[] = ["any", "house", "house-maisonette", "flat"];

const PRICE_STEPS = [250_000, 300_000, 350_000, 400_000, 450_000];
const MIN_STEPS = [20, 25, 30, 35, 40];
// Houses first, then maisonettes and conversions, then low-rise flats, then
// new-build blocks: the order the user leans, without hiding anything.
const KIND_RANK: Record<HomeKind, number> = { house: 0, maisonette: 1, flat: 2 };
const matchRank = (l: HomeListing) => KIND_RANK[homeKind(l)] + (isNewBuildBlock(l) ? 1 : 0);
const k = (p: number) => `£${Math.round(p / 1000)}k`;
const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const pill = (active: boolean) =>
  `h-9 shrink-0 rounded-full border px-3 text-sm transition-colors ${
    active
      ? "border-[var(--focus)] bg-[var(--focus-wash)] font-semibold text-[var(--ink)]"
      : "border-[var(--line-control)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--sunk)]"
  }`;

export default function BuyingPage() {
  const { towns, listings, error, retry, setPref, all, townById, dupes, hiddenDupes, live, stats, checked } = useHomes();
  const [weights, setWeights] = useWeights();
  const [f, setF] = useState<Filters>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  // Restore the last view, then let a link (?town=…&kind=…) override it.
  useEffect(() => {
    let view: Filters = DEFAULTS;
    try {
      const stored = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null") as Partial<Filters> | null;
      if (stored && typeof stored === "object") view = { ...DEFAULTS, ...stored, sort: stored.sort && stored.sort in SORTS ? stored.sort : DEFAULTS.sort };
    } catch {
      // a garbled view just means starting fresh
    }
    const q = new URLSearchParams(window.location.search);
    if (q.has("town")) view = { ...view, town: q.get("town") || null };
    const kind = q.get("kind") as Kind | null;
    if (kind && KINDS.includes(kind)) view = { ...view, kind };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage once after mount
    setF(view);
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(VIEW_KEY, JSON.stringify(f));
  }, [f, loaded]);

  const factors = useMemo(() => new Map(all.map((l) => [l.id, homeFactors(l)])), [all]);
  const scoreOf = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const [id, fs] of factors) m.set(id, scoreFactors(fs, weights));
    return m;
  }, [factors, weights]);
  const coverage = useMemo(() => {
    const out: Partial<Record<CriterionId, number>> = {};
    if (!live.length) return out;
    for (const c of CRITERIA) out[c.id] = live.filter((l) => factors.get(l.id)?.[c.id] != null).length / live.length;
    return out;
  }, [live, factors]);

  const flags = useMemo(() => {
    const m = new Map<string, Flag[]>();
    for (const l of all) m.set(l.id, flagsFor(l, { duplicates: dupes.get(l.id) }));
    return m;
  }, [all, dupes]);

  const minsOf = useCallback((l: HomeListing) => STATIONS[l.townId]?.mins ?? null, []);

  // "New this pass" = first seen on the latest pass, as long as there was an
  // earlier one to compare against.
  const latestPass = useMemo(() => all.reduce<string | null>((m, l) => (!m || l.lastSeenAt > m ? l.lastSeenAt : m), null), [all]);
  const firstPass = useMemo(() => all.reduce<string | null>((m, l) => (!m || l.firstSeenAt < m ? l.firstSeenAt : m), null), [all]);
  const rawNew = useCallback((l: HomeListing) => latestPass != null && l.firstSeenAt === latestPass && l.firstSeenAt !== firstPass, [latestPass, firstPass]);
  // When a pass widens the search, nearly everything is "new" and the badge
  // says nothing. Show it only when new homes are the minority.
  const newIsSignal = useMemo(() => live.filter(rawNew).length < live.length / 2, [live, rawNew]);
  const isNew = useCallback((l: HomeListing) => newIsSignal && rawNew(l), [newIsSignal, rawNew]);
  const newCount = useMemo(() => live.filter(isNew).length, [live, isNew]);

  const visible = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const out = all.filter((l) => {
      if (f.town && l.townId !== f.town) return false;
      if (f.hideHidden && l.pref === "reject") return false;
      if (f.savedOnly && l.pref !== "want") return false;
      if (f.hideComingSoon && l.status === "coming-soon") return false;
      if (f.hideDuplicates && hiddenDupes.has(l.id)) return false;
      if (f.maxPrice && l.priceGbp > f.maxPrice) return false;
      if (f.maxMins) {
        const m = minsOf(l);
        if (m == null || m > f.maxMins) return false;
      }
      const kind = homeKind(l);
      if (f.kind === "house" && kind !== "house") return false;
      if (f.kind === "house-maisonette" && kind === "flat") return false;
      if (f.kind === "flat" && kind !== "flat") return false;
      if (f.beds && l.beds !== f.beds) return false;
      if (f.garden && l.garden !== true) return false;
      if (f.hideBlocks && isNewBuildBlock(l)) return false;
      if (f.newOnly && !(latestPass && l.firstSeenAt === latestPass && l.firstSeenAt !== firstPass)) return false;
      if (f.twoBaths && (l.baths ?? 0) < 2) return false;
      if (f.build === "new" && l.newBuild !== true) return false;
      if (f.build === "resale" && l.newBuild !== false) return false;
      // Unknown distance stays in: unstated is not the same as far.
      if (f.walkableOnly && l.distanceMiles != null && l.distanceMiles > BRIEF.maxWalkMiles) return false;
      if (q) {
        const hay = [l.address, l.agent, l.propertyType, townById.get(l.townId)?.town, ...l.keyFeatures].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const byMatch = (a: HomeListing, b: HomeListing) => matchRank(a) - matchRank(b) || (a.distanceMiles ?? 9) - (b.distanceMiles ?? 9) || a.priceGbp - b.priceGbp;
    const by: Record<Sort, (a: HomeListing, b: HomeListing) => number> = {
      // Nothing weighted → no scores, so this falls back to the match order.
      recommended: (a, b) => (scoreOf.get(b.id) ?? -1) - (scoreOf.get(a.id) ?? -1) || byMatch(a, b),
      match: (a, b) => matchRank(a) - matchRank(b) || (a.distanceMiles ?? 9) - (b.distanceMiles ?? 9) || a.priceGbp - b.priceGbp,
      price: (a, b) => a.priceGbp - b.priceGbp,
      "price-desc": (a, b) => b.priceGbp - a.priceGbp,
      commute: (a, b) => (minsOf(a) ?? 99) - (minsOf(b) ?? 99) || a.priceGbp - b.priceGbp,
      distance: (a, b) => (a.distanceMiles ?? 9) - (b.distanceMiles ?? 9) || a.priceGbp - b.priceGbp,
      size: (a, b) => (b.floorAreaSqFt ?? 0) - (a.floorAreaSqFt ?? 0) || a.priceGbp - b.priceGbp,
      recent: (a, b) => (b.listedOn ?? "").localeCompare(a.listedOn ?? ""),
    };
    return out.sort(by[f.sort]);
  }, [all, f, hiddenDupes, minsOf, townById, latestPass, firstPass, scoreOf]);

  // Thousands of homes: render a page of cards at a time. The count resets
  // whenever the filters change (keyed on them, so no effect is needed).
  const PAGE = 48;
  const sig = JSON.stringify(f);
  const [shown, setShown] = useState({ sig: "", n: PAGE });
  const limit = shown.sig === sig ? shown.n : PAGE;

  const withStock = stats.filter((s) => s.homes.length > 0);
  const saved = all.filter((l) => l.pref === "want").length;
  const selectedTown = f.town ? townById.get(f.town) : undefined;
  const baseCount = all.filter((l) => !(f.hideDuplicates && hiddenDupes.has(l.id)) && !(f.hideHidden && l.pref === "reject")).length;
  const narrowed =
    !!f.q || !!f.town || !!f.maxPrice || !!f.maxMins || f.kind !== "any" || !!f.beds || f.garden || f.hideBlocks || f.newOnly || f.twoBaths || f.build !== "any" || f.walkableOnly || f.savedOnly || f.hideComingSoon;
  const set = (patch: Partial<Filters>) => setF((prev) => ({ ...prev, ...patch }));
  const clear = () => setF((prev) => ({ ...DEFAULTS, sort: prev.sort }));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1200px] px-4 pb-24 pt-6 sm:px-8 lg:pb-12">
        <header>
          <p className="text-sm text-[var(--ink-3)]">Buying · Homes for sale</p>
          <h1 className="mt-1 max-w-[24ch] text-3xl font-bold leading-tight tracking-[-0.025em] text-[var(--ink)] sm:text-4xl">
            2–3 bed homes near commuter stations
          </h1>
          {listings && (
            <p className="mt-3 max-w-[68ch] font-serif text-lg leading-relaxed text-[var(--ink-2)]">
              {live.length} homes for sale, £{BRIEF.minPriceGbp / 1000}k–£{BRIEF.maxPriceGbp / 1000}k, within walking distance of {withStock.length} of{" "}
              {towns?.length} stations{checked && `, last checked ${shortDate(checked)}`}.
            </p>
          )}
        </header>

        {error && (
          <div role="alert" className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border-l-4 border-[var(--bad)] bg-[var(--bad-wash)] p-4 text-sm">
            <span className="mr-auto">Couldn&apos;t load the listings. ({error})</span>
            <button
              type="button"
              onClick={retry}
              className="h-10 rounded-full border border-[var(--line-control)] bg-[var(--surface)] px-4 font-semibold"
            >
              Try again
            </button>
          </div>
        )}

        {!listings && !error && (
          <div aria-busy="true" aria-label="Loading" className="mt-8 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl bg-[var(--sunk)]" />
              ))}
            </div>
            <div className="h-96 animate-pulse rounded-xl bg-[var(--sunk)]" />
          </div>
        )}

        {listings && towns && (
          <>
            <p className="mt-4 text-sm text-[var(--ink-2)]">
              Not sure which town?{" "}
              <Link href="/buying/towns" className="font-medium text-[var(--focus)] hover:underline">
                See the towns ranked by what matters to you →
              </Link>
            </p>

            {selectedTown && (
              <div className="mt-6">
                <TownPanel
                  town={selectedTown}
                  count={stats.find((s) => s.town.id === selectedTown.id)?.homes.length ?? 0}
                  onClear={() => set({ town: null })}
                />
              </div>
            )}

            <section className="mt-10" aria-labelledby="homes-heading">
              <h2 id="homes-heading" className="text-lg font-semibold text-[var(--ink)]">
                {selectedTown ? `Homes near ${selectedTown.station}` : "All homes"}
              </h2>

              <details className="group mt-3">
                <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-[var(--line-control)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--ink)] hover:bg-[var(--sunk)]">
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="text-[var(--ink-3)] transition-transform group-open:rotate-90">
                    <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Ranking by: <span className="font-semibold">{presetLabel(weights)}</span>
                  <span className="text-[var(--ink-3)]">· change what matters</span>
                </summary>
                <div className="mt-2">
                  <WeightsPanel weights={weights} onChange={setWeights} coverage={coverage} />
                  {f.sort !== "recommended" && (
                    <p className="mt-2 text-xs text-[var(--ink-3)]">
                      Sorted by &ldquo;{SORTS[f.sort]}&rdquo; right now.{" "}
                      <button type="button" onClick={() => set({ sort: "recommended" })} className="font-medium text-[var(--focus)] hover:underline">
                        Sort by these weights
                      </button>
                    </p>
                  )}
                </div>
              </details>

              {/* Search, sort and filters stay in view while scrolling the cards. */}
              <div className="sticky top-0 z-10 -mx-4 mt-2 border-b border-[var(--line)] bg-[var(--paper)]/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="relative min-w-[14rem] flex-1">
                    <span className="sr-only">Search homes</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)]">
                      <circle cx="7" cy="7" r="4.5" />
                      <path d="m10.5 10.5 3 3" strokeLinecap="round" />
                    </svg>
                    <input
                      type="search"
                      value={f.q}
                      onChange={(e) => set({ q: e.target.value })}
                      placeholder="Search street, postcode, agent or feature (e.g. balcony, parking)"
                      className="h-10 w-full rounded-full border border-[var(--line-control)] bg-[var(--surface)] pl-10 pr-4 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)]"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[var(--ink-2)]">
                    Sort
                    <select
                      value={f.sort}
                      onChange={(e) => set({ sort: e.target.value as Sort })}
                      className="h-10 rounded-full border border-[var(--line-control)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]"
                    >
                      {Object.entries(SORTS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
                  <select aria-label="Station town" value={f.town ?? ""} onChange={(e) => set({ town: e.target.value || null })} className={pill(!!f.town)}>
                    <option value="">Any town</option>
                    {[...stats]
                      .sort((a, b) => a.town.town.localeCompare(b.town.town))
                      .map((s) => (
                        <option key={s.town.id} value={s.town.id}>
                          {s.town.town} ({s.homes.length})
                        </option>
                      ))}
                  </select>
                  <select
                    aria-label="Maximum price"
                    value={f.maxPrice ?? ""}
                    onChange={(e) => set({ maxPrice: e.target.value ? Number(e.target.value) : null })}
                    className={pill(!!f.maxPrice)}
                  >
                    <option value="">Any price</option>
                    {PRICE_STEPS.map((p) => (
                      <option key={p} value={p}>
                        Up to {k(p)}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Maximum train time"
                    value={f.maxMins ?? ""}
                    onChange={(e) => set({ maxMins: e.target.value ? Number(e.target.value) : null })}
                    className={pill(!!f.maxMins)}
                  >
                    <option value="">Any train time</option>
                    {MIN_STEPS.map((m) => (
                      <option key={m} value={m}>
                        Train up to {m} min
                      </option>
                    ))}
                  </select>
                  <select aria-label="Type of home" value={f.kind} onChange={(e) => set({ kind: e.target.value as Kind })} className={pill(f.kind !== "any")}>
                    <option value="any">Houses and flats</option>
                    <option value="house">Houses only</option>
                    <option value="house-maisonette">Houses and maisonettes</option>
                    <option value="flat">Flats only</option>
                  </select>
                  <select
                    aria-label="Bedrooms"
                    value={f.beds ?? ""}
                    onChange={(e) => set({ beds: e.target.value ? Number(e.target.value) : null })}
                    className={pill(!!f.beds)}
                  >
                    <option value="">{BRIEF.minBeds}–{BRIEF.maxBeds} beds</option>
                    {Array.from({ length: BRIEF.maxBeds - BRIEF.minBeds + 1 }, (_, i) => BRIEF.minBeds + i).map((b) => (
                      <option key={b} value={b}>
                        {b} beds only
                      </option>
                    ))}
                  </select>
                  <select aria-label="New build or resale" value={f.build} onChange={(e) => set({ build: e.target.value as Build })} className={pill(f.build !== "any")}>
                    <option value="any">New and resale</option>
                    <option value="new">New build only</option>
                    <option value="resale">Resale only</option>
                  </select>
                  <button type="button" aria-pressed={f.garden} onClick={() => set({ garden: !f.garden })} title="Homes whose listing states a garden" className={pill(f.garden)}>
                    Garden
                  </button>
                  <button
                    type="button"
                    aria-pressed={f.hideBlocks}
                    onClick={() => set({ hideBlocks: !f.hideBlocks })}
                    title="Hide flats in modern blocks with lifts"
                    className={pill(f.hideBlocks)}
                  >
                    No new-build blocks
                  </button>
                  {newCount > 0 && (
                    <button type="button" aria-pressed={f.newOnly} onClick={() => set({ newOnly: !f.newOnly })} className={pill(f.newOnly)}>
                      New this pass ({newCount})
                    </button>
                  )}
                  <button type="button" aria-pressed={f.twoBaths} onClick={() => set({ twoBaths: !f.twoBaths })} className={pill(f.twoBaths)}>
                    2 bathrooms
                  </button>
                  <button
                    type="button"
                    aria-pressed={f.walkableOnly}
                    onClick={() => set({ walkableOnly: !f.walkableOnly })}
                    title={`Within about ${BRIEF.maxWalkMiles} mi (1.2 km). Homes with no stated distance stay in.`}
                    className={pill(f.walkableOnly)}
                  >
                    Short walk to station
                  </button>
                  <button type="button" aria-pressed={f.hideComingSoon} onClick={() => set({ hideComingSoon: !f.hideComingSoon })} className={pill(f.hideComingSoon)}>
                    On the market now
                  </button>
                  <button type="button" aria-pressed={f.savedOnly} onClick={() => set({ savedOnly: !f.savedOnly })} className={pill(f.savedOnly)}>
                    Saved{saved ? ` (${saved})` : ""}
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ink-3)]" aria-live="polite">
                  <span className="font-semibold text-[var(--ink)]">
                    {narrowed ? `${visible.length} of ${baseCount} homes` : `${visible.length} homes`}
                  </span>
                  {narrowed && (
                    <button type="button" onClick={clear} className="font-medium text-[var(--focus)] hover:underline">
                      Clear filters
                    </button>
                  )}
                  <span className="sm:ml-auto">{BRIEF.minBeds}–{BRIEF.maxBeds} bedrooms, up to £{BRIEF.maxPriceGbp / 1000}k. Lease and service charge come from the listing where stated.</span>
                </div>
              </div>

              {visible.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--line-control)] p-8 text-center">
                  <p className="mx-auto max-w-md text-sm text-[var(--ink-2)]">
                    {selectedTown && !stats.find((s) => s.town.id === selectedTown.id)?.homes.length
                      ? `Nothing captured near ${selectedTown.station} yet. The research panel above says what to try next.`
                      : "No homes match all of these filters."}
                  </p>
                  <button type="button" onClick={clear} className="mt-2 text-sm font-medium text-[var(--focus)] hover:underline">
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visible.slice(0, limit).map((l) => (
                    <HomeCard
                      key={l.id}
                      home={l}
                      townName={townById.get(l.townId)?.town ?? l.townId}
                      commute={STATIONS[l.townId] ? `${STATIONS[l.townId].mins} min to ${STATIONS[l.townId].terminus}` : null}
                      flags={flags.get(l.id) ?? []}
                      isNew={isNew(l)}
                      score={scoreOf.get(l.id) ?? null}
                      why={whyLine(explain(factors.get(l.id)!, weights, l))}
                      onPref={setPref}
                    />
                  ))}
                </div>
              )}

              {visible.length > limit && (
                <div className="mt-6 flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShown({ sig, n: limit + PAGE })}
                    className="h-10 rounded-full border border-[var(--line-control)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--sunk)]"
                  >
                    Show {Math.min(PAGE, visible.length - limit)} more
                  </button>
                  <span className="text-xs text-[var(--ink-3)]">
                    Showing {limit} of {visible.length}
                  </span>
                </div>
              )}

              {(f.hideDuplicates || !f.hideHidden) && (
                <div className="mt-4 flex flex-wrap gap-x-4 text-xs text-[var(--ink-3)]">
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input type="checkbox" checked={f.hideDuplicates} onChange={(e) => set({ hideDuplicates: e.target.checked })} />
                    Merge likely duplicates (same flat, two agents)
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input type="checkbox" checked={f.hideHidden} onChange={(e) => set({ hideHidden: e.target.checked })} />
                    Hide homes I&apos;ve hidden
                  </label>
                </div>
              )}
            </section>

          </>
        )}
      </div>
    </div>
  );
}
