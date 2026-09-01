"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MattressCard from "@/components/mattresses/MattressCard";
import MattressDetail from "@/components/mattresses/MattressDetail";
import MattressFilterRail, {
  DEFAULT_MATTRESS_FILTERS,
  type MattressFilterState,
} from "@/components/mattresses/MattressFilterRail";
import { compatFor, type BedConstraint } from "@/lib/mattresses/compat";
import { compareDeal, dealFor } from "@/lib/mattresses/deal";
import { scoreAll, type ScoredMattress } from "@/lib/mattresses/score";
import { BUDGET_CAP_GBP, type Mattress, type Pref } from "@/lib/mattresses/types";

type SortKey = "recommended" | "deal" | "cheapest" | "trial" | "measured" | "reviewed";

const SORT_LABELS: Record<SortKey, string> = {
  recommended: "Recommended",
  deal: "Best real saving",
  cheapest: "Cheapest landed",
  trial: "Longest sleep trial",
  measured: "Best on measured specs",
  reviewed: "Best reviewed",
};

interface UIState {
  search: string;
  sort: SortKey;
  savedOnly: boolean;
  filters: MattressFilterState;
}

function readUI(): UIState {
  const base: UIState = {
    search: "",
    sort: "recommended",
    savedOnly: false,
    filters: { ...DEFAULT_MATTRESS_FILTERS },
  };
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
      maxLanded: Number(p.get("max")) || DEFAULT_MATTRESS_FILTERS.maxLanded,
      firmness: list("firm", DEFAULT_MATTRESS_FILTERS.firmness),
      types: list("type", DEFAULT_MATTRESS_FILTERS.types),
      fit: one("fit", ["confirmed", "notfailed", "all"] as const, DEFAULT_MATTRESS_FILTERS.fit),
      minTrial: Number(p.get("trial")) || DEFAULT_MATTRESS_FILTERS.minTrial,
      pocketOnly: bool("pocket", DEFAULT_MATTRESS_FILTERS.pocketOnly),
      verifiedDealsOnly: bool("verified", DEFAULT_MATTRESS_FILTERS.verifiedDealsOnly),
      fitsAllBeds: bool("beds", DEFAULT_MATTRESS_FILTERS.fitsAllBeds),
      retailers: list("ret", DEFAULT_MATTRESS_FILTERS.retailers),
      hideSoldOut: bool("stock", DEFAULT_MATTRESS_FILTERS.hideSoldOut),
      hideOverBudget: bool("over", DEFAULT_MATTRESS_FILTERS.hideOverBudget),
      hideThinData: bool("thin", DEFAULT_MATTRESS_FILTERS.hideThinData),
      hideRejected: bool("hide", DEFAULT_MATTRESS_FILTERS.hideRejected),
    },
  };
}

