"use client";

import FilterPanel from "@/components/FilterPanel";
import { useCallback, useEffect, useMemo, useState } from "react";
import SofaBedCard from "@/components/sofabeds/SofaBedCard";
import SofaBedDetail from "@/components/sofabeds/SofaBedDetail";
import SofaBedFilterRail, {
  DEFAULT_SOFABED_FILTERS,
  type SofaBedFilterState,
} from "@/components/sofabeds/SofaBedFilterRail";
import { bedWidthOf, bodyDepthOf } from "@/lib/sofabeds/fit";
import { scoreAll, type ScoredSofaBed } from "@/lib/sofabeds/score";
import {
  BUDGET_CAP_GBP, FULL_DOUBLE_WIDTH_CM, MIN_BED_WIDTH_CM, type Mechanism, type Pref, type SofaBed,
} from "@/lib/sofabeds/types";

type SortKey = SofaBedFilterState["sort"];

const SORT_LABELS: Record<SortKey, string> = {
  score: "Recommended",
  price: "Cheapest landed",
  depth: "Deepest to sit in",
  bed: "Biggest bed",
};

const MECHANISMS: Mechanism[] = ["fold-out", "pull-out", "click-clack", "futon"];

interface UIState {
  search: string;
  savedOnly: boolean;
  filters: SofaBedFilterState;
}

// --- URL <-> state, so a refresh or a shared link restores the exact view ---
function readUI(): UIState {
  const base: UIState = { search: "", savedOnly: false, filters: { ...DEFAULT_SOFABED_FILTERS } };
  if (typeof window === "undefined") return base;
  const p = new URLSearchParams(window.location.search);
  const list = (k: string, fb: string[]) => (p.has(k) ? (p.get(k) ? p.get(k)!.split(",") : []) : fb);
  const bool = (k: string, fb: boolean) => (p.has(k) ? p.get(k) === "1" : fb);
  const one = <T extends string>(k: string, allowed: readonly T[], fb: T): T =>
    (allowed as readonly string[]).includes(p.get(k) ?? "") ? (p.get(k) as T) : fb;
  const mechanism = (p.get("mech") ? p.get("mech")!.split(",") : []).filter((m): m is Mechanism =>
    (MECHANISMS as string[]).includes(m),
  );
  return {
    search: p.get("q") ?? "",
    savedOnly: bool("saved", false),
    filters: {
      retailer: p.get("ret") ?? DEFAULT_SOFABED_FILTERS.retailer,
      condition: list("cond", DEFAULT_SOFABED_FILTERS.condition),
      fit: one("fit", ["all", "pass"] as const, DEFAULT_SOFABED_FILTERS.fit),
      budget: one("budget", ["all", "in"] as const, DEFAULT_SOFABED_FILTERS.budget),
      mechanism,
      separateMattressOnly: bool("sep", DEFAULT_SOFABED_FILTERS.separateMattressOnly),
      bedSize: one("bed", ["all", "small-double", "double"] as const, DEFAULT_SOFABED_FILTERS.bedSize),
      beddingStorage: bool("store", DEFAULT_SOFABED_FILTERS.beddingStorage),
      hideSoldOut: bool("stock", DEFAULT_SOFABED_FILTERS.hideSoldOut),
      hideRejected: bool("hide", DEFAULT_SOFABED_FILTERS.hideRejected),
      sort: one("sort", Object.keys(SORT_LABELS) as SortKey[], DEFAULT_SOFABED_FILTERS.sort),
    },
  };
}

