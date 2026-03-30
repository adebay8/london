"use client";

import { useState, useEffect, useCallback } from "react";
import JournalEntryForm from "@/components/JournalEntryForm";
import JournalTimeline from "@/components/JournalTimeline";
import type { JournalEntryRow, NeighbourhoodRow } from "@/lib/types";

export default function JournalPage() {
  const [neighbourhoods, setNeighbourhoods] = useState<NeighbourhoodRow[]>([]);
  const [entries, setEntries] = useState<JournalEntryRow[]>([]);
  const [filterNeighbourhoodId, setFilterNeighbourhoodId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Fetch neighbourhoods once for the form dropdown
  useEffect(() => {
    fetch("/api/neighbourhoods")
      .then((res) => res.json())
      .then((data: NeighbourhoodRow[]) => {
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
        setNeighbourhoods(sorted);
      })
      .catch(console.error);
  }, []);

  // Fetch journal entries, re-fetching when filter changes
  const fetchEntries = useCallback((neighbourhoodId?: string) => {
    setLoading(true);
    const url = neighbourhoodId
      ? `/api/journal?neighbourhoodId=${encodeURIComponent(neighbourhoodId)}`
      : "/api/journal";
    fetch(url)
      .then((res) => res.json())
      .then((data: JournalEntryRow[]) => setEntries(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchEntries(filterNeighbourhoodId || undefined);
  }, [fetchEntries, filterNeighbourhoodId]);

  async function handleSubmit(data: {
    neighbourhoodId: string | null;
    content: string;
    decision: string | null;
  }) {
    let fitScoreSnapshot: number | null = null;

    // If neighbourhood selected, try to fetch its current fit score
    if (data.neighbourhoodId) {
      try {
        const res = await fetch(`/api/research/${data.neighbourhoodId}`);
        if (res.ok) {
          const profile = await res.json();
          fitScoreSnapshot = typeof profile.fitScore === "number" ? profile.fitScore : null;
        }
      } catch {
        // No research profile yet — continue without snapshot
      }
    }

    // POST new journal entry
    const res = await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        neighbourhoodId: data.neighbourhoodId,
        content: data.content,
        decision: data.decision,
        fitScoreSnapshot,
      }),
    });

    if (!res.ok) return;
    const newEntry: JournalEntryRow = await res.json();

    // Prepend to entries list (only if it matches the active filter)
    if (!filterNeighbourhoodId || newEntry.neighbourhoodId === filterNeighbourhoodId) {
      setEntries((prev) => [newEntry, ...prev]);
    }

    // If a decision was made, PATCH the neighbourhood status
    if (data.neighbourhoodId && data.decision) {
      try {
        await fetch("/api/neighbourhoods", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: data.neighbourhoodId, status: data.decision }),
        });
        // Refresh neighbourhoods list to reflect updated status
        const updated = await fetch("/api/neighbourhoods").then((r) => r.json());
        setNeighbourhoods([...updated].sort((a: NeighbourhoodRow, b: NeighbourhoodRow) => a.name.localeCompare(b.name)));
      } catch {
        // Status update failure is non-fatal
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-xl font-bold text-[var(--text-primary)]">Journal</h1>

      <JournalEntryForm neighbourhoods={neighbourhoods} onSubmit={handleSubmit} />

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-[var(--text-muted)] flex-shrink-0">Filter by neighbourhood:</label>
        <select
          value={filterNeighbourhoodId}
          onChange={(e) => setFilterNeighbourhoodId(e.target.value)}
          className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        >
          <option value="">All entries</option>
          {neighbourhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name} ({n.borough})
            </option>
          ))}
        </select>
      </div>

      {/* Timeline */}
      {loading ? (
        <p className="text-sm text-[var(--text-muted)] py-4">Loading entries...</p>
      ) : (
        <JournalTimeline entries={entries} />
      )}
    </div>
  );
}
