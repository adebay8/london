"use client";

import { useState } from "react";
import type { EnrichedListing } from "@/lib/flat-search/view-model";

const SCHEME_BADGE = (l: EnrichedListing) =>
  l.scheme === "btr"
    ? { label: l.operator ? `BTR · ${l.operator}` : "BTR", cls: "info" }
    : { label: l.scheme === "private" ? "Private" : "—", cls: "muted" };

const TIMING = {
  ideal: { label: "well-timed", cls: "yes" },
  workable: { label: "workable", cls: "info" },
  early: { label: "early", cls: "muted" },
  late: { label: "too late", cls: "no" },
  unknown: null,
} as const;

const CHIP: Record<string, string> = {
  yes: "bg-[var(--status-yes-bg)] text-[var(--status-yes)]",
  no: "bg-[var(--status-no-bg)] text-[var(--status-no)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
  maybe: "bg-[var(--status-maybe-bg)] text-[var(--status-maybe)]",
  muted: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
};

function Chip({ label, cls }: { label: string; cls: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${CHIP[cls] ?? CHIP.muted}`}>{label}</span>;
}

export default function PickCard({
  listing,
  areaName,
  tierLabel,
  onOpen,
}: {
  listing: EnrichedListing;
  areaName: string;
  tierLabel: string;
  onOpen: (l: EnrichedListing) => void;
}) {
  const [imgOk, setImgOk] = useState(true);
  const l = listing;
  const img = imgOk && l.imageUrl ? l.imageUrl.replace("/u/480/360/", "/u/720/540/") : null;
  const scheme = SCHEME_BADGE(l);
  const timing = TIMING[l.timingFit];

  return (
    <button
      onClick={() => onOpen(l)}
      aria-label={`View ${l.building}, £${l.price.toLocaleString()}, in Homes`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] text-left transition-all hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <div className="relative h-36 w-full overflow-hidden">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={l.building}
            loading="lazy"
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-secondary)]">
            <span className="text-4xl font-bold text-[var(--text-muted)]">{l.building.charAt(0)}</span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          {tierLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-bold text-[var(--text-primary)]">£{l.price.toLocaleString()}</span>
          <span className="text-xs font-medium text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100">
            View →
          </span>
        </div>
        <div className="text-sm font-medium text-[var(--text-primary)]">{l.building}</div>
        <div className="text-xs text-[var(--text-secondary)]">
          {areaName}
          {l.phaseYear ? ` · ${l.phaseYear}` : ""}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          <Chip {...scheme} />
          {timing && <Chip {...timing} />}
          {l.isNew && <Chip label="NEW" cls="yes" />}
        </div>
      </div>
    </button>
  );
}