function writeUI(s: UIState) {
  if (typeof window === "undefined") return;
  const p = new URLSearchParams();
  const f = s.filters;
  if (s.search) p.set("q", s.search);
  if (s.savedOnly) p.set("saved", "1");
  if (f.retailer) p.set("ret", f.retailer);
  if (f.condition.length) p.set("cond", f.condition.join(","));
  if (f.fit !== DEFAULT_SOFABED_FILTERS.fit) p.set("fit", f.fit);
  if (f.budget !== DEFAULT_SOFABED_FILTERS.budget) p.set("budget", f.budget);
  if (f.mechanism.length) p.set("mech", f.mechanism.join(","));
  if (f.separateMattressOnly) p.set("sep", "1");
  if (f.bedSize !== DEFAULT_SOFABED_FILTERS.bedSize) p.set("bed", f.bedSize);
  if (f.beddingStorage) p.set("store", "1");
  if (f.hideSoldOut !== DEFAULT_SOFABED_FILTERS.hideSoldOut) p.set("stock", f.hideSoldOut ? "1" : "0");
  if (f.hideRejected !== DEFAULT_SOFABED_FILTERS.hideRejected) p.set("hide", f.hideRejected ? "1" : "0");
  if (f.sort !== DEFAULT_SOFABED_FILTERS.sort) p.set("sort", f.sort);
  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

const FIT_RANK: Record<string, number> = { pass: 0, unknown: 1, fail: 2 };

/** Is the user looking at the whole corpus?
 *
 *  Gates the empty state. "Nothing meets all three gates" is a finding about
 *  the corpus at this budget, and it is only true when nothing has been
 *  narrowed — said over a one-retailer view it would be a claim about the
 *  research that the research never made. Sort is excluded deliberately: it
 *  reorders rows, it never removes one. */
function isUnfiltered(ui: UIState): boolean {
  const f = ui.filters;
  const d = DEFAULT_SOFABED_FILTERS;
  return (
    !ui.search.trim() &&
    !ui.savedOnly &&
    f.retailer === d.retailer &&
    f.condition.length === 0 &&
    f.fit === d.fit &&
    f.budget === d.budget &&
    f.mechanism.length === 0 &&
    f.separateMattressOnly === d.separateMattressOnly &&
    f.bedSize === d.bedSize &&
    f.beddingStorage === d.beddingStorage &&
    f.hideSoldOut === d.hideSoldOut &&
    f.hideRejected === d.hideRejected
  );
}

export default function SofaBedsPage() {
  const [sofaBeds, setSofaBeds] = useState<SofaBed[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ui, setUi] = useState<UIState>(() => readUI());
  const [detail, setDetail] = useState<ScoredSofaBed | null>(null);

  useEffect(() => writeUI(ui), [ui]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sofa-beds")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { sofaBeds: SofaBed[] }) => !cancelled && setSofaBeds(d.sofaBeds))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, []);

  const setPref = useCallback(async (id: string, pref: Pref | null) => {
    setSofaBeds((prev) => prev?.map((s) => (s.id === id ? { ...s, pref } : s)) ?? prev);
    try {
      await fetch("/api/sofa-beds/pref", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sofaBedId: id, pref }),
      });
    } catch { /* optimistic value stands */ }
  }, []);

  const scored = useMemo(() => (sofaBeds ? scoreAll(sofaBeds) : []), [sofaBeds]);
  const retailers = useMemo(() => [...new Set(scored.map((s) => s.retailer))].sort(), [scored]);
  const conditions = useMemo(() => [...new Set(scored.map((s) => s.condition))].sort(), [scored]);

  const visible = useMemo(() => {
    const f = ui.filters;
    const q = ui.search.trim().toLowerCase();
    const out = scored.filter((s) => {
      if (f.hideRejected && s.pref === "reject") return false;
      // Availability, not quality — a sofa bed you can't buy is excluded
      // outright rather than marked down, however well it scores. Null means
      // the retailer published nothing, which is not the same as sold out.
      if (f.hideSoldOut && s.inStock === false) return false;
      if (ui.savedOnly && s.pref !== "want") return false;
      // Over budget is a flag on the card, not a deletion — most of this corpus
      // is over £1,200 and hiding it by default would answer the wrong question.
      //
      // Deliberately looser than the home page's "fits" COUNT, which requires
      // budgetVerdict(s) === "in". A count asserts, so it may only count what
      // is known; a filter is a lens, so a row whose delivery is unpublished
      // stays IN — dropping it would make "unpublished" read as "unsuitable",
      // which spec §8 forbids. The card carries the caveat instead.
      if (f.budget === "in" && s.landedCostGbp > BUDGET_CAP_GBP) return false;
      if (f.fit === "pass" && s.fit.overall !== "pass") return false;
      if (f.mechanism.length && (s.mechanism == null || !f.mechanism.includes(s.mechanism))) return false;
      // Tri-state, and only `true` passes. An unclear listing is not a promise.
      if (f.separateMattressOnly && s.separateMattress !== true) return false;
      // A blank bed width never passes as a big bed — asking for a double means
      // you need the evidence, not the benefit of the doubt. bedWidthOf() also
      // returns null for a figure that is really a bed length.
      if (f.bedSize !== "all") {
        const w = bedWidthOf(s);
        const floor = f.bedSize === "double" ? FULL_DOUBLE_WIDTH_CM : MIN_BED_WIDTH_CM;
        if (w == null || w < floor) return false;
      }
      if (f.beddingStorage && s.beddingStorage !== true) return false;
      if (f.condition.length && !f.condition.includes(s.condition)) return false;
      if (f.retailer && s.retailer !== f.retailer) return false;
      if (q && !`${s.retailer} ${s.brand} ${s.model} ${s.mechanism ?? ""} ${s.fabric ?? ""}`.toLowerCase().includes(q))
        return false;
      return true;
    });

    const by: Record<SortKey, (a: ScoredSofaBed, b: ScoredSofaBed) => number> = {
      score: (a, b) =>
        FIT_RANK[a.fit.overall] - FIT_RANK[b.fit.overall] || b.score - a.score || a.landedCostGbp - b.landedCostGbp,
      price: (a, b) => a.landedCostGbp - b.landedCostGbp,
      depth: (a, b) => (bodyDepthOf(b) ?? -1) - (bodyDepthOf(a) ?? -1) || b.score - a.score,
      bed: (a, b) => (bedWidthOf(b) ?? -1) - (bedWidthOf(a) ?? -1) || b.score - a.score,
    };
    return [...out].sort(by[f.sort]);
  }, [scored, ui]);

  const setFilters = useCallback((filters: SofaBedFilterState) => setUi((s) => ({ ...s, filters })), []);
  const savedCount = scored.filter((s) => s.pref === "want").length;
  const separateCount = visible.filter((s) => s.separateMattress === true).length;

  return (
    <div className="flex h-full">
      <FilterPanel resultCount={sofaBeds == null ? null : visible.length}>
        <SofaBedFilterRail retailers={retailers} conditions={conditions} filters={ui.filters} onChange={setFilters} />
      </FilterPanel>

      <div className="flex-1 overflow-y-auto">
        <header className="z-20 lg:sticky lg:top-0 border-b border-[var(--border-primary)] bg-[var(--bg-app)] px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-[var(--ink)]">Sofa beds</h1>
              <p className="text-xs text-[var(--text-secondary)]">
                {sofaBeds == null
                  ? "Loading…"
                  : `${visible.length} of ${scored.length} · ${separateCount} sleep on a separate mattress`}
              </p>
            </div>
            <input
              value={ui.search}
              onChange={(e) => setUi((s) => ({ ...s, search: e.target.value }))}
              placeholder="Search model, brand, mechanism…"
              aria-label="Search sofa beds"
              className="h-10 w-full min-w-0 rounded-full border bg-[var(--surface)] px-4 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] sm:w-64"
            />
            <select
              value={ui.filters.sort}
              onChange={(e) => setFilters({ ...ui.filters, sort: e.target.value as SortKey })}
              aria-label="Sort by"
              className="h-10 rounded-full border bg-[var(--surface)] px-3 text-sm text-[var(--ink)]"
            >
              {Object.entries(SORT_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <button
              onClick={() => setUi((s) => ({ ...s, savedOnly: !s.savedOnly }))}
              aria-pressed={ui.savedOnly}
              className={`h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
                ui.savedOnly
                  ? "border-[var(--action)] bg-[var(--action)] text-[var(--on-action)]"
                  : "border-[var(--line-control)] text-[var(--ink)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              ♥ Saved{savedCount ? ` (${savedCount})` : ""}
            </button>
          </div>
        </header>

        <div className="p-4 pb-24 sm:p-6 sm:pb-24 lg:pb-6">
          {error && (
            <div className="rounded-xl border border-[var(--status-no)] bg-[var(--status-no-bg)] p-4 text-sm text-[var(--status-no)]">
              Couldn&apos;t load sofa beds: {error}
            </div>
          )}
          {sofaBeds == null && !error && <div className="text-sm text-[var(--text-secondary)]">Loading sofa beds…</div>}
          {/* An empty column on the unfiltered view is a finding, not a fault:
              three seats, the 200-250cm band and a small double at £1,200
              landed is a hard ask, and the page should say so in words rather
              than go blank. Narrow the filters and it is just an empty result
              again, so the finding gives way to the plain sentence. */}
          {sofaBeds != null && visible.length === 0 && (
            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-8 text-center">
              <p className="mx-auto max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
                {isUnfiltered(ui)
                  ? `Nothing in the corpus meets all three gates. At £${BUDGET_CAP_GBP.toLocaleString()} landed that is the expected answer — try the clearance and second-hand filters.`
                  : "Nothing matches these filters."}
              </p>
              <button
                onClick={() => setUi((s) => ({ ...s, filters: { ...DEFAULT_SOFABED_FILTERS }, savedOnly: false }))}
                className="mt-2 rounded text-sm text-[var(--accent)] hover:underline"
              >
                Reset filters
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((s) => (
              <SofaBedCard key={s.id} sofaBed={s} onPref={setPref} onOpen={setDetail} />
            ))}
          </div>
        </div>
      </div>

      <SofaBedDetail sofaBed={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