function writeUI(s: UIState) {
  if (typeof window === "undefined") return;
  const p = new URLSearchParams();
  const f = s.filters;
  const d = DEFAULT_MATTRESS_FILTERS;
  if (s.search) p.set("q", s.search);
  if (s.sort !== "recommended") p.set("sort", s.sort);
  if (s.savedOnly) p.set("saved", "1");
  if (f.maxLanded !== d.maxLanded) p.set("max", String(f.maxLanded));
  if (f.firmness.length) p.set("firm", f.firmness.join(","));
  if (f.types.length) p.set("type", f.types.join(","));
  if (f.fit !== d.fit) p.set("fit", f.fit);
  if (f.minTrial) p.set("trial", String(f.minTrial));
  if (f.pocketOnly) p.set("pocket", "1");
  if (f.verifiedDealsOnly) p.set("verified", "1");
  if (f.fitsAllBeds) p.set("beds", "1");
  if (f.retailers.length) p.set("ret", f.retailers.join(","));
  if (f.hideSoldOut !== d.hideSoldOut) p.set("stock", f.hideSoldOut ? "1" : "0");
  if (f.hideOverBudget !== d.hideOverBudget) p.set("over", f.hideOverBudget ? "1" : "0");
  if (f.hideThinData !== d.hideThinData) p.set("thin", f.hideThinData ? "1" : "0");
  if (f.hideRejected !== d.hideRejected) p.set("hide", f.hideRejected ? "1" : "0");
  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

const FIT_RANK: Record<string, number> = { pass: 0, unknown: 1, fail: 2 };

export default function MattressesPage() {
  const [mattresses, setMattresses] = useState<Mattress[] | null>(null);
  const [beds, setBeds] = useState<BedConstraint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ui, setUi] = useState<UIState>(() => readUI());
  const [detail, setDetail] = useState<ScoredMattress | null>(null);

  useEffect(() => writeUI(ui), [ui]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mattresses")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { mattresses: Mattress[]; beds: BedConstraint[] }) => {
        if (cancelled) return;
        setMattresses(d.mattresses);
        setBeds(d.beds ?? []);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, []);

  const setPref = useCallback(async (id: string, pref: Pref | null) => {
    setMattresses((prev) => prev?.map((m) => (m.id === id ? { ...m, pref } : m)) ?? prev);
    try {
      await fetch("/api/mattresses/pref", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mattressId: id, pref }),
      });
    } catch { /* optimistic value stands */ }
  }, []);

  const scored = useMemo(() => (mattresses ? scoreAll(mattresses) : []), [mattresses]);
  const retailers = useMemo(() => [...new Set(scored.map((m) => m.retailer))].sort(), [scored]);
  const types = useMemo(
    () => [...new Set(scored.map((m) => m.type).filter((t): t is NonNullable<typeof t> => t != null))].sort(),
    [scored],
  );

  const visible = useMemo(() => {
    const f = ui.filters;
    const q = ui.search.trim().toLowerCase();
    const out = scored.filter((m) => {
      if (f.hideRejected && m.pref === "reject") return false;
      // Availability, not quality — a mattress you cannot buy is excluded
      // outright rather than marked down. Null means the retailer published
      // nothing, which is not the same as sold out.
      if (f.hideSoldOut && m.inStock === false) return false;
      if (ui.savedOnly && m.pref !== "want") return false;
      if (f.hideOverBudget && m.landedCostGbp > BUDGET_CAP_GBP) return false;
      if (m.landedCostGbp > f.maxLanded) return false;
      // An unstated firmness never passes as the right firmness — asking for a
      // band means you need the evidence, not the benefit of the doubt.
      if (f.firmness.length) {
        const v = m.fit.firmnessRead.value;
        if (v == null || !f.firmness.includes(v)) return false;
      }
      if (f.types.length && (m.type == null || !f.types.includes(m.type))) return false;
      if (f.fit === "confirmed" && m.fit.overall !== "pass") return false;
      if (f.fit === "notfailed" && m.fit.overall === "fail") return false;
      if (f.minTrial > 0 && (m.trialNights == null || m.trialNights < f.minTrial)) return false;
      if (f.pocketOnly && m.springType !== "pocket") return false;
      if (f.verifiedDealsOnly && !dealFor(m).credible) return false;
      if (f.fitsAllBeds && beds.length) {
        const c = compatFor(m, beds);
        if (c.blocked.length > 0) return false;
      }
      if (f.retailers.length && !f.retailers.includes(m.retailer)) return false;
      if (f.hideThinData && m.confidence < 0.5) return false;
      if (q && !`${m.retailer} ${m.brand} ${m.model} ${m.type ?? ""} ${m.firmnessLabel ?? ""}`.toLowerCase().includes(q))
        return false;
      return true;
    });

    const by: Record<SortKey, (a: ScoredMattress, b: ScoredMattress) => number> = {
      recommended: (a, b) =>
        FIT_RANK[a.fit.overall] - FIT_RANK[b.fit.overall] || b.score - a.score || a.landedCostGbp - b.landedCostGbp,
      // Verified savings first, at any headline percentage. That is the whole
      // point of the deal module.
      deal: (a, b) => compareDeal(dealFor(a), dealFor(b)) || b.score - a.score,
      cheapest: (a, b) => a.landedCostGbp - b.landedCostGbp,
      trial: (a, b) => (b.trialNights ?? -1) - (a.trialNights ?? -1) || b.score - a.score,
      measured: (a, b) => b.rawScore - a.rawScore || b.confidence - a.confidence,
      reviewed: (a, b) => (b.reviewScore ?? -1) - (a.reviewScore ?? -1) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0),
    };
    return [...out].sort(by[ui.sort]);
  }, [scored, ui, beds]);

  const setFilters = useCallback((filters: MattressFilterState) => setUi((s) => ({ ...s, filters })), []);
  const savedCount = scored.filter((m) => m.pref === "want").length;
  const inBand = visible.filter((m) => m.fit.firmness === "pass").length;

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 lg:block">
        <MattressFilterRail
          retailers={retailers}
          types={types}
          bedCount={beds.length}
          filters={ui.filters}
          onChange={setFilters}
        />
      </aside>

      <div className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 border-b border-[var(--border-primary)] bg-[var(--bg-app)]/95 px-6 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Mattresses</h1>
              <p className="text-xs text-[var(--text-secondary)]">
                {mattresses == null
                  ? "Loading…"
                  : `${visible.length} of ${scored.length} · ${inBand} in your firmness band`}
              </p>
            </div>
            <input
              value={ui.search}
              onChange={(e) => setUi((s) => ({ ...s, search: e.target.value }))}
              placeholder="Search model, brand, type…"
              aria-label="Search mattresses"
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
              Couldn&apos;t load mattresses: {error}
            </div>
          )}
          {mattresses == null && !error && (
            <div className="text-sm text-[var(--text-secondary)]">Loading mattresses…</div>
          )}
          {mattresses != null && visible.length === 0 && (
            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-8 text-center">
              <p className="text-sm text-[var(--text-secondary)]">Nothing matches these filters.</p>
              <button
                onClick={() => setUi((s) => ({ ...s, filters: { ...DEFAULT_MATTRESS_FILTERS }, savedOnly: false }))}
                className="mt-2 rounded text-sm text-[var(--accent)] hover:underline"
              >
                Reset filters
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((m) => (
              <MattressCard key={m.id} mattress={m} beds={beds} onPref={setPref} onOpen={setDetail} />
            ))}
          </div>
        </div>
      </div>

      <MattressDetail mattress={detail} beds={beds} onClose={() => setDetail(null)} />
    </div>
  );
}
