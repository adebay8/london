"use client";

import { useState, useEffect } from "react";
import CompareTable from "@/components/CompareTable";
import type { ResearchProfileRow } from "@/lib/types";
import { BANDS, DEFAULT_COMMUTE_DAYS, type Band } from "@/data/cost-data";

export default function ComparePage() {
  const [allProfiles, setAllProfiles] = useState<ResearchProfileRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<ResearchProfileRow[]>([]);
  const [band, setBand] = useState<Band>("C");
  const [singlePerson, setSinglePerson] = useState(false);
  const [commuteDays, setCommuteDays] = useState(DEFAULT_COMMUTE_DAYS);
  const [rentOverrides, setRentOverrides] = useState<Record<string, { low: number; high: number }>>({});
  const [sharedRent, setSharedRent] = useState<string>("");

  useEffect(() => { fetch("/api/research").then((res) => res.json()).then(setAllProfiles); }, []);

  useEffect(() => {
    if (selectedIds.length < 2) { setCompareData([]); return; }
    fetch(`/api/compare?ids=${selectedIds.join(",")}`).then((res) => res.json()).then(setCompareData);
  }, [selectedIds]);

  function toggleSelection(neighbourhoodId: string) {
    setSelectedIds((prev) => {
      if (prev.includes(neighbourhoodId)) return prev.filter((id) => id !== neighbourhoodId);
      if (prev.length >= 3) return prev;
      return [...prev, neighbourhoodId];
    });
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-bold text-[var(--text-primary)]">Compare Neighbourhoods</h1>
      <div className="mb-6">
        <p className="mb-2 text-sm text-[var(--text-secondary)]">Select 2-3 researched neighbourhoods to compare:</p>
        <div className="flex flex-wrap gap-2">
          {allProfiles.map((p) => {
            const isSelected = selectedIds.includes(p.neighbourhoodId);
            return (
              <button key={p.id} onClick={() => toggleSelection(p.neighbourhoodId)}
                disabled={!isSelected && selectedIds.length >= 3}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${isSelected ? "bg-[var(--accent)] text-[var(--text-on-accent)]" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-30"}`}>
                {p.neighbourhood?.name} ({p.fitScore.toFixed(1)})
              </button>
            );
          })}
        </div>
      </div>
      {compareData.length >= 2 ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              Band:
              <select value={band} onChange={(e) => setBand(e.target.value as Band)} className="rounded bg-[var(--bg-secondary)] px-2 py-1 text-xs text-[var(--text-primary)]">
                {BANDS.map((b) => <option key={b} value={b}>Band {b}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              Office days:
              <select value={commuteDays} onChange={(e) => setCommuteDays(Number(e.target.value))} className="rounded bg-[var(--bg-secondary)] px-2 py-1 text-xs text-[var(--text-primary)]">
                {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d} day{d !== 1 ? "s" : ""}/wk</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
              <input type="checkbox" checked={singlePerson} onChange={(e) => setSinglePerson(e.target.checked)} />
              Single person (-25%)
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              Same rent for all: £
              <input
                type="number"
                placeholder="e.g. 1800"
                value={sharedRent}
                onChange={(e) => {
                  setSharedRent(e.target.value);
                  if (e.target.value) {
                    const val = Number(e.target.value);
                    const overrides: Record<string, { low: number; high: number }> = {};
                    compareData.forEach((p) => { overrides[p.neighbourhoodId] = { low: val, high: val }; });
                    setRentOverrides(overrides);
                  } else {
                    setRentOverrides({});
                  }
                }}
                className="w-20 rounded bg-[var(--bg-secondary)] px-2 py-1 text-xs text-[var(--text-primary)]"
              />
            </label>
            {Object.keys(rentOverrides).length > 0 && (
              <button
                onClick={() => { setRentOverrides({}); setSharedRent(""); }}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                Reset rents
              </button>
            )}
          </div>
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
            <CompareTable
              profiles={compareData}
              band={band}
              singlePerson={singlePerson}
              commuteDays={commuteDays}
              rentOverrides={rentOverrides}
              onRentOverride={(nId, low, high) => { setRentOverrides((prev) => ({ ...prev, [nId]: { low, high } })); setSharedRent(""); }}
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">{allProfiles.length < 2 ? "Research at least 2 neighbourhoods to start comparing." : "Select at least 2 neighbourhoods above."}</p>
      )}
    </div>
  );
}
