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
  // User-collapsed: explicitly closed by clicking the toggle
  const [userCollapsedZones, setUserCollapsedZones] = useState<Set<number>>(new Set());
  const [userCollapsedBoroughs, setUserCollapsedBoroughs] = useState<Set<string>>(new Set());
  // Manually expanded: user opened an auto-collapsed (all-no) section
  const [manuallyExpandedZones, setManuallyExpandedZones] = useState<Set<number>>(new Set());
  const [manuallyExpandedBoroughs, setManuallyExpandedBoroughs] = useState<Set<string>>(new Set());

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

  function isAllNo(items: Neighbourhood[]): boolean {
    return items.length > 0 && items.every((n) => n.status === "no");
  }

  function isZoneCollapsed(zone: number, allItems: Neighbourhood[]): boolean {
    if (userCollapsedZones.has(zone)) return true;
    if (isAllNo(allItems) && !manuallyExpandedZones.has(zone)) return true;
    return false;
  }

  function isBoroughCollapsed(borough: string, items: Neighbourhood[]): boolean {
    if (userCollapsedBoroughs.has(borough)) return true;
    if (isAllNo(items) && !manuallyExpandedBoroughs.has(borough)) return true;
    return false;
  }

  const toggleZone = useCallback((zone: number) => {
    // Get all items in this zone to check if it's auto-collapsed
    const allItems = Object.values(grouped[zone] ?? {}).flat();
    const autoCollapsed = allItems.length > 0 && allItems.every((n) => n.status === "no");

    if (autoCollapsed) {
      // Toggle manual expansion for auto-collapsed zones
      setManuallyExpandedZones((prev) => {
        const next = new Set(prev);
        next.has(zone) ? next.delete(zone) : next.add(zone);
        return next;
      });
    } else {
      // Normal toggle
      setUserCollapsedZones((prev) => {
        const next = new Set(prev);
        next.has(zone) ? next.delete(zone) : next.add(zone);
        return next;
      });
    }
  }, [grouped]);

  const toggleBorough = useCallback((borough: string) => {
    // Find items for this borough across all zones
    let items: Neighbourhood[] = [];
    for (const boroughs of Object.values(grouped)) {
      if (boroughs[borough]) items = boroughs[borough];
    }
    const autoCollapsed = items.length > 0 && items.every((n) => n.status === "no");

    if (autoCollapsed) {
      setManuallyExpandedBoroughs((prev) => {
        const next = new Set(prev);
        next.has(borough) ? next.delete(borough) : next.add(borough);
        return next;
      });
    } else {
      setUserCollapsedBoroughs((prev) => {
        const next = new Set(prev);
        next.has(borough) ? next.delete(borough) : next.add(borough);
        return next;
      });
    }
  }, [grouped]);

  function getGroupStatus(items: Neighbourhood[]): string | null {
    const statuses = new Set(items.map((n) => n.status));
    if (statuses.size === 1) return items[0].status;
    return null;
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
          const allZoneItems = Object.values(boroughs).flat();
          const zoneCollapsed = isZoneCollapsed(zone, allZoneItems);

          return (
            <div key={zone} className="mb-2">
              {/* Zone header with Y/N/M buttons */}
              <div className="flex items-center gap-1 px-2 py-1">
                <button
                  onClick={() => toggleZone(zone)}
                  className="flex items-center gap-2 flex-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  <span className={`text-[10px] transition-transform ${zoneCollapsed ? "" : "rotate-90"}`}>▶</span>
                  Zone {zone}
                </button>
                {renderGroupStatusButtons(allZoneItems)}
              </div>

              {!zoneCollapsed && Object.entries(boroughs).sort(([a], [b]) => a.localeCompare(b)).map(([borough, items]) => {
                const boroughCollapsed = isBoroughCollapsed(borough, items);
                return (
                  <div key={borough} className="ml-2">
                    <div className="flex items-center gap-1 rounded px-2 py-1.5 hover:bg-[var(--bg-hover)]">
                      <button onClick={() => toggleBorough(borough)} className="flex items-center gap-2 flex-1 text-sm text-[var(--text-secondary)]">
                        <span className={`text-[10px] transition-transform ${boroughCollapsed ? "" : "rotate-90"}`}>▶</span>
                        <span className="flex-1 text-left">{borough}</span>
                      </button>
                      {renderGroupStatusButtons(items)}
                    </div>
                    {!boroughCollapsed && (
                      <div className="ml-4 space-y-1 py-1">
                        {items.sort((a, b) => a.name.localeCompare(b.name)).map((n) => (
                          <div key={n.id} className="flex items-center gap-3 rounded-lg bg-[var(--bg-primary)] px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm text-[var(--text-primary)]">{n.name}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onResearch(n.id); }}
                                  title={n.researchProfile ? "Re-research" : "Research this area"}
                                  disabled={n.researchJobs?.[0]?.status === "running"}
                                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] transition-all ${
                                    n.researchJobs?.[0]?.status === "running"
                                      ? "bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed animate-pulse"
                                      : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--accent)] hover:text-white"
                                  }`}
                                >
                                  {n.researchJobs?.[0]?.status === "running" ? "..." : "▶"}
                                </button>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                                <span className="font-mono">{n.postcodes}</span>
                                {n.researchJobs?.[0]?.status === "running" && <span className="text-[var(--status-info)]">Researching...</span>}
                                {n.researchProfile && <span className="text-[var(--status-info)]">{n.researchProfile.fitScore.toFixed(1)}</span>}
                              </div>
                            </div>
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
