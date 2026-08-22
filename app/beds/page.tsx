"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BedCard from "@/components/beds/BedCard";
import BedDetail from "@/components/beds/BedDetail";
import BedFilterRail, { DEFAULT_BED_FILTERS, type BedFilterState } from "@/components/beds/BedFilterRail";
import { compareFinance, financeFor } from "@/lib/beds/finance";
import { scoreAll, type ScoredBed } from "@/lib/beds/score";
import { BUDGET_CAP_GBP, type Bed, type Pref } from "@/lib/beds/types";

type SortKey = "recommended" | "measured" | "cheapest" | "deepest" | "narrowest" | "reviewed" | "finance";

const SORT_LABELS: Record<SortKey, string> = {
  recommended: "Recommended",
  measured: "Best on measured specs",
  cheapest: "Cheapest landed",
  deepest: "Deepest storage",
  narrowest: "Smallest footprint",
  reviewed: "Best reviewed",
  finance: "Best finance deal",
};

interface UIState {
  search: string;
  sort: SortKey;
  savedOnly: boolean;
  filters: BedFilterState;
}

// --- URL <-> state, so a refresh or a shared link restores the exact view ---
function readUI(): UIState {
  const base: UIState = { search: "", sort: "recommended", savedOnly: false, filters: { ...DEFAULT_BED_FILTERS } };
  if (typeof window === "undefined") return base;
  const p = new URLSearchParams(window.location.search);
  const list = (k: string, fallback: string[]) => (p.has(k) ? (p.get(k) ? p.get(k)!.split(",") : []) : fallback);
  const bool = (k: string, fallback: boolean) => (p.has(k) ? p.get(k) === "1" : fallback);
  const one = <T extends string>(k: string, allowed: readonly T[], fallback: T): T =>
    (allowed as readonly string[]).includes(p.get(k) ?? "") ? (p.get(k) as T) : fallback;

  return {
    search: p.get("q") ?? "",
    sort: one("sort", Object.keys(SORT_LABELS) as SortKey[], "recommended"),
    savedOnly: bool("saved", false),
    filters: {
      maxLanded: Number(p.get("max")) || DEFAULT_BED_FILTERS.maxLanded,
      assembly: list("asm", DEFAULT_BED_FILTERS.assembly),
      depth: one("depth", ["any", "28", "32"] as const, DEFAULT_BED_FILTERS.depth),
      opening: list("open", DEFAULT_BED_FILTERS.opening),
      footprint: one("fp", ["any", "12", "6"] as const, DEFAULT_BED_FILTERS.footprint),
      ottomanType: list("type", DEFAULT_BED_FILTERS.ottomanType),
      retailers: list("ret", DEFAULT_BED_FILTERS.retailers),
      finance: one("fin", ["any", "available", "interestfree", "12", "24"] as const, DEFAULT_BED_FILTERS.finance),
      hideOverBudget: bool("over", DEFAULT_BED_FILTERS.hideOverBudget),
      hideThinData: bool("thin", DEFAULT_BED_FILTERS.hideThinData),
      hideRejected: bool("hide", DEFAULT_BED_FILTERS.hideRejected),
    },
  };
}

