"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HomeCard from "@/components/homes/HomeCard";
import TownPanel from "@/components/homes/TownPanel";
import WhereToBuy, { townStats } from "@/components/homes/WhereToBuy";
import { duplicateGroups, flagsFor, type Flag } from "@/lib/homes/flags";
import { STATIONS } from "@/lib/homes/stations";
import { BRIEF, type BuyTown, type HomeListing, type Pref } from "@/lib/homes/types";

// Buying a home: 2-bed homes for sale near commuter stations.
//
// The page answers, in order: what are the standout options (three answers),
// where are they and how long is the train (the map and ranked list), and
// which homes fit me (search, sort and filters in plain sight above the
// cards — not tucked in a drawer). Research gaps stay visible but out of the way.

type Sort = "price" | "price-desc" | "commute" | "distance" | "size" | "recent";
const SORTS: Record<Sort, string> = {
  price: "Cheapest first",
  "price-desc": "Most expensive first",
  commute: "Shortest train to London",
  distance: "Closest to the station",
  size: "Biggest first (where stated)",
  recent: "Newest listing",
};

type Kind = "any" | "flat" | "house";
type Build = "any" | "new" | "resale";

interface Filters {
  q: string;
  town: string | null;
  maxPrice: number | null;
  maxMins: number | null;
  kind: Kind;
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
  twoBaths: false,
  build: "any",
  walkableOnly: false,
  hideDuplicates: true,
  hideComingSoon: false,
  hideHidden: true,
  savedOnly: false,
  sort: "price",
};

const PRICE_STEPS = [250_000, 300_000, 350_000, 400_000];
const MIN_STEPS = [20, 25, 30, 35, 40];
// Building names ("Apartment (Leon House)") sit in brackets, so drop them first.
const isHouse = (l: HomeListing) => /\bhouse\b|terrace|bungalow|cottage/i.test((l.propertyType ?? "").replace(/\(.*\)/g, ""));
const k = (p: number) => `£${Math.round(p / 1000)}k`;
const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const pill = (active: boolean) =>
  `h-9 shrink-0 rounded-full border px-3 text-sm transition-colors ${
    active
      ? "border-[var(--focus)] bg-[var(--focus-wash)] font-semibold text-[var(--ink)]"
      : "border-[var(--line-control)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--sunk)]"
  }`;

function Pick({ label, title, detail, onClick }: { label: string; title: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-left transition-colors hover:border-[var(--line-control)]"
    >
      <span className="text-xs font-medium text-[var(--ink-3)]">{label}</span>
      <span className="mt-1 text-xl font-bold tracking-[-0.015em] text-[var(--ink)]">{title}</span>
      <span className="mt-0.5 text-sm text-[var(--ink-2)]">{detail}</span>
      <span className="mt-2 text-xs font-medium text-[var(--focus)] group-hover:underline">See these homes</span>
    </button>
  );
}

