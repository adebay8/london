"use client";

import { useState, useEffect, useCallback } from "react";
import ProfileCard from "@/components/ProfileCard";
import type { ResearchProfileRow } from "@/lib/types";

interface RankedItem {
  id: string;
  neighbourhoodId: string;
  position: number;
  neighbourhood: {
    id: string;
    name: string;
    borough: string;
    zone: number;
    status: string | null;
    researchProfile: ResearchProfileRow | null;
  };
}

export default function RankingsPage() {
  const [rankings, setRankings] = useState<RankedItem[]>([]);
  const [allProfiles, setAllProfiles] = useState<ResearchProfileRow[]>([]);
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/rankings").then((r) => r.json()).then(setRankings);
    fetch("/api/research").then((r) => r.json()).then(setAllProfiles);
  }, []);

  const rankedIds = new Set(rankings.map((r) => r.neighbourhoodId));
  const unrankedProfiles = allProfiles.filter((p) => !rankedIds.has(p.neighbourhoodId));

  const addToRanking = useCallback(async (neighbourhoodId: string) => {
    await fetch("/api/rankings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neighbourhoodId }),
    });
    const updated = await fetch("/api/rankings").then((r) => r.json());
    setRankings(updated);
    setAddPickerOpen(false);
  }, []);

  const removeFromRanking = useCallback(async (neighbourhoodId: string) => {
    await fetch("/api/rankings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neighbourhoodId }),
    });
    const updated = await fetch("/api/rankings").then((r) => r.json());
    setRankings(updated);
  }, []);

  const moveItem = useCallback(async (fromIndex: number, toIndex: number) => {
    const reordered = [...rankings];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setRankings(reordered);

    await fetch("/api/rankings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((r) => r.neighbourhoodId) }),
    });
  }, [rankings]);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">My Rankings</h1>
          <p className="text-sm text-[var(--text-muted)]">Your handpicked neighbourhood ranking. Drag to reorder.</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setAddPickerOpen(!addPickerOpen)}
            disabled={unrankedProfiles.length === 0}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Add neighbourhood
          </button>
          {addPickerOpen && unrankedProfiles.length > 0 && (
            <div className="absolute right-0 z-10 mt-2 max-h-72 w-64 overflow-y-auto rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] shadow-lg">
              {unrankedProfiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToRanking(p.neighbourhoodId)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--bg-hover)]"
                >
                  <span className="text-[var(--text-primary)]">
                    {p.neighbourhood?.name}
                    <span className="ml-1 text-[var(--text-muted)]">— {p.neighbourhood?.borough}</span>
                  </span>
                  <span className="text-xs text-[var(--accent)]">{p.fitScore.toFixed(1)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {rankings.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-8 text-center">
          <p className="text-[var(--text-muted)]">No rankings yet. Research some neighbourhoods, then add them here to build your personal ranking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rankings.map((r, index) => {
            const profile = r.neighbourhood.researchProfile;
            if (!profile) return null;

            const profileRow: ResearchProfileRow = {
              ...profile,
              neighbourhoodId: r.neighbourhoodId,
              neighbourhood: {
                id: r.neighbourhood.id,
                name: r.neighbourhood.name,
                borough: r.neighbourhood.borough,
                zone: r.neighbourhood.zone,
                postcodes: "",
                status: r.neighbourhood.status,
                updatedAt: "",
              },
            };

            return (
              <div
                key={r.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== index) {
                    moveItem(dragIndex, index);
                  }
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={`flex items-stretch gap-3 rounded-xl border transition-colors ${
                  dragIndex === index
                    ? "border-[var(--accent)] bg-[var(--bg-hover)]"
                    : "border-[var(--border-primary)] bg-[var(--bg-secondary)]"
                }`}
              >
                {/* Rank number + drag handle */}
                <div className="flex w-14 flex-col items-center justify-center border-r border-[var(--border-primary)] cursor-grab active:cursor-grabbing">
                  <span className="text-2xl font-bold text-[var(--accent)]">#{index + 1}</span>
                  <span className="text-xs text-[var(--text-muted)]">drag</span>
                </div>

                {/* Profile card */}
                <div className="flex-1 py-2 pr-2">
                  <ProfileCard profile={profileRow} />
                </div>

                {/* Move buttons + remove */}
                <div className="flex flex-col items-center justify-center gap-1 pr-3">
                  <button
                    onClick={() => index > 0 && moveItem(index, index - 1)}
                    disabled={index === 0}
                    className="rounded px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] disabled:opacity-30"
                    title="Move up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => index < rankings.length - 1 && moveItem(index, index + 1)}
                    disabled={index === rankings.length - 1}
                    className="rounded px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] disabled:opacity-30"
                    title="Move down"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => removeFromRanking(r.neighbourhoodId)}
                    className="rounded px-2 py-1 text-xs text-[var(--status-no)] hover:bg-[var(--bg-hover)]"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
