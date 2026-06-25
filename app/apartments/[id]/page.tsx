"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { ApartmentBuildingRow, BuildingAmenityRow, RentScore } from "@/lib/types";
import { calculateTotalMonthlyCost, BANDS, DEFAULT_COMMUTE_DAYS, type Band } from "@/data/cost-data";

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  grocery: { label: "Grocery Stores", icon: "🛒" },
  station: { label: "Train / Tube Stations", icon: "🚇" },
  bus: { label: "Bus Stops", icon: "🚌" },
  cafe: { label: "Cafes & Quick Food", icon: "☕" },
  convenience: { label: "Convenience & Pharmacy", icon: "🏪" },
};

const CATEGORY_ORDER = ["grocery", "station", "bus", "cafe", "convenience"];

interface BuildingWithRent extends ApartmentBuildingRow {
  neighbourhood?: ApartmentBuildingRow["neighbourhood"] & {
    researchProfile?: { rentValue: RentScore } | null;
  };
}

export default function BuildingDetailPage() {
  const params = useParams<{ id: string }>();
  const [building, setBuilding] = useState<BuildingWithRent | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [band, setBand] = useState<Band>("C");
  const [singlePerson, setSinglePerson] = useState(false);
  const [commuteDays, setCommuteDays] = useState(DEFAULT_COMMUTE_DAYS);

  function fetchBuilding() {
    setLoading(true);
    fetch(`/api/apartments/${params.id}`)
      .then((r) => r.json())
      .then((data) => { setBuilding(data); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { fetchBuilding(); }, [params.id]);

  async function handleScan() {
    setScanning(true);
    try {
      await fetch(`/api/apartments/${params.id}`, { method: "POST" });
      fetchBuilding();
    } finally {
      setScanning(false);
    }
  }

  const amenitiesByCategory = useMemo(() => {
    if (!building?.amenities) return {};
    const grouped: Record<string, BuildingAmenityRow[]> = {};
    for (const a of building.amenities) {
      if (!grouped[a.category]) grouped[a.category] = [];
      grouped[a.category].push(a);
    }
    return grouped;
  }, [building?.amenities]);

  const hasAmenities = building?.amenities && building.amenities.length > 0;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading...</p>
      </div>
    );
  }

  if (!building) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[var(--text-muted)]">Building not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/apartments" className="text-xs text-[var(--accent)] hover:underline">
          ← Back to apartments
        </Link>
        <h1 className="mt-2 text-xl font-bold text-[var(--text-primary)]">{building.name}</h1>
        <p className="text-sm text-[var(--text-muted)]">{building.address}</p>
        {building.neighbourhood && (
          <p className="text-xs text-[var(--text-secondary)]">
            {building.neighbourhood.name} · {building.neighbourhood.borough} · Zone {building.neighbourhood.zone}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3">
          <a
            href={building.googleMapsUri}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            View on Google Maps ↗
          </a>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {scanning ? "Scanning..." : hasAmenities ? "Rescan Amenities" : "Scan Amenities"}
          </button>
        </div>
      </div>

      {/* Cost Estimate */}
      {building.neighbourhood && (() => {
        const rentValue = building.neighbourhood.researchProfile?.rentValue;
        const borough = building.neighbourhood.borough;
        const zone = building.neighbourhood.zone;
        const costs = rentValue
          ? calculateTotalMonthlyCost(rentValue.rangeLow, rentValue.rangeHigh, borough, zone, band, singlePerson, commuteDays)
          : null;
        return (
          <div className="mb-6 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-5">
            <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Monthly Cost Estimate</h2>
            {costs ? (
              <>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Rent (est.)</span>
                    <span className="text-[var(--text-primary)]">
                      {costs.rentLow === costs.rentHigh
                        ? `£${costs.rentLow.toLocaleString()}`
                        : `£${costs.rentLow.toLocaleString()} – £${costs.rentHigh.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">
                      Council Tax (Band {band}, {borough})
                    </span>
                    <span className="text-[var(--text-primary)]">£{costs.councilTax}/mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Commute (Zone 1–{zone}, {commuteDays}d/wk)</span>
                    <span className="text-[var(--text-primary)]">£{costs.commute}/mo</span>
                  </div>
                  <div className="border-t border-[var(--border-primary)] pt-2 flex justify-between font-semibold">
                    <span className="text-[var(--text-primary)]">Total</span>
                    <span className="text-[var(--text-primary)]">
                      {costs.totalLow === costs.totalHigh
                        ? `£${costs.totalLow.toLocaleString()}/mo`
                        : `£${costs.totalLow.toLocaleString()} – £${costs.totalHigh.toLocaleString()}/mo`}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    Band:
                    <select
                      value={band}
                      onChange={(e) => setBand(e.target.value as Band)}
                      className="rounded bg-[var(--bg-secondary)] px-2 py-1 text-xs text-[var(--text-primary)]"
                    >
                      {BANDS.map((b) => (
                        <option key={b} value={b}>Band {b}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    Office days:
                    <select
                      value={commuteDays}
                      onChange={(e) => setCommuteDays(Number(e.target.value))}
                      className="rounded bg-[var(--bg-secondary)] px-2 py-1 text-xs text-[var(--text-primary)]"
                    >
                      {[1, 2, 3, 4, 5].map((d) => (
                        <option key={d} value={d}>{d} day{d !== 1 ? "s" : ""}/wk</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={singlePerson}
                      onChange={(e) => setSinglePerson(e.target.checked)}
                    />
                    Single person (-25%)
                  </label>
                </div>
              </>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">Run research for this neighbourhood to see rent estimates.</p>
            )}
          </div>
        );
      })()}

      {/* Amenity panels */}
      {!hasAmenities ? (
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-8 text-center">
          <p className="text-[var(--text-muted)]">No amenity data yet. Click Scan to analyse what&apos;s nearby.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {CATEGORY_ORDER.map((cat) => {
            const items = amenitiesByCategory[cat] ?? [];
            const meta = CATEGORY_LABELS[cat] ?? { label: cat, icon: "📍" };
            return (
              <div
                key={cat}
                className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-5"
              >
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <span>{meta.icon}</span>
                  {meta.label}
                  <span className="ml-auto rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                    {items.length}
                  </span>
                </h3>
                {items.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">None found within 800m</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((a) => (
                      <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-[var(--text-primary)]">{a.name}</div>
                          <div className="truncate text-xs text-[var(--text-muted)]">{a.address}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1 whitespace-nowrap">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">{a.walkMins} min</span>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&origin=${building.lat},${building.lng}&destination=${a.lat},${a.lng}&travelmode=walking`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-[var(--accent)] hover:underline"
                          >
                            Walk route ↗
                          </a>
                        </div>
                      </div>
                    ))}
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
