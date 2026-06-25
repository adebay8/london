"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import NeighbourhoodSelector from "@/components/NeighbourhoodSelector";

const LondonMap = dynamic(() => import("@/components/LondonMap"), { ssr: false, loading: () => <div className="flex-1 bg-[var(--bg-secondary)]" /> });

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

interface ApartmentBuilding {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  googleMapsUri: string;
  neighbourhood?: { name: string; borough: string };
}

const STATIONS = [
  { name: "Canning Town", lat: 51.5147, lng: 0.0082, lines: ["Jubilee", "Elizabeth"] },
  { name: "Bow Road", lat: 51.5270, lng: -0.0247, lines: ["District", "Hammersmith & City"] },
  { name: "Bromley-by-Bow", lat: 51.5248, lng: -0.0119, lines: ["District", "Hammersmith & City"] },
  { name: "Willesden Green", lat: 51.5492, lng: -0.2215, lines: ["Jubilee"] },
  { name: "Westminster", lat: 51.5013, lng: -0.1247, lines: ["Jubilee", "District", "Circle"] },
  { name: "West Hampstead", lat: 51.5469, lng: -0.1910, lines: ["Jubilee"] },
  { name: "Shepherd's Bush", lat: 51.5046, lng: -0.2187, lines: ["Central"] },
  { name: "Bermondsey", lat: 51.4979, lng: -0.0637, lines: ["Jubilee"] },
  { name: "Canada Water", lat: 51.4982, lng: -0.0498, lines: ["Jubilee", "Overground"] },
  { name: "South Acton", lat: 51.4994, lng: -0.2701, lines: ["Overground"] },
  { name: "Acton Main Line", lat: 51.5169, lng: -0.2674, lines: ["Elizabeth"] },
  { name: "North Acton", lat: 51.5237, lng: -0.2597, lines: ["Central"] },
  { name: "East Acton", lat: 51.5168, lng: -0.2474, lines: ["Central"] },
  { name: "Gunnersbury", lat: 51.4915, lng: -0.2754, lines: ["District", "Overground"] },
  { name: "White City", lat: 51.5120, lng: -0.2246, lines: ["Central"] },
];

