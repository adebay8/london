"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ConsoleCard from "@/components/consoles/ConsoleCard";
import ConsoleDetail from "@/components/consoles/ConsoleDetail";
import ConsoleFilterRail, {
  DEFAULT_CONSOLE_FILTERS,
  type ConsoleFilterState,
} from "@/components/consoles/ConsoleFilterRail";
import { largestOpenBay } from "@/lib/consoles/fit";
import { scoreAll, type ScoredConsole } from "@/lib/consoles/score";
import {
  BUDGET_CAP_GBP,
  MAX_OVERALL_WIDTH_CM,
  MIN_OVERALL_WIDTH_CM,
  PREFERRED_TOP_WIDTH_CM,
  type Pref,
  type TvConsole,
} from "@/lib/consoles/types";
import { compareFinance, financeFor } from "@/lib/retail/finance";

type SortKey = "recommended" | "measured" | "cheapest" | "deepest" | "bay" | "reviewed" | "finance";

const SORT_LABELS: Record<SortKey, string> = {
  recommended: "Recommended",
  measured: "Best on measured specs",
  cheapest: "Cheapest landed",
  deepest: "Deepest top surface",
  bay: "Biggest open bay",
  reviewed: "Best reviewed",
  finance: "Best finance deal",
};

interface UIState {
  search: string;
  sort: SortKey;
  savedOnly: boolean;
  filters: ConsoleFilterState;
}

