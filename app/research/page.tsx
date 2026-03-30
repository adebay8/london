"use client";

import { useState, useEffect, useMemo } from "react";
import ProfileCard from "@/components/ProfileCard";
import type { ResearchProfileRow } from "@/lib/types";

type SortKey = "fitScore" | "commute" | "safety" | "rent";
type StatusFilter = "all" | "yes" | "maybe" | "no";

export default function ResearchPage() {
  const [profiles, setProfiles] = useState<ResearchProfileRow[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("fitScore");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [minScore, setMinScore] = useState(0);

  useEffect(() => { fetch("/api/research").then((res) => res.json()).then(setProfiles); }, []);

  const filtered = useMemo(() => {
    let result = profiles.filter((p) => p.fitScore >= minScore);
    if (statusFilter !== "all") result = result.filter((p) => p.neighbourhood?.status === statusFilter);
    result.sort((a, b) => {
      switch (sortBy) {
        case "fitScore": return b.fitScore - a.fitScore;
        case "commute": return a.transport.commuteMins - b.transport.commuteMins;
        case "safety": return b.safety.score - a.safety.score;
        case "rent": return a.rentValue.rangeLow - b.rentValue.rangeLow;
        default: return 0;
      }
    });
    return result;
  }, [profiles, sortBy, statusFilter, minScore]);

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-bold text-[var(--text-primary)]">Research Profiles</h1>
      <div className="mb-6 flex flex-wrap gap-3">
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)]">
          <option value="fitScore">Sort: Fit Score</option>
          <option value="commute">Sort: Commute</option>
          <option value="safety">Sort: Safety</option>
          <option value="rent">Sort: Rent (low)</option>
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