export default function MapPage() {
  const [neighbourhoods, setNeighbourhoods] = useState<Neighbourhood[]>([]);
  const [apartments, setApartments] = useState<ApartmentBuilding[]>([]);
  const [showStations, setShowStations] = useState(true);
  const [apartmentsPanelOpen, setApartmentsPanelOpen] = useState(false);
  const [visibleApartmentNeighbourhoods, setVisibleApartmentNeighbourhoods] = useState<Set<string>>(new Set());
  const [scanningApartmentId, setScanningApartmentId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/neighbourhoods").then((res) => res.json()).then(setNeighbourhoods);
    fetch("/api/apartments").then((res) => res.json()).then((data: ApartmentBuilding[]) => {
      setApartments(data);
      // Default: all neighbourhoods visible
      const ids = new Set(data.map((a) => a.neighbourhood?.name).filter(Boolean) as string[]);
      setVisibleApartmentNeighbourhoods(ids);
    });
  }, []);

  const handleStatusChange = useCallback(async (id: string, status: string | null) => {
    setNeighbourhoods((prev) => prev.map((n) => (n.id === id ? { ...n, status } : n)));
    const res = await fetch("/api/neighbourhoods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      // Revert on failure — refetch
      const data = await fetch("/api/neighbourhoods").then((r) => r.json());
      setNeighbourhoods(data);
      return;
    }
  }, [neighbourhoods]);

  const handleBulkStatusChange = useCallback(async (ids: string[], status: string | null) => {
    // Optimistic update
    setNeighbourhoods((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, status } : n))
    );

    // Fire all PATCH requests in parallel
    const results = await Promise.all(
      ids.map((id) =>
        fetch("/api/neighbourhoods", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status }),
        })
      )
    );

    if (results.some((r) => !r.ok)) {
      const data = await fetch("/api/neighbourhoods").then((r) => r.json());
      setNeighbourhoods(data);
      return;
    }

  }, [neighbourhoods]);

  const handleResearch = useCallback(async (id: string) => {
    setNeighbourhoods((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, researchJobs: [{ status: "running" }] } : n
      )
    );
    await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neighbourhoodId: id }),
    });
  }, []);

  const handleScanApartment = useCallback(async (id: string) => {
    setScanningApartmentId(id);
    try {
      await fetch(`/api/apartments/${id}`, { method: "POST" });
    } finally {
      setScanningApartmentId(null);
    }
  }, []);

  // Group apartments by neighbourhood name for the filter panel
  const apartmentsByNeighbourhood = useMemo(() => {
    const groups: Record<string, ApartmentBuilding[]> = {};
    for (const a of apartments) {
      const name = a.neighbourhood?.name ?? "Unknown";
      if (!groups[name]) groups[name] = [];
      groups[name].push(a);
    }
    return groups;
  }, [apartments]);

  const filteredApartments = useMemo(() => {
    if (visibleApartmentNeighbourhoods.size === 0) return [];
    return apartments.filter((a) => {
      const name = a.neighbourhood?.name ?? "Unknown";
      return visibleApartmentNeighbourhoods.has(name);
    });
  }, [apartments, visibleApartmentNeighbourhoods]);

  const allApartmentNeighbourhoodsVisible = visibleApartmentNeighbourhoods.size === Object.keys(apartmentsByNeighbourhood).length;

  function toggleAllApartmentNeighbourhoods() {
    if (allApartmentNeighbourhoodsVisible) {
      setVisibleApartmentNeighbourhoods(new Set());
    } else {
      setVisibleApartmentNeighbourhoods(new Set(Object.keys(apartmentsByNeighbourhood)));
    }
  }

  function toggleApartmentNeighbourhood(name: string) {
    setVisibleApartmentNeighbourhoods((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  const selectedOptions: Record<string, string> = {};
  for (const n of neighbourhoods) {
    if (n.status) {
      for (const pc of n.postcodes.split(",").map((s) => s.trim())) {
        selectedOptions[pc] = n.status;
      }
    }
  }

  const districts = neighbourhoods.map((n) => ({
    location: n.name,
    borough: n.borough,
    postcodeDistrict: n.postcodes,
  }));

  return (
    <div className="flex h-full">
      <NeighbourhoodSelector neighbourhoods={neighbourhoods} onStatusChange={handleStatusChange} onBulkStatusChange={handleBulkStatusChange} onResearch={handleResearch} />
      <div className="relative flex-1">
        <LondonMap selectedOptions={selectedOptions} districts={districts} apartments={filteredApartments} stations={showStations ? STATIONS : []} onScanApartment={handleScanApartment} scanningApartmentId={scanningApartmentId} />
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-md cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showStations}
              onChange={(e) => setShowStations(e.target.checked)}
              className="accent-[#a855f7]"
            />
            Stations ({STATIONS.length})
          </label>
          {apartments.length > 0 && (
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] shadow-md">
              <button
                onClick={() => setApartmentsPanelOpen((p) => !p)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] select-none"
              >
                <input
                  type="checkbox"
                  checked={allApartmentNeighbourhoodsVisible}
                  onChange={(e) => { e.stopPropagation(); toggleAllApartmentNeighbourhoods(); }}
                  onClick={(e) => e.stopPropagation()}
                  className="accent-[#3b82f6]"
                />
                <span className="flex-1 text-left">Apartments ({filteredApartments.length})</span>
                <span className={`text-[10px] transition-transform ${apartmentsPanelOpen ? "rotate-90" : ""}`}>▶</span>
              </button>
              {apartmentsPanelOpen && (
                <div className="max-h-48 overflow-y-auto border-t border-[var(--border-primary)] px-1 py-1">
                  {Object.entries(apartmentsByNeighbourhood)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([name, items]) => (
                      <label
                        key={name}
                        className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={visibleApartmentNeighbourhoods.has(name)}
                          onChange={() => toggleApartmentNeighbourhood(name)}
                          className="accent-[#3b82f6]"
                        />
                        <span className="flex-1">{name}</span>
                        <span className="text-[var(--text-muted)]">{items.length}</span>
                      </label>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