// --- URL <-> state, so a refresh or a shared link restores the exact view ---
function readUI(): UIState {
  const base: UIState = { search: "", sort: "recommended", savedOnly: false, filters: { ...DEFAULT_CONSOLE_FILTERS } };
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
      maxLanded: Number(p.get("max")) || DEFAULT_CONSOLE_FILTERS.maxLanded,
      fit: one("fit", ["confirmed", "notfailed", "all"] as const, DEFAULT_CONSOLE_FILTERS.fit),
      topDepth: one("depth", ["any", "37", "40"] as const, DEFAULT_CONSOLE_FILTERS.topDepth),
      width: one("w", ["any", "tv", "wall"] as const, DEFAULT_CONSOLE_FILTERS.width),
      backPanel: list("back", DEFAULT_CONSOLE_FILTERS.backPanel),
      assembly: list("asm", DEFAULT_CONSOLE_FILTERS.assembly),
      retailers: list("ret", DEFAULT_CONSOLE_FILTERS.retailers),
      finance: one("fin", ["any", "available", "interestfree", "12", "24"] as const, DEFAULT_CONSOLE_FILTERS.finance),
      hideOverBudget: bool("over", DEFAULT_CONSOLE_FILTERS.hideOverBudget),
      hideThinData: bool("thin", DEFAULT_CONSOLE_FILTERS.hideThinData),
      hideRejected: bool("hide", DEFAULT_CONSOLE_FILTERS.hideRejected),
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
  if (f.maxLanded !== DEFAULT_CONSOLE_FILTERS.maxLanded) p.set("max", String(f.maxLanded));
  if (f.fit !== DEFAULT_CONSOLE_FILTERS.fit) p.set("fit", f.fit);
  if (f.topDepth !== "any") p.set("depth", f.topDepth);
  if (f.width !== "any") p.set("w", f.width);
  if (f.backPanel.length) p.set("back", f.backPanel.join(","));
  if (f.assembly.length) p.set("asm", f.assembly.join(","));
  if (f.retailers.length) p.set("ret", f.retailers.join(","));
  if (f.finance !== "any") p.set("fin", f.finance);
  if (f.hideOverBudget !== DEFAULT_CONSOLE_FILTERS.hideOverBudget) p.set("over", f.hideOverBudget ? "1" : "0");
  if (f.hideThinData !== DEFAULT_CONSOLE_FILTERS.hideThinData) p.set("thin", f.hideThinData ? "1" : "0");
  if (f.hideRejected !== DEFAULT_CONSOLE_FILTERS.hideRejected) p.set("hide", f.hideRejected ? "1" : "0");
  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

const DEPTH_MIN: Record<ConsoleFilterState["topDepth"], number> = { any: 0, "37": 37, "40": 40 };

/** pass > unknown > fail. The score deliberately does not penalise an
 *  unpublished measurement, which is right for measuring quality — but the
 *  default view should still lead with units we have actually confirmed will
 *  take the kit, since that is the entire point of the search. So fit ranks
 *  the list and the score orders within each rank. */
const FIT_RANK: Record<string, number> = { pass: 0, unknown: 1, fail: 2 };

const bayVolume = (c: ScoredConsole): number => {
  const b = largestOpenBay(c.bays);
  if (!b) return -1;
  return (b.widthCm ?? 0) * (b.heightCm ?? 0) * (b.depthCm ?? 0);
};

export default function ConsolesPage() {
  const [consoles, setConsoles] = useState<TvConsole[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // readUI() returns the defaults when there is no window, so the server pass
  // and the first client pass agree. Same pattern as /flats and /beds.
  const [ui, setUi] = useState<UIState>(() => readUI());
  const [detail, setDetail] = useState<ScoredConsole | null>(null);

  useEffect(() => writeUI(ui), [ui]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/consoles")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { consoles: TvConsole[] }) => !cancelled && setConsoles(d.consoles))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const setPref = useCallback(async (id: string, pref: Pref | null) => {
    setConsoles((prev) => prev?.map((c) => (c.id === id ? { ...c, pref } : c)) ?? prev); // optimistic
    try {
      await fetch("/api/consoles/pref", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consoleId: id, pref }),
      });
    } catch {
      /* the optimistic value stands until the next load */
    }
  }, []);

  const scored = useMemo(() => (consoles ? scoreAll(consoles) : []), [consoles]);
  const retailers = useMemo(() => [...new Set(scored.map((c) => c.retailer))].sort(), [scored]);

  const visible = useMemo(() => {
    const f = ui.filters;
    const q = ui.search.trim().toLowerCase();
    const out = scored.filter((c) => {
      if (f.hideRejected && c.pref === "reject") return false;
      if (ui.savedOnly && c.pref !== "want") return false;
      if (f.hideOverBudget && c.landedCostGbp > BUDGET_CAP_GBP) return false;
      if (c.landedCostGbp > f.maxLanded) return false;

      // The tri-state gate. "notfailed" keeps unknowns — see the rail's hint.
      if (f.fit === "confirmed" && c.fit.overall !== "pass") return false;
      if (f.fit === "notfailed" && c.fit.overall === "fail") return false;

      if (f.assembly.length && !f.assembly.includes(c.arrivesAssembled)) return false;
      if (f.backPanel.length && (c.backPanel == null || !f.backPanel.includes(c.backPanel))) return false;
      if (f.retailers.length && !f.retailers.includes(c.retailer)) return false;

      // Unknown dimensions are excluded only when you actually ask for one, so
      // a blank never silently masquerades as a pass.
      if (f.topDepth !== "any" && (c.topDepthCm == null || c.topDepthCm < DEPTH_MIN[f.topDepth])) return false;
      if (f.width !== "any") {
        const w = c.overallWidthCm ?? c.topWidthCm;
        if (w == null) return false;
        if (f.width === "tv" && w < PREFERRED_TOP_WIDTH_CM) return false;
        if (f.width === "wall" && (w < MIN_OVERALL_WIDTH_CM || w > MAX_OVERALL_WIDTH_CM)) return false;
      }

      if (f.finance !== "any") {
        const fin = financeFor(c);
        if (!fin.eligible) return false;
        if (f.finance === "interestfree" && !fin.interestFree) return false;
        if (f.finance === "12" && (!fin.interestFree || fin.months < 12)) return false;
        if (f.finance === "24" && (!fin.interestFree || fin.months < 24)) return false;
      }
      if (f.hideThinData && c.confidence < 0.5) return false;
      if (q && !`${c.retailer} ${c.brand} ${c.model} ${c.finishMaterial ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });

    const by: Record<SortKey, (a: ScoredConsole, b: ScoredConsole) => number> = {
      recommended: (a, b) =>
        FIT_RANK[a.fit.overall] - FIT_RANK[b.fit.overall] || b.score - a.score || a.landedCostGbp - b.landedCostGbp,
      // Raw quality on what we actually measured, ignoring how much is
      // missing. Read it with the confidence bar — the shrinkage in
      // "Recommended" is what accounts for thin evidence.
      measured: (a, b) => b.rawScore - a.rawScore || b.confidence - a.confidence,
      cheapest: (a, b) => a.landedCostGbp - b.landedCostGbp,
      deepest: (a, b) => (b.topDepthCm ?? -1) - (a.topDepthCm ?? -1) || b.score - a.score,
      bay: (a, b) => bayVolume(b) - bayVolume(a) || b.score - a.score,
      reviewed: (a, b) => (b.reviewScore ?? -1) - (a.reviewScore ?? -1) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0),
      // Opt-in only. Finance is never folded into "Recommended".
      finance: (a, b) => compareFinance(a, b) || b.score - a.score,
    };
    return [...out].sort(by[ui.sort]);
  }, [scored, ui]);

  const setFilters = useCallback((filters: ConsoleFilterState) => setUi((s) => ({ ...s, filters })), []);
  const savedCount = scored.filter((c) => c.pref === "want").length;
  const confirmed = visible.filter((c) => c.fit.overall === "pass").length;

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 lg:block">
        <ConsoleFilterRail retailers={retailers} filters={ui.filters} onChange={setFilters} />
      </aside>

      <div className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 border-b border-[var(--border-primary)] bg-[var(--bg-app)]/95 px-6 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">TV unit</h1>
              <p className="text-xs text-[var(--text-secondary)]">
                {consoles == null
                  ? "Loading…"
                  : `${visible.length} of ${scored.length} units · ${confirmed} confirmed to take the TV, soundbar and a flat PS5`}
              </p>
            </div>

            <input
              value={ui.search}
              onChange={(e) => setUi((s) => ({ ...s, search: e.target.value }))}
              placeholder="Search model, brand, finish…"
              aria-label="Search TV units"
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
              Couldn&apos;t load TV units: {error}
            </div>
          )}

          {consoles == null && !error && <div className="text-sm text-[var(--text-secondary)]">Loading TV units…</div>}

          {consoles != null && visible.length === 0 && (
            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-8 text-center">
              <p className="text-sm text-[var(--text-secondary)]">Nothing matches these filters.</p>
              <button
                onClick={() => setUi((s) => ({ ...s, filters: { ...DEFAULT_CONSOLE_FILTERS }, savedOnly: false }))}
                className="mt-2 rounded text-sm text-[var(--accent)] hover:underline"
              >
                Reset filters
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((c) => (
              <ConsoleCard key={c.id} console={c} onPref={setPref} onOpen={setDetail} />
            ))}
          </div>
        </div>
      </div>

      <ConsoleDetail console={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
