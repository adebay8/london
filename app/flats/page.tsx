"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FlatCard from "@/components/flats/FlatCard";
import FilterRail, { DEFAULT_FILTERS, type FilterState } from "@/components/flats/FilterRail";
import SummaryPanel from "@/components/flats/SummaryPanel";
import OperatorsPanel from "@/components/flats/OperatorsPanel";
import { compareListings } from "@/lib/flat-search/view-logic";
import { buildView, type EnrichedListing } from "@/lib/flat-search/view-model";
import type { FlatConfig, Listing, Pref, Area } from "@/lib/flat-search/types";

type Tab = "summary" | "homes" | "operators";
interface StoreResponse {
  areas: Area[];
  listings: Listing[];
  config: FlatConfig;
}

export default function FlatsPage() {
  const [store, setStore] = useState<StoreResponse | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    fetch("/api/flats")
      .then((r) => r.json())
      .then(setStore);
  }, []);

  const view = useMemo(() => (store ? buildView(store, nowMs) : null), [store, nowMs]);

  const setPref = useCallback(
    (id: string, pref: Pref | null) => {
      setStore((prev) =>
        prev ? { ...prev, listings: prev.listings.map((l) => (l.id === id ? { ...l, pref } : l)) } : prev,
      );
      fetch("/api/flats/pref", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: id, pref }),
      }).catch(() => {});
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
      return true;
    });

    const timingCtx = { floorMs: view.floorMs, moveTiming: view.config.moveTiming, nowMs };
    const rank = (l: EnrichedListing) => (l.pref === "want" ? 0 : l.pref === "reject" ? 2 : 1);
    kept.sort((a, b) => rank(a) - rank(b) || compareListings(a, b, view.areaById, timingCtx));

    return view.areas
      .map((area) => ({ area, listings: kept.filter((l) => l.areaId === area.id) }))
      .filter((g) => g.listings.length > 0);
  }, [view, filters, topPickIds, nowMs]);

  if (!view) {
    return <div className="p-6 text-[var(--text-muted)]">Loading flat search…</div>;
  }

  const shownCount = grouped.reduce((n, g) => n + g.listings.length, 0);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--border-primary)] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">🔑 Flat search</h1>
            <p className="text-sm text-[var(--text-muted)]">
              {view.counts.active} active · {view.counts.isNew} new · last run {view.config.lastRun ?? "—"}
            </p>
          </div>
          <nav className="flex gap-1 rounded-lg bg-[var(--bg-secondary)] p-1">
            {(["summary", "homes", "operators"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
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
            <SummaryPanel view={view} />
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
              <div className="mb-3 text-sm text-[var(--text-muted)]">{shownCount} shown</div>
              {grouped.length === 0 ? (
                <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-8 text-center text-[var(--text-muted)]">
                  No flats match these filters.
                </div>
              ) : (
                <div className="space-y-6">
                  {grouped.map((g) => (
                    <section key={g.area.id}>
                      <div className="mb-2 flex items-baseline gap-2">
                        <h2 className="text-sm font-bold text-[var(--text-primary)]">{g.area.name}</h2>
                        <span className="text-xs text-[var(--text-muted)]">
                          {g.area.tier === "anchor" ? "Anchor" : `Tier ${g.area.tier}`} · {g.listings.length}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {g.listings.map((l) => (
                          <FlatCard key={l.id} listing={l} areaName={g.area.name} onPref={setPref} />
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
