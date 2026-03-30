"use client";

import { useState, useMemo, useCallback } from "react";

interface Neighbourhood {
  id: string;
  name: string;
  borough: string;
  zone: number;
  postcodes: string;
  status: string | null;
  researchProfile?: { fitScore: number } | null;
  researchJobs?: { status: string }[];
}

interface Props {
  neighbourhoods: Neighbourhood[];
  onStatusChange: (id: string, status: string | null) => void;
  onBulkStatusChange: (ids: string[], status: string | null) => void;
  onResearch: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  yes: "bg-[var(--status-yes-bg)] text-[var(--status-yes)] border-[var(--status-yes)]",
  no: "bg-[var(--status-no-bg)] text-[var(--status-no)] border-[var(--status-no)]",
  maybe: "bg-[var(--status-maybe-bg)] text-[var(--status-maybe)] border-[var(--status-maybe)]",
};

export default function NeighbourhoodSelector({ neighbourhoods, onStatusChange, onBulkStatusChange, onResearch }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedZones, setCollapsedZones] = useState<Set<number>>(new Set());
  const [collapsedBoroughs, setCollapsedBoroughs] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const zones: Record<number, Record<string, Neighbourhood[]>> = {};
    for (const n of neighbourhoods) {
      if (!zones[n.zone]) zones[n.zone] = {};
      if (!zones[n.zone][n.borough]) zones[n.zone][n.borough] = [];
      zones[n.zone][n.borough].push(n);
    }
    return zones;
  }, [neighbourhoods]);

  const filteredZones = useMemo(() => {
    if (!searchQuery.trim()) return grouped;
    const q = searchQuery.toLowerCase();
    const result: Record<number, Record<string, Neighbourhood[]>> = {};
    for (const [zone, boroughs] of Object.entries(grouped)) {
      for (const [borough, items] of Object.entries(boroughs)) {
        const matched = items.filter(
          (n) => n.name.toLowerCase().includes(q) || n.borough.toLowerCase().includes(q) || n.postcodes.toLowerCase().includes(q)
        );
        if (matched.length > 0) {
          const z = Number(zone);
          if (!result[z]) result[z] = {};
          result[z][borough] = matched;
        }
      }
    }
    return result;
  }, [grouped, searchQuery]);

  const toggleZone = useCallback((zone: number) => {
    setCollapsedZones((prev) => { const next = new Set(prev); next.has(zone) ? next.delete(zone) : next.add(zone); return next; });
  }, []);

  const toggleBorough = useCallback((borough: string) => {
    setCollapsedBoroughs((prev) => { const next = new Set(prev); next.has(borough) ? next.delete(borough) : next.add(borough); return next; });
  }, []);

  function getGroupStatus(items: Neighbourhood[]): string | null {
    const statuses = new Set(items.map((n) => n.status));
    if (statuses.size === 1) return items[0].status;
    return null; // mixed
  }

  function renderGroupStatusButtons(items: Neighbourhood[]) {
    const groupStatus = getGroupStatus(items);
    const ids = items.map((n) => n.id);
    return (
      <div className="flex gap-1">
        {(["yes", "no", "maybe"] as const).map((s) => (
          <button
            key={s}
            onClick={(e) => { e.stopPropagation(); onBulkStatusChange(ids, groupStatus === s ? null : s); }}
            className={`rounded px-2 py-0.5 text-xs font-semibold border transition-opacity ${
              groupStatus === s ? STATUS_COLORS[s] : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-primary)] opacity-50 hover:opacity-80"
            }`}
          >
            {s[0].toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  function renderStatusButtons(neighbourhood: Neighbourhood) {
    return (
      <div className="flex gap-1">
        {(["yes", "no", "maybe"] as const).map((s) => (
          <button
            key={s}
            onClick={(e) => { e.stopPropagation(); onStatusChange(neighbourhood.id, neighbourhood.status === s ? null : s); }}
            className={`rounded px-2 py-0.5 text-xs font-semibold border transition-opacity ${
              neighbourhood.status === s ? STATUS_COLORS[s] : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-primary)] opacity-50 hover:opacity-80"
            }`}
          >
            {s[0].toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  const sortedZones = Object.keys(filteredZones).map(Number).sort((a, b) => a - b);

  return (
    <div className="flex h-full w-[340px] flex-col border-r border-[var(--border-primary)] bg-[var(--bg-secondary)]">
      <div className="border-b border-[var(--border-primary)] p-3">
        <input
          type="text"
          placeholder="Search areas, boroughs, postcodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {sortedZones.length === 0 && <p className="p-4 text-center text-sm text-[var(--text-muted)]">No results</p>}
        {sortedZones.map((zone) => {
          const boroughs = filteredZones[zone];
          const isZoneCollapsed = collapsedZones.has(zone);
          return (
            <div key={zone} className="mb-2">
              <button onClick={() => toggleZone(zone)} className="flex w-full items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                <span className={`text-[10px] transition-transform ${isZoneCollapsed ? "" : "rotate-90"}`}>▶</span>
                Zone {zone}
              </button>
              {!isZoneCollapsed && Object.entries(boroughs).sort(([a], [b]) => a.localeCompare(b)).map(([borough, items]) => {
                const isBoroughCollapsed = collapsedBoroughs.has(borough);
                return (
                  <div key={borough} className="ml-2">
                    <div className="flex items-center gap-1 rounded px-2 py-1.5 hover:bg-[var(--bg-hover)]">
                      <button onClick={() => toggleBorough(borough)} className="flex items-center gap-2 flex-1 text-sm text-[var(--text-secondary)]">
                        <span className={`text-[10px] transition-transform ${isBoroughCollapsed ? "" : "rotate-90"}`}>▶</span>
                        <span className="flex-1 text-left">{borough}</span>
                      </button>
                      {renderGroupStatusButtons(items)}
                    </div>
                    {!isBoroughCollapsed && (
                      <div className="ml-4 space-y-1 py-1">
                        {items.sort((a, b) => a.name.localeCompare(b.name)).map((n) => (
                          <div key={n.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-primary)] px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-[var(--text-primary)]">{n.name}</div>
                              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                                <span className="font-mono">{n.postcodes}</span>
                                {n.researchJobs?.[0]?.status === "running" && <span className="text-[var(--status-info)]">Researching...</span>}
                                {n.researchProfile && <span className="text-[var(--status-info)]">{n.researchProfile.fitScore.toFixed(1)}</span>}
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); onResearch(n.id); }}
                              title={n.researchProfile ? "Re-research" : "Research this area"}
                              disabled={n.researchJobs?.[0]?.status === "running"}
                              className={`shrink-0 rounded border px-2 py-1 text-xs font-medium transition-colors ${
                                n.researchJobs?.[0]?.status === "running"
                                  ? "border-[var(--border-primary)] text-[var(--text-muted)] cursor-not-allowed"
                                  : n.researchProfile
                                    ? "border-[var(--status-info)] text-[var(--status-info)] bg-[var(--status-info-bg)] hover:opacity-80"
                                    : "border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--status-info-bg)]"
                              }`}
                            >
                              {n.researchJobs?.[0]?.status === "running" ? "..." : n.researchProfile ? "Redo" : "Research"}
                            </button>
                            {renderStatusButtons(n)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
