"use client";

import { useState } from "react";
import type { Pref } from "@/lib/flat-search/types";
import type { EnrichedListing } from "@/lib/flat-search/view-model";

const BUDGET_BADGE: Record<string, { label: string; bg: string }> = {
  in: { label: "In budget", bg: "var(--status-yes)" },
  btr: { label: "BTR band", bg: "var(--accent)" },
  over: { label: "Over budget", bg: "var(--status-maybe)" },
};

// Only surface timing when it's decision-relevant (skip the noisy early/unknown).
const TIMING_CHIP: Record<string, { label: string; cls: string } | null> = {
  ideal: { label: "well-timed", cls: "yes" },
  workable: { label: "workable", cls: "info" },
  early: null,
  late: { label: "too late", cls: "no" },
  unknown: null,
};

const STALE_CHIP: Record<string, { label: string; cls: string } | null> = {
  ok: null,
  slow: { label: "slow to let", cls: "maybe" },
  stale: { label: "stale", cls: "maybe" },
  problem: { label: "long-listed", cls: "no" },
};

const CHIP: Record<string, string> = {
  yes: "bg-[var(--status-yes-bg)] text-[var(--status-yes)]",
  no: "bg-[var(--status-no-bg)] text-[var(--status-no)]",
  maybe: "bg-[var(--status-maybe-bg)] text-[var(--status-maybe)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
  muted: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
};

function Chip({ label, cls }: { label: string; cls: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CHIP[cls] ?? CHIP.muted}`}>{label}</span>;
}

export default function FlatCard({
  listing,
  areaName,
  onPref,
  highlighted = false,
  cardRef,
}: {
  listing: EnrichedListing;
  areaName: string;
  onPref: (id: string, pref: Pref | null) => void;
  highlighted?: boolean;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  const [imgOk, setImgOk] = useState(true);
  const l = listing;
  const budget = BUDGET_BADGE[l.budgetTier] ?? BUDGET_BADGE.over;
  const timing = TIMING_CHIP[l.timingFit];
  const stale = STALE_CHIP[l.staleTier];
  const rejected = l.pref === "reject";
  const wanted = l.pref === "want";
  const gone = l.status === "gone";
  const img = imgOk && l.imageUrl ? l.imageUrl.replace("/u/480/360/", "/u/720/540/") : null;

  const meta = [
    l.available && l.available !== "Ask agent" ? `Avail. ${l.available}` : null,
    l.sizeSqft ? `${l.sizeSqft} sqft` : null,
    l.epc ? `EPC ${l.epc}` : null,
    l.phaseYear ? `${l.phaseYear}` : null,
    l.daysOnMarket != null && l.availableNow ? `${l.daysOnMarket}d listed` : null,
  ].filter(Boolean);

  return (
    <div
      ref={cardRef}
      className={`flex flex-col overflow-hidden rounded-2xl border bg-[var(--bg-primary)] transition-all hover:shadow-md ${
        highlighted
          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]"
          : wanted
            ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
            : "border-[var(--border-primary)]"
      } ${rejected ? "opacity-55" : ""}`}
    >
      {/* Image (or graceful fallback) with budget badge + save overlay */}
      <div className="relative h-44 w-full overflow-hidden">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={l.building}
            loading="lazy"
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-secondary)]">
            <span className="text-4xl font-bold text-[var(--text-muted)]">{l.building.charAt(0)}</span>
          </div>
        )}
        <span
          className="absolute left-2 top-2 rounded-md px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm"
          style={{ backgroundColor: budget.bg }}
        >
          {budget.label}
        </span>
        <button
          onClick={() => onPref(l.id, wanted ? null : "want")}
          aria-label={wanted ? `Unsave ${l.building}` : `Save ${l.building}`}
          aria-pressed={wanted}
          title={wanted ? "Saved" : "Save"}
          className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-sm backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
            wanted ? "bg-[var(--accent)] text-white" : "bg-black/45 text-white hover:bg-black/65"
          }`}
        >
          {wanted ? "♥" : "♡"}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xl font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
            £{l.price.toLocaleString()}
          </span>
          {l.isNew && <Chip label="NEW" cls="yes" />}
        </div>

        <div>
          <div className={`text-sm font-medium text-[var(--text-primary)] ${rejected ? "line-through" : ""}`}>
            {l.building}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            {areaName}
            {l.street ? ` · ${l.street}` : ""}
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {l.scheme === "btr" ? (
            <Chip label={l.operator ? `BTR · ${l.operator}` : "BTR"} cls="info" />
          ) : (
            <Chip label={l.scheme === "private" ? "Private" : "—"} cls="muted" />
          )}
          {timing && <Chip {...timing} />}
          {stale && <Chip {...stale} />}
          {l.unconfirmed && <Chip label="unconfirmed" cls="maybe" />}
          {gone && <Chip label={l.goneReason === "let-agreed" ? "let agreed" : "removed"} cls="no" />}
        </div>

        {meta.length > 0 && <div className="text-xs text-[var(--text-secondary)]">{meta.join(" · ")}</div>}
        {l.note && <div className="text-xs italic text-[var(--text-muted)]">{l.note}</div>}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--border-secondary)] pt-2">
          <div className="flex flex-wrap gap-2">
            {l.sources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="rounded text-xs text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                {s.platform}
                {s.agent ? ` · ${s.agent}` : ""}
              </a>
            ))}
          </div>
          <button
            onClick={() => onPref(l.id, rejected ? null : "reject")}
            aria-label={rejected ? `Unhide ${l.building}` : `Hide ${l.building}`}
            aria-pressed={rejected}
            className="shrink-0 rounded px-1.5 py-0.5 text-xs text-[var(--text-secondary)] hover:text-[var(--status-no)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {rejected ? "Undo" : "Hide"}
          </button>
        </div>
      </div>
    </div>
  );
}
