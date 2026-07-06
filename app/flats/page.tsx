"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FlatCard from "@/components/flats/FlatCard";
import FilterRail, { DEFAULT_FILTERS, type FilterState } from "@/components/flats/FilterRail";
import SummaryPanel from "@/components/flats/SummaryPanel";
import OperatorsPanel from "@/components/flats/OperatorsPanel";
import { compareListings, timingRank } from "@/lib/flat-search/view-logic";
import { buildView, type EnrichedListing } from "@/lib/flat-search/view-model";
import type { FlatConfig, Listing, Pref, Area } from "@/lib/flat-search/types";

type Tab = "summary" | "homes" | "operators";
type SortKey = "recommended" | "cheapest" | "newest" | "timed" | "listed";

const SORT_LABELS: Record<SortKey, string> = {
  recommended: "Recommended",
  cheapest: "Cheapest first",
  newest: "Newest block",
  timed: "Best-timed",
  listed: "Recently listed",
};

interface StoreResponse {
  areas: Area[];
  listings: Listing[];
  config: FlatConfig;
}

interface UIState {
  tab: Tab;
  search: string;
  sort: SortKey;
  filters: FilterState;
}

// --- URL <-> state (so a refresh / shared link restores the exact view) ---
function readUI(): UIState {
  const base: UIState = { tab: "summary", search: "", sort: "recommended", filters: { ...DEFAULT_FILTERS } };
  if (typeof window === "undefined") return base;
  const p = new URLSearchParams(window.location.search);
  const list = (k: string, fallback: string[]) => (p.has(k) ? (p.get(k) ? p.get(k)!.split(",") : []) : fallback);
  const bool = (k: string, fallback: boolean) => (p.has(k) ? p.get(k) === "1" : fallback);
  return {
    tab: (["summary", "homes", "operators"].includes(p.get("tab") || "") ? p.get("tab") : "summary") as Tab,
    search: p.get("q") ?? "",
    sort: (Object.keys(SORT_LABELS).includes(p.get("sort") || "") ? p.get("sort") : "recommended") as SortKey,
    filters: {
      areas: list("areas", DEFAULT_FILTERS.areas),
      tiers: list("tiers", DEFAULT_FILTERS.tiers),
      schemes: list("schemes", DEFAULT_FILTERS.schemes),
      bands: list("bands", DEFAULT_FILTERS.bands),
      operators: list("ops", DEFAULT_FILTERS.operators),
      operatorMode: (p.get("opmode") === "exclude" ? "exclude" : "include") as FilterState["operatorMode"],
      wellTimedOnly: bool("timed1", DEFAULT_FILTERS.wellTimedOnly),
      newOnly: bool("new", DEFAULT_FILTERS.newOnly),
      topPicksOnly: bool("picks", DEFAULT_FILTERS.topPicksOnly),
      hideGone: bool("hideGone", DEFAULT_FILTERS.hideGone),
      hideRejected: bool("hideRej", DEFAULT_FILTERS.hideRejected),
    },
  };
}

function writeUI(s: UIState) {
  if (typeof window === "undefined") return;
  const p = new URLSearchParams();
  const f = s.filters;
  if (s.tab !== "summary") p.set("tab", s.tab);
  if (s.search) p.set("q", s.search);
  if (s.sort !== "recommended") p.set("sort", s.sort);
  if (f.areas.length) p.set("areas", f.areas.join(","));
  if (f.tiers.length) p.set("tiers", f.tiers.join(","));
  if (f.schemes.length) p.set("schemes", f.schemes.join(","));
  if (f.bands.join(",") !== DEFAULT_FILTERS.bands.join(",")) p.set("bands", f.bands.join(",") || "none");
  if (f.operators.length) {
    p.set("ops", f.operators.join(","));
    if (f.operatorMode === "exclude") p.set("opmode", "exclude");
  }
  if (f.wellTimedOnly) p.set("timed1", "1");
  if (f.newOnly) p.set("new", "1");
  if (f.topPicksOnly) p.set("picks", "1");
  if (!f.hideGone) p.set("hideGone", "0");
  if (f.hideRejected) p.set("hideRej", "1");
  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
}

