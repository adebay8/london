"use client";

import { useState, useEffect, useMemo } from "react";
import ProfileCard from "@/components/ProfileCard";
import type { ResearchProfileRow } from "@/lib/types";

type SortKey = "fitScore" | "commute" | "safety" | "rent";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "yes" | "maybe" | "no";

const DEFAULT_DIRS: Record<SortKey, SortDir> = {
  fitScore: "desc",
  commute: "asc",
  safety: "desc",
  rent: "asc",
};

export default function ResearchPage() {
  const [profiles, setProfiles] = useState<ResearchProfileRow[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("fitScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [minScore, setMinScore] = useState(0);

  useEffect(() => { fetch("/api/research").then((res) => res.json()).then(setProfiles); }, []);

  const filtered = useMemo(() => {
    let result = profiles.filter((p) => p.fitScore >= minScore);
    if (statusFilter !== "all") result = result.filter((p) => p.neighbourhood?.status === statusFilter);
    const dir = sortDir === "asc" ? 1 : -1;
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "fitScore": cmp = a.fitScore - b.fitScore; break;
        case "commute": cmp = a.transport.commuteMins - b.transport.commuteMins; break;
        case "safety": cmp = a.safety.score - b.safety.score; break;
        case "rent": cmp = a.rentValue.rangeLow - b.rentValue.rangeLow; break;
      }
      return cmp * dir;
    });
    return result;
  }, [profiles, sortBy, sortDir, statusFilter, minScore]);

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-bold text-[var(--text-primary)]">Research Profiles</h1>
      <div className="mb-6 flex flex-wrap gap-3">
        <select value={sortBy} onChange={(e) => { const key = e.target.value as SortKey; setSortBy(key); setSortDir(DEFAULT_DIRS[key]); }} className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)]">
          <option value="fitScore">Order by: Fit Score</option>
          <option value="commute">Order by: Commute</option>
          <option value="safety">Order by: Safety</option>
          <option value="rent">Order by: Rent</option>
        </select>
        <select value={sortDir} onChange={(e) => setSortDir(e.target.value as SortDir)} className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)]">
          <option value="desc">High → Low</option>
          <option value="asc">Low → High</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)]">
          <option value="all">Status: All</option>
          <option value="yes">Yes</option>
          <option value="maybe">Maybe</option>
          <option value="no">No</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          Min score:
          <input type="number" min={0} max={10} step={0.5} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="w-16 rounded bg-[var(--bg-secondary)] px-2 py-1 text-[var(--text-primary)]" />
        </label>
      </div>
      {filtered.length === 0 ? (
        <p className="text-[var(--text-muted)]">No research profiles yet. Mark neighbourhoods as &quot;Yes&quot; or &quot;Maybe&quot; on the map to trigger research.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((profile) => <ProfileCard key={profile.id} profile={profile} />)}</div>
      )}
    </div>
  );
}
