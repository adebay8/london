"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SofaCard from "@/components/sofas/SofaCard";
import SofaDetail from "@/components/sofas/SofaDetail";
import SofaFilterRail, { DEFAULT_SOFA_FILTERS, type SofaFilterState } from "@/components/sofas/SofaFilterRail";
import { bodyDepthOf } from "@/lib/sofas/fit";
import { scoreAll, type ScoredSofa } from "@/lib/sofas/score";
import { BUDGET_CAP_GBP, TARGET_DEPTH_CM, type Pref, type Sofa } from "@/lib/sofas/types";

type SortKey = "recommended" | "deepest" | "style" | "cheapest" | "measured" | "widest" | "reviewed";

const SORT_LABELS: Record<SortKey, string> = {
  recommended: "Recommended",
  deepest: "Deepest first",
  style: "Most like the Raft",
  cheapest: "Cheapest landed",
  measured: "Best on measured specs",
  widest: "Biggest that still fits",
  reviewed: "Best reviewed",
};

interface UIState {
  search: string;
  sort: SortKey;
  savedOnly: boolean;
  filters: SofaFilterState;
}

function readUI(): UIState {
  const base: UIState = { search: "", sort: "recommended", savedOnly: false, filters: { ...DEFAULT_SOFA_FILTERS } };
  if (typeof window === "undefined") return base;
  const p = new URLSearchParams(window.location.search);
  const list = (k: string, fb: string[]) => (p.has(k) ? (p.get(k) ? p.get(k)!.split(",") : []) : fb);
  const bool = (k: string, fb: boolean) => (p.has(k) ? p.get(k) === "1" : fb);
  const one = <T extends string>(k: string, allowed: readonly T[], fb: T): T =>
    (allowed as readonly string[]).includes(p.get(k) ?? "") ? (p.get(k) as T) : fb;
  return {
    search: p.get("q") ?? "",
    sort: one("sort", Object.keys(SORT_LABELS) as SortKey[], "recommended"),
    savedOnly: bool("saved", false),
    filters: {
      maxLanded: Number(p.get("max")) || DEFAULT_SOFA_FILTERS.maxLanded,
      minDepth: Number(p.get("depth")) || DEFAULT_SOFA_FILTERS.minDepth,
      maxWidth: Number(p.get("w")) || DEFAULT_SOFA_FILTERS.maxWidth,
      fit: one("fit", ["confirmed", "notfailed", "all"] as const, DEFAULT_SOFA_FILTERS.fit),
      legRest: list("leg", DEFAULT_SOFA_FILTERS.legRest),
      condition: list("cond", DEFAULT_SOFA_FILTERS.condition),
      modularOnly: bool("mod", DEFAULT_SOFA_FILTERS.modularOnly),
      retailers: list("ret", DEFAULT_SOFA_FILTERS.retailers),
      hideOverBudget: bool("over", DEFAULT_SOFA_FILTERS.hideOverBudget),
      hideThinData: bool("thin", DEFAULT_SOFA_FILTERS.hideThinData),
      hideRejected: bool("hide", DEFAULT_SOFA_FILTERS.hideRejected),
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
  if (f.maxLanded !== DEFAULT_SOFA_FILTERS.maxLanded) p.set("max", String(f.maxLanded));
  if (f.minDepth) p.set("depth", String(f.minDepth));
  if (f.maxWidth !== DEFAULT_SOFA_FILTERS.maxWidth) p.set("w", String(f.maxWidth));
  if (f.fit !== DEFAULT_SOFA_FILTERS.fit) p.set("fit", f.fit);
  if (f.legRest.length) p.set("leg", f.legRest.join(","));
  if (f.condition.length) p.set("cond", f.condition.join(","));
  if (f.modularOnly) p.set("mod", "1");
  if (f.retailers.length) p.set("ret", f.retailers.join(","));
  if (f.hideOverBudget !== DEFAULT_SOFA_FILTERS.hideOverBudget) p.set("over", f.hideOverBudget ? "1" : "0");
  if (f.hideThinData !== DEFAULT_SOFA_FILTERS.hideThinData) p.set("thin", f.hideThinData ? "1" : "0");
  if (f.hideRejected !== DEFAULT_SOFA_FILTERS.hideRejected) p.set("hide", f.hideRejected ? "1" : "0");
  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

const FIT_RANK: Record<string, number> = { pass: 0, unknown: 1, fail: 2 };

export default function SofasPage() {
  const [sofas, setSofas] = useState<Sofa[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ui, setUi] = useState<UIState>(() => readUI());
  const [detail, setDetail] = useState<ScoredSofa | null>(null);

  useEffect(() => writeUI(ui), [ui]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sofas")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { sofas: Sofa[] }) => !cancelled && setSofas(d.sofas))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, []);

  const setPref = useCallback(async (id: string, pref: Pref | null) => {
    setSofas((prev) => prev?.map((s) => (s.id === id ? { ...s, pref } : s)) ?? prev);
    try {
      await fetch("/api/sofas/pref", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sofaId: id, pref }),
      });
    } catch { /* optimistic value stands */ }
  }, []);

  const scored = useMemo(() => (sofas ? scoreAll(sofas) : []), [sofas]);
  const retailers = useMemo(() => [...new Set(scored.map((s) => s.retailer))].sort(), [scored]);
  const conditions = useMemo(() => [...new Set(scored.map((s) => s.condition))].sort(), [scored]);

  const visible = useMemo(() => {
    const f = ui.filters;
    const q = ui.search.trim().toLowerCase();
    const out = scored.filter((s) => {
      if (f.hideRejected && s.pref === "reject") return false;
      if (ui.savedOnly && s.pref !== "want") return false;
      if (f.hideOverBudget && s.landedCostGbp > BUDGET_CAP_GBP) return false;
      if (s.landedCostGbp > f.maxLanded) return false;
      // A blank depth never passes as deep — asking for depth means you need
      // the evidence, not the benefit of the doubt.
      if (f.minDepth > 0) {
        const d = bodyDepthOf(s);
        if (d == null || d < f.minDepth) return false;
      }
      if (s.overallWidthCm != null && s.overallWidthCm > f.maxWidth) return false;
      if (f.fit === "confirmed" && s.fit.overall !== "pass") return false;
      if (f.fit === "notfailed" && s.fit.overall === "fail") return false;
      if (f.legRest.length) {
        const r = s.fit.legRestRoute;
        if (r == null) return false;
        if (!f.legRest.includes(r) && !(r === "both" && (f.legRest.includes("chaise") || f.legRest.includes("footstool"))))
          return false;
      }
      if (f.condition.length && !f.condition.includes(s.condition)) return false;
      if (f.modularOnly && !s.modular) return false;
      if (f.retailers.length && !f.retailers.includes(s.retailer)) return false;
      if (f.hideThinData && s.confidence < 0.5) return false;
      if (q && !`${s.retailer} ${s.brand} ${s.model} ${s.fabric ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });

    const by: Record<SortKey, (a: ScoredSofa, b: ScoredSofa) => number> = {
      recommended: (a, b) =>
        FIT_RANK[a.fit.overall] - FIT_RANK[b.fit.overall] || b.score - a.score || a.landedCostGbp - b.landedCostGbp,
      deepest: (a, b) => (bodyDepthOf(b) ?? -1) - (bodyDepthOf(a) ?? -1) || b.score - a.score,
      style: (a, b) => b.styleMatch - a.styleMatch || b.score - a.score,
      cheapest: (a, b) => a.landedCostGbp - b.landedCostGbp,
      measured: (a, b) => b.rawScore - a.rawScore || b.confidence - a.confidence,
      widest: (a, b) => (b.overallWidthCm ?? -1) - (a.overallWidthCm ?? -1),
      reviewed: (a, b) => (b.reviewScore ?? -1) - (a.reviewScore ?? -1) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0),
    };
    return [...out].sort(by[ui.sort]);
  }, [scored, ui]);

  const setFilters = useCallback((filters: SofaFilterState) => setUi((s) => ({ ...s, filters })), []);
  const savedCount = scored.filter((s) => s.pref === "want").length;
  const deepCount = visible.filter((s) => (bodyDepthOf(s) ?? 0) >= TARGET_DEPTH_CM).length;

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 lg:block">
        <SofaFilterRail retailers={retailers} conditions={conditions} filters={ui.filters} onChange={setFilters} />
      </aside>

      <div className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 border-b border-[var(--border-primary)] bg-[var(--bg-app)]/95 px-6 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Sofas</h1>
              <p className="text-xs text-[var(--text-secondary)]">
                {sofas == null
                  ? "Loading…"
                  : `${visible.length} of ${scored.length} · ${deepCount} at the ${TARGET_DEPTH_CM}cm depth you liked`}
              </p>
            </div>
            <input
              value={ui.search}
              onChange={(e) => setUi((s) => ({ ...s, search: e.target.value }))}
              placeholder="Search model, brand, fabric…"
              aria-label="Search sofas"
              className="w-56 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            />
            <select
              value={ui.sort}
              onChange={(e) => setUi((s) => ({ ...s, sort: e.target.value as SortKey }))}
              aria-label="Sort by"
              className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
            >
              {Object.entries(SORT_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <button
              onClick={() => setUi((s) => ({ ...s, savedOnly: !s.savedOnly }))}
              aria-pressed={ui.savedOnly}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
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
              Couldn&apos;t load sofas: {error}
            </div>
          )}
          {sofas == null && !error && <div className="text-sm text-[var(--text-secondary)]">Loading sofas…</div>}
          {sofas != null && visible.length === 0 && (
            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-8 text-center">
              <p className="text-sm text-[var(--text-secondary)]">Nothing matches these filters.</p>
              <button
                onClick={() => setUi((s) => ({ ...s, filters: { ...DEFAULT_SOFA_FILTERS }, savedOnly: false }))}
                className="mt-2 rounded text-sm text-[var(--accent)] hover:underline"
              >
                Reset filters
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((s) => (
              <SofaCard key={s.id} sofa={s} onPref={setPref} onOpen={setDetail} />
            ))}
          </div>
        </div>
      </div>

      <SofaDetail sofa={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