export default function BuyingPage() {
  const [towns, setTowns] = useState<BuyTown[] | null>(null);
  const [listings, setListings] = useState<HomeListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [f, setF] = useState<Filters>(DEFAULTS);
  const scroller = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Choosing a town from the chart brings its panel into view — otherwise the
  // response to the click can land below the fold and look like nothing happened.
  function chooseTown(town: string | null) {
    setF((prev) => ({ ...prev, town }));
    if (!town) return;
    requestAnimationFrame(() => {
      const box = scroller.current;
      const target = panel.current;
      if (!box || !target) return;
      const top = target.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 16;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      box.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    });
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/homes")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { towns: BuyTown[]; listings: HomeListing[] }) => {
        if (cancelled) return;
        setTowns(d.towns);
        setListings(d.listings);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const setPref = useCallback(async (id: string, pref: Pref | null) => {
    setListings((prev) => prev?.map((l) => (l.id === id ? { ...l, pref } : l)) ?? prev);
    try {
      await fetch("/api/homes/pref", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: id, pref }),
      });
    } catch {
      // the optimistic value stands until reload
    }
  }, []);

  const all = useMemo(() => listings ?? [], [listings]);
  const townById = useMemo(() => new Map((towns ?? []).map((t) => [t.id, t])), [towns]);
  const dupes = useMemo(() => duplicateGroups(all), [all]);
  const flags = useMemo(() => {
    const m = new Map<string, Flag[]>();
    for (const l of all) m.set(l.id, flagsFor(l, { duplicates: dupes.get(l.id) }));
    return m;
  }, [all, dupes]);

  // A duplicate group shows one card: the one with the most photos, then the lowest id.
  const hiddenDupes = useMemo(() => {
    const hide = new Set<string>();
    for (const [id, others] of dupes) {
      const group = [id, ...others].map((x) => all.find((l) => l.id === x)!).filter(Boolean);
      group.sort((a, b) => b.photos.length - a.photos.length || a.id.localeCompare(b.id));
      group.slice(1).forEach((l) => hide.add(l.id));
    }
    return hide;
  }, [dupes, all]);


  // Homes that are "live" for the overview: not hidden, not a duplicate copy.
  const live = useMemo(() => all.filter((l) => l.pref !== "reject" && !hiddenDupes.has(l.id)), [all, hiddenDupes]);
  const stats = useMemo(() => townStats(towns ?? [], live), [towns, live]);
  const minsOf = useCallback((l: HomeListing) => STATIONS[l.townId]?.mins ?? null, []);

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
      if (f.kind === "house" && !isHouse(l)) return false;
      if (f.kind === "flat" && isHouse(l)) return false;
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
    const by: Record<Sort, (a: HomeListing, b: HomeListing) => number> = {
      price: (a, b) => a.priceGbp - b.priceGbp,
      "price-desc": (a, b) => b.priceGbp - a.priceGbp,
      commute: (a, b) => (minsOf(a) ?? 99) - (minsOf(b) ?? 99) || a.priceGbp - b.priceGbp,
      distance: (a, b) => (a.distanceMiles ?? 9) - (b.distanceMiles ?? 9) || a.priceGbp - b.priceGbp,
      size: (a, b) => (b.floorAreaSqFt ?? 0) - (a.floorAreaSqFt ?? 0) || a.priceGbp - b.priceGbp,
      recent: (a, b) => (b.listedOn ?? "").localeCompare(a.listedOn ?? ""),
    };
    return out.sort(by[f.sort]);
  }, [all, f, hiddenDupes, minsOf, townById]);

  const withStock = stats.filter((s) => s.homes.length > 0);
  const quickest = [...withStock].sort((a, b) => (a.mins ?? 99) - (b.mins ?? 99) || a.from! - b.from!)[0];
  const cheapest = [...withStock].sort((a, b) => a.from! - b.from!)[0];
  const most = [...withStock].sort((a, b) => b.homes.length - a.homes.length)[0];
  const checked = all.reduce<string | null>((m, l) => (!m || l.lastSeenAt > m ? l.lastSeenAt : m), null);
  const saved = all.filter((l) => l.pref === "want").length;
  const selectedTown = f.town ? townById.get(f.town) : undefined;
  const toDo = stats.filter((s) => s.town.nextAction).sort((a, b) => a.town.town.localeCompare(b.town.town));
  const baseCount = all.filter((l) => !(f.hideDuplicates && hiddenDupes.has(l.id)) && !(f.hideHidden && l.pref === "reject")).length;
  const narrowed =
    !!f.q || !!f.town || !!f.maxPrice || !!f.maxMins || f.kind !== "any" || f.twoBaths || f.build !== "any" || f.walkableOnly || f.savedOnly || f.hideComingSoon;
  const set = (patch: Partial<Filters>) => setF((prev) => ({ ...prev, ...patch }));
  const clear = () => setF((prev) => ({ ...DEFAULTS, sort: prev.sort }));

  return (
    <div ref={scroller} className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1200px] px-4 pb-24 pt-6 sm:px-8 lg:pb-12">
        <header>
          <p className="text-sm text-[var(--ink-3)]">Buying · 2-bed homes near commuter stations</p>
          <h1 className="mt-1 max-w-[24ch] text-3xl font-bold leading-tight tracking-[-0.025em] text-[var(--ink)] sm:text-4xl">
            Where a 2-bed near a good station is affordable
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
              onClick={() => {
                setError(null);
                setAttempt((n) => n + 1);
              }}
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
            {withStock.length > 0 && (
              <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Standout options">
                <Pick
                  label="Quickest train"
                  title={`${quickest.town.town}, ${quickest.mins} min`}
                  detail={`To ${quickest.terminus}. ${quickest.homes.length} homes from ${k(quickest.from!)}`}
                  onClick={() => chooseTown(quickest.town.id)}
                />
                <Pick
                  label="Lowest prices"
                  title={`${cheapest.town.town}, from ${k(cheapest.from!)}`}
                  detail={`${cheapest.mins} min to ${cheapest.terminus}. Typical ${k(cheapest.median!)}`}
                  onClick={() => chooseTown(cheapest.town.id)}
                />
                <Pick
                  label="Most choice"
                  title={`${most.town.town}, ${most.homes.length} homes`}
                  detail={`${most.mins} min to ${most.terminus}. From ${k(most.from!)}`}
                  onClick={() => chooseTown(most.town.id)}
                />
              </section>
            )}

            <section className="mt-8" aria-labelledby="where-heading">
              <h2 id="where-heading" className="mb-3 text-lg font-semibold text-[var(--ink)]">
                Price against train time
              </h2>
              <WhereToBuy stats={stats} selected={f.town} onSelect={chooseTown} />
            </section>

            <div ref={panel} />
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
                {selectedTown ? `Homes near ${selectedTown.station}` : "Homes for sale"}
              </h2>

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
                    <option value="any">Flats and houses</option>
                    <option value="flat">Flats only</option>
                    <option value="house">Houses only</option>
                  </select>
                  <select aria-label="New build or resale" value={f.build} onChange={(e) => set({ build: e.target.value as Build })} className={pill(f.build !== "any")}>
                    <option value="any">New and resale</option>
                    <option value="new">New build only</option>
                    <option value="resale">Resale only</option>
                  </select>
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
                  <span className="sm:ml-auto">All are 2-bedroom (the brief). Lease and service charge aren&apos;t captured yet: check each listing.</span>
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
                  {visible.map((l) => (
                    <HomeCard
                      key={l.id}
                      home={l}
                      townName={townById.get(l.townId)?.town ?? l.townId}
                      commute={STATIONS[l.townId] ? `${STATIONS[l.townId].mins} min to ${STATIONS[l.townId].terminus}` : null}
                      flags={flags.get(l.id) ?? []}
                      onPref={setPref}
                    />
                  ))}
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

            {!selectedTown && toDo.length > 0 && (
              <details className="group mt-12 rounded-xl bg-[var(--surface)] p-5">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-lg font-semibold text-[var(--ink)]">
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="text-[var(--ink-3)] transition-transform group-open:rotate-90">
                    <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Research for the next pass
                  <span className="text-sm font-normal text-[var(--ink-3)]">· {toDo.length} towns</span>
                </summary>
                <ul className="mt-3 divide-y divide-[var(--line)]">
                  {toDo.map(({ town, homes }) => (
                    <li key={town.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-sm">
                      <button type="button" onClick={() => chooseTown(town.id)} className="w-32 shrink-0 text-left font-semibold text-[var(--ink)] hover:underline">
                        {town.town}
                      </button>
                      <span className="w-16 shrink-0 text-xs text-[var(--ink-3)]">{homes.length ? `${homes.length} homes` : "empty"}</span>
                      <span className="min-w-0 flex-1 text-[var(--ink-2)]">
                        {town.policy ? <span className="font-medium text-[var(--warn)]">Decide: </span> : null}
                        {town.nextAction}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
