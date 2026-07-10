"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FlatCard from "@/components/flats/FlatCard";
import CompactRow from "@/components/flats/CompactRow";
import FilterRail, { DEFAULT_FILTERS, type FilterState } from "@/components/flats/FilterRail";
import SummaryPanel from "@/components/flats/SummaryPanel";
import OperatorsPanel from "@/components/flats/OperatorsPanel";
import { compareListings, furnishingMatches, timingRank } from "@/lib/flat-search/view-logic";
import { buildView, type EnrichedListing } from "@/lib/flat-search/view-model";
import type { FlatConfig, Listing, Pref, Area } from "@/lib/flat-search/types";

type Tab = "summary" | "homes" | "operators";
type SortKey = "recommended" | "cheapest" | "newest" | "timed" | "listed";
type ViewMode = "gallery" | "compact";

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
  view: ViewMode;
  savedOnly: boolean;
  search: string;
  sort: SortKey;
  filters: FilterState;
}

// --- URL <-> state (so a refresh / shared link restores the exact view) ---
function readUI(): UIState {
  const base: UIState = {
    tab: "summary",
    view: "gallery",
    savedOnly: false,
    search: "",
    sort: "recommended",
    filters: { ...DEFAULT_FILTERS },
  };
  if (typeof window === "undefined") return base;
  const p = new URLSearchParams(window.location.search);
  const list = (k: string, fallback: string[]) => (p.has(k) ? (p.get(k) ? p.get(k)!.split(",") : []) : fallback);
  const bool = (k: string, fallback: boolean) => (p.has(k) ? p.get(k) === "1" : fallback);
  return {
    tab: (["summary", "homes", "operators"].includes(p.get("tab") || "") ? p.get("tab") : "summary") as Tab,
    view: (p.get("view") === "compact" ? "compact" : "gallery") as ViewMode,
    savedOnly: bool("saved", false),
    search: p.get("q") ?? "",
    sort: (Object.keys(SORT_LABELS).includes(p.get("sort") || "") ? p.get("sort") : "recommended") as SortKey,
    filters: {
      areas: list("areas", DEFAULT_FILTERS.areas),
      tiers: list("tiers", DEFAULT_FILTERS.tiers),
      schemes: list("schemes", DEFAULT_FILTERS.schemes),
      furnishing: list("furn", DEFAULT_FILTERS.furnishing),
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
  if (s.view !== "gallery") p.set("view", s.view);
  if (s.savedOnly) p.set("saved", "1");
  if (s.search) p.set("q", s.search);
  if (s.sort !== "recommended") p.set("sort", s.sort);
  if (f.areas.length) p.set("areas", f.areas.join(","));
  if (f.tiers.length) p.set("tiers", f.tiers.join(","));
  if (f.schemes.length) p.set("schemes", f.schemes.join(","));
  if (f.furnishing.length) p.set("furn", f.furnishing.join(","));
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

  const { tab, view: viewMode, savedOnly, search, sort, filters } = ui;
  const setTab = (t: Tab) => setUi((s) => ({ ...s, tab: t }));
  const setViewMode = (v: ViewMode) => setUi((s) => ({ ...s, view: v }));
  const setSavedOnly = (v: boolean) => setUi((s) => ({ ...s, savedOnly: v }));
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
        savedOnly: false,
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
      if (savedOnly && l.pref !== "want") return false;
      if (f.hideGone && l.status === "gone") return false;
      if (f.hideRejected && l.pref === "reject") return false;
      if (f.areas.length && !f.areas.includes(l.areaId)) return false;
      if (f.tiers.length) {
        const t = view.areaById[l.areaId]?.tier ?? "2";
        if (!f.tiers.includes(t === "anchor" ? "anchor" : t)) return false;
      }
      if (f.schemes.length && !f.schemes.includes(l.scheme)) return false;
      if (!furnishingMatches(l.furnishing, f.furnishing)) return false;
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
  }, [view, filters, search, sort, savedOnly, topPickIds, nowMs]);

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
  const savedCount = view.listings.filter((l) => l.pref === "want").length;

  // Active filters as individually-removable chips (clearer than a "3 filters" counter).
  const tierName = (t: string) => (t === "anchor" ? "Anchor" : `Tier ${t}`);
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (search.trim()) chips.push({ key: "q", label: `“${search.trim()}”`, onRemove: () => setSearch("") });
  for (const a of filters.areas)
    chips.push({ key: `area-${a}`, label: view.areaById[a]?.name ?? a, onRemove: () => setFilters({ ...filters, areas: filters.areas.filter((x) => x !== a) }) });
  for (const t of filters.tiers)
    chips.push({ key: `tier-${t}`, label: tierName(t), onRemove: () => setFilters({ ...filters, tiers: filters.tiers.filter((x) => x !== t) }) });
  for (const sc of filters.schemes)
    chips.push({ key: `scheme-${sc}`, label: sc === "btr" ? "BTR" : "Private", onRemove: () => setFilters({ ...filters, schemes: filters.schemes.filter((x) => x !== sc) }) });
  for (const fn of filters.furnishing)
    chips.push({ key: `furn-${fn}`, label: fn === "furnished" ? "Furnished" : fn === "unfurnished" ? "Unfurnished" : "Either", onRemove: () => setFilters({ ...filters, furnishing: filters.furnishing.filter((x) => x !== fn) }) });
  if (filters.bands.join(",") !== DEFAULT_FILTERS.bands.join(","))
    chips.push({
      key: "bands",
      label: `Budget: ${filters.bands.map((b) => (b === "in" ? "In" : b === "btr" ? "BTR" : "Over")).join(", ") || "none"}`,
      onRemove: () => setFilters({ ...filters, bands: [...DEFAULT_FILTERS.bands] }),
    });
  for (const op of filters.operators)
    chips.push({ key: `op-${op}`, label: `${filters.operatorMode === "exclude" ? "≠ " : ""}${op}`, onRemove: () => setFilters({ ...filters, operators: filters.operators.filter((x) => x !== op) }) });
  if (filters.wellTimedOnly) chips.push({ key: "wt", label: "Well-timed", onRemove: () => setFilters({ ...filters, wellTimedOnly: false }) });
  if (filters.newOnly) chips.push({ key: "new", label: "New this run", onRemove: () => setFilters({ ...filters, newOnly: false }) });
  if (filters.topPicksOnly) chips.push({ key: "picks", label: "Top picks", onRemove: () => setFilters({ ...filters, topPicksOnly: false }) });
  if (!filters.hideGone) chips.push({ key: "gone", label: "Incl. delisted", onRemove: () => setFilters({ ...filters, hideGone: true }) });
  if (filters.hideRejected) chips.push({ key: "hr", label: "Hiding rejected", onRemove: () => setFilters({ ...filters, hideRejected: false }) });
  if (savedOnly) chips.push({ key: "saved", label: "Saved only", onRemove: () => setSavedOnly(false) });

  const clearAll = () => {
    setSearch("");
    setSavedOnly(false);
    setFilters({ ...DEFAULT_FILTERS });
  };

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
                <button
                  onClick={() => setSavedOnly(!savedOnly)}
                  aria-pressed={savedOnly}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    savedOnly
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  {savedOnly ? "♥" : "♡"} Saved{savedCount ? ` ${savedCount}` : ""}
                </button>

                <div className="flex rounded-lg border border-[var(--border-primary)] p-0.5" role="group" aria-label="View mode">
                  {(["gallery", "compact"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setViewMode(m)}
                      aria-pressed={viewMode === m}
                      className={`rounded-md px-2.5 py-1.5 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                        viewMode === m ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
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

              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
                <span className="shrink-0">
                  <strong className="text-[var(--text-primary)]">{shownCount}</strong> shown
                </span>
                {chips.map((c) => (
                  <button
                    key={c.key}
                    onClick={c.onRemove}
                    aria-label={`Remove filter ${c.label}`}
                    className="group inline-flex items-center gap-1 rounded-full bg-[var(--bg-tertiary)] py-1 pl-2.5 pr-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    {c.label}
                    <span className="text-[var(--text-muted)] group-hover:text-[var(--status-no)]">✕</span>
                  </button>
                ))}
                {chips.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {grouped.length === 0 ? (
                <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-8 text-center text-[var(--text-secondary)]">
                  {savedOnly ? "No saved homes yet — tap ♡ on a listing to save it." : "No flats match these filters."}
                </div>
              ) : (
                <div className="space-y-7">
                  {grouped.map((g) => {
                    const tierDot =
                      g.area.tier === "anchor" ? "var(--accent)" : g.area.tier === "1" ? "var(--status-info)" : "var(--text-muted)";
                    const setCardRef = (id: string) => (el: HTMLDivElement | null) => {
                      if (el) cardRefs.current.set(id, el);
                      else cardRefs.current.delete(id);
                    };
                    return (
                      <section key={g.area.id} aria-label={g.area.name}>
                        <div className="mb-2.5 flex items-baseline gap-2">
                          <span
                            className="inline-block h-2 w-2 shrink-0 self-center rounded-full"
                            style={{ backgroundColor: tierDot }}
                            aria-hidden
                          />
                          <h2 className="text-base font-semibold text-[var(--text-primary)]">{g.area.name}</h2>
                          <span className="text-xs text-[var(--text-secondary)]">
                            {g.area.tier === "anchor" ? "Anchor" : `Tier ${g.area.tier}`} · {g.listings.length}
                          </span>
                        </div>
                        {viewMode === "gallery" ? (
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {g.listings.map((l) => (
                              <FlatCard
                                key={l.id}
                                listing={l}
                                areaName={g.area.name}
                                onPref={setPref}
                                highlighted={l.id === focusId}
                                cardRef={setCardRef(l.id)}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {g.listings.map((l) => (
                              <CompactRow
                                key={l.id}
                                listing={l}
                                onPref={setPref}
                                highlighted={l.id === focusId}
                                cardRef={setCardRef(l.id)}
                              />
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
