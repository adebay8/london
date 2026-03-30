"use client";

import { useState, useEffect } from "react";
import CompareTable from "@/components/CompareTable";
import type { ResearchProfileRow } from "@/lib/types";

export default function ComparePage() {
  const [allProfiles, setAllProfiles] = useState<ResearchProfileRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<ResearchProfileRow[]>([]);

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
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4"><CompareTable profiles={compareData} /></div>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">{allProfiles.length < 2 ? "Research at least 2 neighbourhoods to start comparing." : "Select at least 2 neighbourhoods above."}</p>
      )}
    </div>
  );
}