function writeUI(s: UIState) {
  if (typeof window === "undefined") return;
  const p = new URLSearchParams();
  const f = s.filters;
  if (s.search) p.set("q", s.search);
  if (s.sort !== "recommended") p.set("sort", s.sort);
  if (s.savedOnly) p.set("saved", "1");
  if (f.maxLanded !== DEFAULT_BED_FILTERS.maxLanded) p.set("max", String(f.maxLanded));
  if (f.assembly.length) p.set("asm", f.assembly.join(","));
  if (f.depth !== "any") p.set("depth", f.depth);
  if (f.opening.length) p.set("open", f.opening.join(","));
  if (f.footprint !== "any") p.set("fp", f.footprint);
  if (f.ottomanType.length) p.set("type", f.ottomanType.join(","));
  if (f.retailers.length) p.set("ret", f.retailers.join(","));
  if (f.finance !== "any") p.set("fin", f.finance);
  if (f.hideOverBudget !== DEFAULT_BED_FILTERS.hideOverBudget) p.set("over", f.hideOverBudget ? "1" : "0");
  if (f.hideThinData !== DEFAULT_BED_FILTERS.hideThinData) p.set("thin", f.hideThinData ? "1" : "0");
  if (f.hideRejected !== DEFAULT_BED_FILTERS.hideRejected) p.set("hide", f.hideRejected ? "1" : "0");
  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

const DEPTH_MIN: Record<BedFilterState["depth"], number> = { any: 0, "28": 28, "32": 32 };
const FOOTPRINT_MAX: Record<BedFilterState["footprint"], number> = { any: Infinity, "12": 12, "6": 6 };

export default function BedsPage() {
  const [beds, setBeds] = useState<Bed[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // readUI() returns the defaults when there is no window, so the server pass
  // and the first client pass agree. Same pattern as /flats.
  const [ui, setUi] = useState<UIState>(() => readUI());
  const [detail, setDetail] = useState<ScoredBed | null>(null);

  useEffect(() => writeUI(ui), [ui]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/beds")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { beds: Bed[] }) => !cancelled && setBeds(d.beds))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const setPref = useCallback(async (id: string, pref: Pref | null) => {
    setBeds((prev) => prev?.map((b) => (b.id === id ? { ...b, pref } : b)) ?? prev); // optimistic
    try {
      await fetch("/api/beds/pref", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bedId: id, pref }),
      });
    } catch {
      /* the optimistic value stands until the next load */
    }
  }, []);

  const scored = useMemo(() => (beds ? scoreAll(beds) : []), [beds]);
  const retailers = useMemo(() => [...new Set(scored.map((b) => b.retailer))].sort(), [scored]);

  const visible = useMemo(() => {
    const f = ui.filters;
    const q = ui.search.trim().toLowerCase();
    const out = scored.filter((b) => {
      if (f.hideRejected && b.pref === "reject") return false;
      if (ui.savedOnly && b.pref !== "want") return false;
      if (f.hideOverBudget && b.landedCostGbp > BUDGET_CAP_GBP) return false;
      if (b.landedCostGbp > f.maxLanded) return false;
      if (f.assembly.length && !f.assembly.includes(b.arrivesAssembled)) return false;
      if (f.ottomanType.length && !f.ottomanType.includes(b.ottomanType)) return false;
      if (f.retailers.length && !f.retailers.includes(b.retailer)) return false;
      // Unknown depth/direction are excluded only when you actually ask for one,
      // so a blank never silently masquerades as a pass.
      if (f.depth !== "any" && (b.storageDepthCm == null || b.storageDepthCm < DEPTH_MIN[f.depth])) return false;
      if (f.opening.length && (b.openingDirection == null || !f.opening.includes(b.openingDirection))) return false;
      if (f.footprint !== "any" && (b.overhangCm == null || b.overhangCm > FOOTPRINT_MAX[f.footprint])) return false;
      if (f.finance !== "any") {
        const fin = financeFor(b);
        if (!fin.eligible) return false;
        if (f.finance === "interestfree" && !fin.interestFree) return false;
        if (f.finance === "12" && (!fin.interestFree || fin.months < 12)) return false;
        if (f.finance === "24" && (!fin.interestFree || fin.months < 24)) return false;
      }
      if (f.hideThinData && b.confidence < 0.5) return false;
      if (q && !`${b.retailer} ${b.brand} ${b.model} ${b.upholsteryMaterial ?? ""}`.toLowerCase().includes(q))
        return false;
      return true;
    });

    const by: Record<SortKey, (a: ScoredBed, b: ScoredBed) => number> = {
      recommended: (a, b) => b.score - a.score || a.landedCostGbp - b.landedCostGbp,
      // Raw quality on what we actually measured, ignoring how much is missing.
      // Ranks a thinly-documented bed on its merits — read it with the
      // confidence bar, which is what the shrinkage in "Recommended" accounts for.
      measured: (a, b) => b.rawScore - a.rawScore || b.confidence - a.confidence,
      cheapest: (a, b) => a.landedCostGbp - b.landedCostGbp,
      deepest: (a, b) => (b.storageDepthCm ?? -1) - (a.storageDepthCm ?? -1) || b.score - a.score,
      narrowest: (a, b) => (a.overhangCm ?? 999) - (b.overhangCm ?? 999) || b.score - a.score,
      reviewed: (a, b) => (b.reviewScore ?? -1) - (a.reviewScore ?? -1) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0),
      // Opt-in only. Finance is never folded into "Recommended".
      finance: (a, b) => compareFinance(a, b) || b.score - a.score,
    };
    return [...out].sort(by[ui.sort]);
  }, [scored, ui]);

  const setFilters = useCallback((filters: BedFilterState) => setUi((s) => ({ ...s, filters })), []);
  const savedCount = scored.filter((b) => b.pref === "want").length;

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 lg:block">
        <BedFilterRail retailers={retailers} filters={ui.filters} onChange={setFilters} />
      </aside>

      <div className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 border-b border-[var(--border-primary)] bg-[var(--bg-app)]/95 px-6 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Beds</h1>
              <p className="text-xs text-[var(--text-secondary)]">
                {beds == null ? "Loading…" : `${visible.length} of ${scored.length} double ottomans`}
                {" · ranked by landed cost, storage depth, mechanism and build"}
              </p>
            </div>

            <input
              value={ui.search}
              onChange={(e) => setUi((s) => ({ ...s, search: e.target.value }))}
              placeholder="Search model, brand, fabric…"
              aria-label="Search beds"
              className="w-56 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            />

            <select
              value={ui.sort}
              onChange={(e) => setUi((s) => ({ ...s, sort: e.target.value as SortKey }))}
              aria-label="Sort by"
              className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              {Object.entries(SORT_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            <button
              onClick={() => setUi((s) => ({ ...s, savedOnly: !s.savedOnly }))}
              aria-pressed={ui.savedOnly}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                ui.savedOnly
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              ♥ Saved{savedCount ? ` (${savedCount})` : ""}
            </button>
          </div>
        </header>

        <div className="p-6">
          {error && (
            <div className="rounded-xl border border-[var(--status-no)] bg-[var(--status-no-bg)] p-4 text-sm text-[var(--status-no)]">
              Couldn&apos;t load beds: {error}
            </div>
          )}

          {beds == null && !error && <div className="text-sm text-[var(--text-secondary)]">Loading beds…</div>}

          {beds != null && visible.length === 0 && (
            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-8 text-center">
              <p className="text-sm text-[var(--text-secondary)]">Nothing matches these filters.</p>
              <button
                onClick={() => setUi((s) => ({ ...s, filters: { ...DEFAULT_BED_FILTERS }, savedOnly: false }))}
                className="mt-2 rounded text-sm text-[var(--accent)] hover:underline"
              >
                Reset filters
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((b) => (
              <BedCard key={b.id} bed={b} onPref={setPref} onOpen={setDetail} />
            ))}
          </div>
        </div>
      </div>

      <BedDetail bed={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
