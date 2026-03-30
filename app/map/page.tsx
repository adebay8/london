"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function MapPage() {
  const [neighbourhoods, setNeighbourhoods] = useState<Neighbourhood[]>([]);

  useEffect(() => {
    fetch("/api/neighbourhoods").then((res) => res.json()).then(setNeighbourhoods);
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
      <div className="flex-1">
        <LondonMap selectedOptions={selectedOptions} districts={districts} />
      </div>
    </div>
  );
}
