"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import type { ApartmentBuildingRow, NeighbourhoodRow } from "@/lib/types";

export default function ApartmentsPage() {
  const [buildings, setBuildings] = useState<ApartmentBuildingRow[]>([]);
  const [neighbourhoods, setNeighbourhoods] = useState<NeighbourhoodRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [boroughFilter, setBoroughFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [neighbourhoodFilter, setNeighbourhoodFilter] = useState("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedNeighbourhoodId, setSelectedNeighbourhoodId] = useState("");
  const [neighbourhoodSearch, setNeighbourhoodSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [searchRadius, setSearchRadius] = useState(0);
  const [directSearch, setDirectSearch] = useState("");
  const [directSearchResults, setDirectSearchResults] = useState<{ placeId: string; name: string; address: string; lat: number; lng: number; googleMapsUri: string; types: string[]; alreadySaved: boolean }[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingPlaceId, setAddingPlaceId] = useState<string | null>(null);
  const [assignNeighbourhoodId, setAssignNeighbourhoodId] = useState("");
  const [assignSearch, setAssignSearch] = useState("");
  const [assignPickerOpenFor, setAssignPickerOpenFor] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const assignPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
      if (assignPickerRef.current && !assignPickerRef.current.contains(e.target as Node)) {
        setAssignPickerOpenFor(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetch("/api/apartments").then((r) => r.json()).then(setBuildings);
    fetch("/api/neighbourhoods").then((r) => r.json()).then(setNeighbourhoods);
  }, []);

  async function handleFetch() {
    if (!selectedNeighbourhoodId || fetchingId) return;
    setFetchingId(selectedNeighbourhoodId);
    try {
      await fetch("/api/apartments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ neighbourhoodId: selectedNeighbourhoodId, radius: searchRadius || undefined }),
      });
      const updated = await fetch("/api/apartments").then((r) => r.json());
      setBuildings(updated);
    } finally {
      setFetchingId(null);
    }
  }

  async function handleDirectSearch() {
    if (!directSearch.trim() || searching) return;
    setSearching(true);
    try {
      const res = await fetch("/api/apartments/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: directSearch }),
      });
      setDirectSearchResults(await res.json());
    } finally {
      setSearching(false);
    }
  }

  async function handleAddBuilding(place: typeof directSearchResults[0]) {
    if (!assignNeighbourhoodId || addingPlaceId) return;
    setAddingPlaceId(place.placeId);
    try {
      await fetch("/api/apartments/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ neighbourhoodId: assignNeighbourhoodId, ...place }),
      });
      // Refresh buildings list and mark as saved in search results
      const updated = await fetch("/api/apartments").then((r) => r.json());
      setBuildings(updated);
      setDirectSearchResults((prev) => prev.map((r) => r.placeId === place.placeId ? { ...r, alreadySaved: true } : r));
    } finally {
      setAddingPlaceId(null);
    }
  }

  const boroughs = useMemo(() => {
    const set = new Set(neighbourhoods.map((n) => n.borough));
    return Array.from(set).sort();
  }, [neighbourhoods]);

  const zones = useMemo(() => {
    const set = new Set(neighbourhoods.map((n) => n.zone));
    return Array.from(set).sort((a, b) => a - b);
  }, [neighbourhoods]);

  // Neighbourhoods that have cached buildings
  const neighbourhoodsWithBuildings = useMemo(() => {
    const ids = new Set(buildings.map((b) => b.neighbourhoodId));
    return ids;
  }, [buildings]);

  const neighbourhoodNames = useMemo(() => {
    const names = new Set(buildings.map((b) => b.neighbourhood?.name).filter(Boolean) as string[]);
    return Array.from(names).sort();
  }, [buildings]);

  const filtered = useMemo(() => {
    let result = buildings;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) => b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q)
      );
    }
    if (boroughFilter !== "all") {
      result = result.filter((b) => b.neighbourhood?.borough === boroughFilter);
    }
    if (zoneFilter !== "all") {
      result = result.filter((b) => b.neighbourhood?.zone === Number(zoneFilter));
    }
    if (neighbourhoodFilter !== "all") {
      result = result.filter((b) => b.neighbourhood?.name === neighbourhoodFilter);
    }
    return result;
  }, [buildings, searchQuery, boroughFilter, zoneFilter, neighbourhoodFilter]);

  const filteredNeighbourhoods = useMemo(() => {
    if (!neighbourhoodSearch.trim()) return neighbourhoods;
    const q = neighbourhoodSearch.toLowerCase();
    return neighbourhoods.filter(
      (n) => n.name.toLowerCase().includes(q) || n.borough.toLowerCase().includes(q)
    );
  }, [neighbourhoods, neighbourhoodSearch]);

  const groupedFiltered = useMemo(() => {
    const groups: { name: string; borough: string; zone: number; items: ApartmentBuildingRow[] }[] = [];
    const map = new Map<string, ApartmentBuildingRow[]>();
    for (const b of filtered) {
      const key = b.neighbourhoodId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    for (const [nId, items] of map) {
      const n = items[0].neighbourhood;
      groups.push({
        name: n?.name ?? "Unknown",
        borough: n?.borough ?? "",
        zone: n?.zone ?? 0,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      });
    }
    return groups.sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  function toggleGroup(name: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  const filteredAssignNeighbourhoods = useMemo(() => {
    if (!assignSearch.trim()) return neighbourhoods;
    const q = assignSearch.toLowerCase();
    return neighbourhoods.filter(
      (n) => n.name.toLowerCase().includes(q) || n.borough.toLowerCase().includes(q)
    );
  }, [neighbourhoods, assignSearch]);

  const assignedNeighbourhood = neighbourhoods.find((n) => n.id === assignNeighbourhoodId);

  const selectedNeighbourhood = neighbourhoods.find((n) => n.id === selectedNeighbourhoodId);
  const selectedName = selectedNeighbourhood?.name ?? "";

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-bold text-[var(--text-primary)]">Apartment Buildings</h1>

      {/* Fetch controls */}
      <div className="mb-6 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div ref={pickerRef} className="relative flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs text-[var(--text-muted)]">Fetch apartments for</label>
            <input
              type="text"
              placeholder={selectedNeighbourhood ? `${selectedName} — ${selectedNeighbourhood.borough}` : "Search neighbourhoods..."}
              value={neighbourhoodSearch}
              onChange={(e) => { setNeighbourhoodSearch(e.target.value); setPickerOpen(true); }}
              onFocus={() => setPickerOpen(true)}
              className="w-full rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]"
            />
            {pickerOpen && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] shadow-lg">
                {filteredNeighbourhoods.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-[var(--text-muted)]">No matches</div>
                ) : (
                  filteredNeighbourhoods.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setSelectedNeighbourhoodId(n.id);
                        setNeighbourhoodSearch("");
                        setPickerOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--bg-hover)] ${
                        n.id === selectedNeighbourhoodId ? "bg-[var(--bg-tertiary)]" : ""
                      }`}
                    >
                      <span className="text-[var(--text-primary)]">
                        {n.name} <span className="text-[var(--text-muted)]">— {n.borough} (Zone {n.zone})</span>
                      </span>
                      {neighbourhoodsWithBuildings.has(n.id) && (
                        <span className="text-xs text-[var(--status-yes)]">✓</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-muted)]">Radius</label>
            <select
              value={searchRadius}
              onChange={(e) => setSearchRadius(Number(e.target.value))}
              className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value={0}>Default</option>
              <option value={1000}>1 km</option>
              <option value={2000}>2 km</option>
              <option value={5000}>5 km</option>
            </select>
          </div>
          <button
            onClick={handleFetch}
            disabled={!selectedNeighbourhoodId || !!fetchingId}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {fetchingId ? `Fetching${selectedName ? ` ${selectedName}` : ""}...` : "Fetch"}
          </button>
        </div>
      </div>

      {/* Direct name search */}
      <div className="mb-6 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
        <label className="mb-2 block text-xs text-[var(--text-muted)]">Search by development name</label>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="e.g. Royal Wharf, Battersea Power Station..."
            value={directSearch}
            onChange={(e) => setDirectSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleDirectSearch()}
            className="flex-1 rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]"
          />
          <button
            onClick={handleDirectSearch}
            disabled={!directSearch.trim() || searching}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>
        {directSearchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {directSearchResults.map((r) => (
              <div key={r.placeId} className="flex items-center gap-3 rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[var(--text-primary)]">{r.name}</div>
                  <div className="truncate text-xs text-[var(--text-muted)]">{r.address}</div>
                </div>
                {r.alreadySaved ? (
                  <span className="text-xs text-[var(--status-yes)]">Saved</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <div ref={assignPickerOpenFor === r.placeId ? assignPickerRef : undefined} className="relative">
                      <input
                        type="text"
                        placeholder={assignedNeighbourhood ? assignedNeighbourhood.name : "Add to..."}
                        value={assignPickerOpenFor === r.placeId ? assignSearch : ""}
                        onChange={(e) => { setAssignSearch(e.target.value); setAssignPickerOpenFor(r.placeId); }}
                        onFocus={() => setAssignPickerOpenFor(r.placeId)}
                        className="w-36 rounded bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                      />
                      {assignPickerOpenFor === r.placeId && (
                        <div className="absolute right-0 z-20 mt-1 max-h-48 w-52 overflow-y-auto rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] shadow-lg">
                          {filteredAssignNeighbourhoods.length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-[var(--text-muted)]">No matches</div>
                          ) : (
                            filteredAssignNeighbourhoods.map((n) => (
                              <button
                                key={n.id}
                                onClick={() => {
                                  setAssignNeighbourhoodId(n.id);
                                  setAssignSearch("");
                                  setAssignPickerOpenFor(null);
                                }}
                                className={`flex w-full items-center px-2 py-1.5 text-left text-xs hover:bg-[var(--bg-hover)] ${n.id === assignNeighbourhoodId ? "bg-[var(--bg-tertiary)]" : ""}`}
                              >
                                {n.name} <span className="ml-1 text-[var(--text-muted)]">— {n.borough}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleAddBuilding(r)}
                      disabled={!assignNeighbourhoodId || addingPlaceId === r.placeId}
                      className="rounded bg-[var(--accent)] px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {addingPlaceId === r.placeId ? "..." : "Add"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter controls */}
      <div className="mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] min-w-[220px]"
        />
        <select
          value={boroughFilter}
          onChange={(e) => setBoroughFilter(e.target.value)}
          className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          <option value="all">Borough: All</option>
          {boroughs.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          <option value="all">Zone: All</option>
          {zones.map((z) => (
            <option key={z} value={String(z)}>Zone {z}</option>
          ))}
        </select>
        <select
          value={neighbourhoodFilter}
          onChange={(e) => setNeighbourhoodFilter(e.target.value)}
          className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          <option value="all">Neighbourhood: All</option>
          {neighbourhoodNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span className="flex items-center text-sm text-[var(--text-muted)]">
          {filtered.length} building{filtered.length !== 1 ? "s" : ""}
          {neighbourhoodsWithBuildings.size > 0 && ` across ${neighbourhoodsWithBuildings.size} neighbourhood${neighbourhoodsWithBuildings.size !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Results grouped by neighbourhood */}
      {filtered.length === 0 ? (
        <p className="text-[var(--text-muted)]">
          {buildings.length === 0
            ? "No apartment buildings cached yet. Select a neighbourhood above and click Fetch to get started."
            : "No buildings match your filters."}
        </p>
      ) : (
        <div className="space-y-4">
          {groupedFiltered.map((group) => {
            const isCollapsed = collapsedGroups.has(group.name);
            return (
              <div key={group.name} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <button
                  onClick={() => toggleGroup(group.name)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className={`text-[10px] text-[var(--text-muted)] transition-transform ${isCollapsed ? "" : "rotate-90"}`}>▶</span>
                  <span className="flex-1 text-sm font-semibold text-[var(--text-primary)]">{group.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">{group.borough} · Zone {group.zone}</span>
                  <span className="rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs text-[var(--text-muted)]">{group.items.length}</span>
                </button>
                {!isCollapsed && (
                  <div className="grid grid-cols-1 gap-3 px-4 pb-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((b) => {
                      const nearestGrocery = b.amenities?.find((a) => a.category === "grocery");
                      const nearestStation = b.amenities?.find((a) => a.category === "station");
                      const hasAmenities = b.amenities && b.amenities.length > 0;
                      return (
                        <div
                          key={b.id}
                          className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3"
                        >
                          <div className="mb-1 text-sm font-medium text-[var(--text-primary)]">{b.name}</div>
                          <div className="mb-2 text-xs text-[var(--text-muted)]">{b.address}</div>
                          {hasAmenities && (
                            <div className="mb-2 text-xs text-[var(--text-secondary)]">
                              {nearestGrocery && <span>{nearestGrocery.name} {nearestGrocery.walkMins} min</span>}
                              {nearestGrocery && nearestStation && <span> · </span>}
                              {nearestStation && <span>Station {nearestStation.walkMins} min</span>}
                            </div>
                          )}
                          <div className="flex items-center gap-3">
                            <a
                              href={b.googleMapsUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-[var(--accent)] hover:underline"
                            >
                              Google Maps ↗
                            </a>
                            <Link
                              href={`/apartments/${b.id}`}
                              className="text-xs font-medium text-[var(--accent)] hover:underline"
                            >
                              {hasAmenities ? "View details" : "Scan & details"} →
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