export default function FlatsPage() {
  const [store, setStore] = useState<StoreResponse | null>(null);
  const [ui, setUi] = useState<UIState>(() => readUI());
  const [nowMs] = useState(() => Date.now());
  const [focusId, setFocusId] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  const { tab, search, sort, filters } = ui;
  const setTab = (t: Tab) => setUi((s) => ({ ...s, tab: t }));
  const setSearch = (v: string) => setUi((s) => ({ ...s, search: v }));
  const setSort = (v: SortKey) => setUi((s) => ({ ...s, sort: v }));
  const setFilters = (f: FilterState) => setUi((s) => ({ ...s, filters: f }));

  useEffect(() => {
    fetch("/api/flats")
      .then((r) => r.json())
      .then(setStore);
  }, []);

  useEffect(() => writeUI(ui), [ui]);

  const view = useMemo(() => (store ? buildView(store, nowMs) : null), [store, nowMs]);

  const setPref = useCallback((id: string, pref: Pref | null) => {
    setStore((prev) =>
      prev ? { ...prev, listings: prev.listings.map((l) => (l.id === id ? { ...l, pref } : l)) } : prev,
    );
    fetch("/api/flats/pref", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: id, pref }),
    }).catch(() => {});
  }, []);

  // Open a specific listing in Homes: relax filters so it's visible, switch tab, then scroll+highlight.
  const openListing = useCallback(
    (l: EnrichedListing) => {
      setUi((s) => ({
        ...s,
        tab: "homes",
        search: "",
        filters: {
          ...DEFAULT_FILTERS,
          bands: DEFAULT_FILTERS.bands.includes(l.budgetTier) ? DEFAULT_FILTERS.bands : [...DEFAULT_FILTERS.bands, l.budgetTier],
          hideGone: l.status !== "gone",
        },
      }));
      setFocusId(l.id);
    },
    [],
  );

  const operators = useMemo(() => {
    if (!store) return [];
    return [...new Set(store.listings.filter((l) => l.scheme === "btr" && l.operator).map((l) => l.operator!))].sort();
  }, [store]);

  const topPickIds = useMemo(() => {
    if (!view) return new Set<string>();
    const ids = new Set<string>();
    for (const p of view.picks) {
      if (p.newest) ids.add(p.newest.id);
      if (p.wellTimed) ids.add(p.wellTimed.id);
    }
    return ids;
  }, [view]);

  const grouped = useMemo(() => {
    if (!view) return [];
    const f = filters;
    const q = search.trim().toLowerCase();
    const kept = view.listings.filter((l) => {
      if (f.hideGone && l.status === "gone") return false;
      if (f.hideRejected && l.pref === "reject") return false;
      if (f.areas.length && !f.areas.includes(l.areaId)) return false;
      if (f.tiers.length) {
        const t = view.areaById[l.areaId]?.tier ?? "2";
        if (!f.tiers.includes(t === "anchor" ? "anchor" : t)) return false;
      }
      if (f.schemes.length && !f.schemes.includes(l.scheme)) return false;
      if (f.bands.length && !f.bands.includes(l.budgetTier)) return false;
      if (f.operators.length) {
        const has = !!l.operator && f.operators.includes(l.operator);
        if (f.operatorMode === "include" ? !has : has) return false;
      }
      if (f.newOnly && !l.isNew) return false;
      if (f.wellTimedOnly && l.timingFit !== "ideal" && l.timingFit !== "workable") return false;
      if (f.topPicksOnly && !topPickIds.has(l.id)) return false;
      if (q) {
        const hay = `${l.building} ${l.street ?? ""} ${view.areaById[l.areaId]?.name ?? ""} ${l.operator ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const timingCtx = { floorMs: view.floorMs, moveTiming: view.config.moveTiming, nowMs };
    const wantRank = (l: EnrichedListing) => (l.pref === "want" ? 0 : l.pref === "reject" ? 2 : 1);
    const parseDate = (d: string | null) => (d ? Date.parse(d + "T00:00:00Z") : 0);
    const within = (a: EnrichedListing, b: EnrichedListing) => {
      switch (sort) {
        case "cheapest":
          return a.price - b.price;
        case "newest":
          return (b.phaseYear ?? 0) - (a.phaseYear ?? 0) || a.price - b.price;
        case "timed":
          return timingRank(a.timingFit) - timingRank(b.timingFit) || a.price - b.price;
        case "listed":
          return parseDate(b.listedDate) - parseDate(a.listedDate) || a.price - b.price;
        default:
          return compareListings(a, b, view.areaById, timingCtx);
      }
    };
    kept.sort((a, b) => wantRank(a) - wantRank(b) || within(a, b));

    return view.areas
      .map((area) => ({ area, listings: kept.filter((l) => l.areaId === area.id) }))
      .filter((g) => g.listings.length > 0);
  }, [view, filters, search, sort, topPickIds, nowMs]);

  // Scroll to + highlight a listing opened from the Summary picks.
  useEffect(() => {
    if (!focusId || tab !== "homes") return;
    const el = cardRefs.current.get(focusId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setFocusId(null), 2600);
    return () => clearTimeout(t);
  }, [focusId, tab, grouped]);

  if (!view) {
    return (
      <div className="p-6 text-[var(--text-secondary)]" role="status" aria-live="polite">
        Loading flat search…
      </div>
    );
  }

  const shownCount = grouped.reduce((n, g) => n + g.listings.length, 0);
  const activeFilterCount =
    filters.areas.length +
    filters.tiers.length +
    filters.schemes.length +
    filters.operators.length +
    (filters.bands.join(",") !== DEFAULT_FILTERS.bands.join(",") ? 1 : 0) +
    [filters.wellTimedOnly, filters.newOnly, filters.topPicksOnly, !filters.hideGone, filters.hideRejected].filter(Boolean)
      .length +
    (search.trim() ? 1 : 0);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--border-primary)] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">🔑 Flat search</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {view.counts.active} active · {view.counts.isNew} new · last run {view.config.lastRun ?? "—"}
            </p>
          </div>
          <nav className="flex gap-1 rounded-lg bg-[var(--bg-secondary)] p-1" aria-label="Flat search views">
            {(["summary", "homes", "operators"] as const).map((t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  tab === t
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        {tab === "summary" && (
          <div className="p-6">
            <SummaryPanel view={view} onOpenListing={openListing} onBrowse={() => setTab("homes")} />
          </div>
        )}

        {tab === "operators" && (
          <div className="p-6">
            <OperatorsPanel view={view} />
          </div>
        )}

        {tab === "homes" && (
          <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start">
            <aside className="shrink-0 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6.5rem)] lg:w-56 lg:overflow-y-auto">
              <FilterRail areas={view.areas} operators={operators} filters={filters} onChange={setFilters} />
            </aside>

            <div className="flex-1">
              {/* Search + sort toolbar */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[12rem]">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search building, area, street or operator…"
                    aria-label="Search flats"
                    className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 pr-8 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <label className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                  <span className="sr-only sm:not-sr-only">Sort</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    aria-label="Sort flats"
                    className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-2 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                      <option key={k} value={k}>
                        {SORT_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mb-3 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <span>
                  <strong className="text-[var(--text-primary)]">{shownCount}</strong> shown
                </span>
                {activeFilterCount > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} active</span>
                    <button
                      onClick={() => {
                        setSearch("");
                        setFilters({ ...DEFAULT_FILTERS });
                      }}
                      className="rounded px-1.5 py-0.5 text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      Clear all
                    </button>
                  </>
                )}
              </div>

              {grouped.length === 0 ? (
                <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-8 text-center text-[var(--text-secondary)]">
                  No flats match these filters.
                </div>
              ) : (
                <div className="space-y-6">
                  {grouped.map((g) => (
                    <section key={g.area.id} aria-label={g.area.name}>
                      <div className="mb-2 flex items-baseline gap-2">
                        <h2 className="text-sm font-bold text-[var(--text-primary)]">{g.area.name}</h2>
                        <span className="text-xs text-[var(--text-secondary)]">
                          {g.area.tier === "anchor" ? "Anchor" : `Tier ${g.area.tier}`} · {g.listings.length}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {g.listings.map((l) => (
                          <FlatCard
                            key={l.id}
                            listing={l}
                            areaName={g.area.name}
                            onPref={setPref}
                            highlighted={l.id === focusId}
                            cardRef={(el) => {
                              if (el) cardRefs.current.set(l.id, el);
                              else cardRefs.current.delete(l.id);
                            }}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
