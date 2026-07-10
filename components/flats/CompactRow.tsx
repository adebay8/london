"use client";

import { useState } from "react";
import type { Pref } from "@/lib/flat-search/types";
import type { EnrichedListing } from "@/lib/flat-search/view-model";

const TIMING: Record<string, { label: string; cls: string } | null> = {
  ideal: { label: "well-timed", cls: "yes" },
  workable: { label: "workable", cls: "info" },
  early: null,
  late: { label: "too late", cls: "no" },
  unknown: null,
};
const BUDGET: Record<string, { label: string; cls: string }> = {
  in: { label: "In budget", cls: "yes" },
  btr: { label: "BTR", cls: "info" },
  over: { label: "Over", cls: "maybe" },
};
const CHIP: Record<string, string> = {
  yes: "bg-[var(--status-yes-bg)] text-[var(--status-yes)]",
  no: "bg-[var(--status-no-bg)] text-[var(--status-no)]",
  maybe: "bg-[var(--status-maybe-bg)] text-[var(--status-maybe)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
  muted: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
};
function Chip({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium ${CHIP[cls] ?? CHIP.muted}`}>
      {label}
    </span>
  );
}

// A dense, column-aligned row for scanning/comparing many listings at once.
export default function CompactRow({
  listing,
  onPref,
  highlighted = false,
  cardRef,
}: {
  listing: EnrichedListing;
  onPref: (id: string, pref: Pref | null) => void;
  highlighted?: boolean;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  const [imgOk, setImgOk] = useState(true);
  const l = listing;
  const timing = TIMING[l.timingFit];
  const budget = BUDGET[l.budgetTier] ?? BUDGET.over;
  const wanted = l.pref === "want";
  const rejected = l.pref === "reject";
  const img = imgOk && l.imageUrl ? l.imageUrl : null;
  const avail = l.available && l.available !== "Ask agent" ? l.available : l.availableNow ? "Now" : "—";
  const furn = l.furnishing === "furnished" ? "Furnished" : l.furnishing === "unfurnished" ? "Unfurnished" : "Furn./unfurn.";

  return (
    <div
      ref={cardRef}
      className={`flex items-center gap-3 rounded-xl border bg-[var(--bg-primary)] p-2 pr-3 transition-all ${
        highlighted
          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]"
          : wanted
            ? "border-[var(--accent)]"
            : "border-[var(--border-primary)]"
      } ${rejected ? "opacity-55" : ""}`}
    >
      {/* thumbnail */}
      <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            loading="lazy"
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-secondary)] text-sm font-bold text-[var(--text-muted)]">
            {l.building.charAt(0)}
          </div>
        )}
      </div>

      {/* price */}
      <div className="w-16 shrink-0 text-right font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
        £{(l.price / 1000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}k
      </div>

      {/* building + street */}
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm font-medium text-[var(--text-primary)] ${rejected ? "line-through" : ""}`}>
          {l.building}
          {l.isNew && <span className="ml-1.5 align-middle text-[10px] font-semibold text-[var(--status-yes)]">NEW</span>}
        </div>
        <div className="truncate text-xs text-[var(--text-secondary)]">
          {l.scheme === "btr" ? (l.operator ? `BTR · ${l.operator}` : "BTR") : "Private"}
          {` · ${furn}`}
          {l.street ? ` · ${l.street}` : ""}
        </div>
      </div>

      {/* aligned status columns */}
      <div className="hidden w-24 shrink-0 sm:block">
        <Chip {...budget} />
      </div>
      <div className="hidden w-28 shrink-0 md:block">
        {timing ? <Chip {...timing} /> : <span className="text-[10px] text-[var(--text-muted)]">—</span>}
      </div>
      <div className="hidden w-32 shrink-0 truncate text-xs text-[var(--text-secondary)] lg:block">{avail}</div>

      {/* actions */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => onPref(l.id, wanted ? null : "want")}
          aria-label={wanted ? `Unsave ${l.building}` : `Save ${l.building}`}
          aria-pressed={wanted}
          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
            wanted ? "bg-[var(--accent)] text-white" : "text-[var(--accent)] hover:bg-[var(--bg-hover)]"
          }`}
        >
          {wanted ? "♥" : "♡"}
        </button>
        <button
          onClick={() => onPref(l.id, rejected ? null : "reject")}
          aria-label={rejected ? `Unhide ${l.building}` : `Hide ${l.building}`}
          aria-pressed={rejected}
          className="rounded px-1.5 py-0.5 text-xs text-[var(--text-secondary)] hover:text-[var(--status-no)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {rejected ? "Undo" : "Hide"}
        </button>
      </div>
    </div>
  );
}
