"use client";

import { useState } from "react";
import type { Pref } from "@/lib/flat-search/types";
import type { EnrichedListing } from "@/lib/flat-search/view-model";

const BUDGET_BADGE: Record<string, { label: string; cls: string }> = {
  in: { label: "in budget", cls: "yes" },
  btr: { label: "BTR band", cls: "info" },
  over: { label: "over budget", cls: "maybe" },
};

const TIMING_CHIP: Record<string, { label: string; cls: string } | null> = {
  ideal: { label: "well-timed", cls: "yes" },
  workable: { label: "workable timing", cls: "info" },
  early: { label: "early", cls: "muted" },
  late: { label: "too late", cls: "no" },
  unknown: null,
};

const STALE_CHIP: Record<string, { label: string; cls: string } | null> = {
  ok: null,
  slow: { label: "slow to let", cls: "maybe" },
  stale: { label: "stale", cls: "maybe" },
  problem: { label: "long-listed", cls: "no" },
};

function Chip({ label, cls }: { label: string; cls: string }) {
  const styles: Record<string, string> = {
    yes: "bg-[var(--status-yes-bg)] text-[var(--status-yes)]",
    no: "bg-[var(--status-no-bg)] text-[var(--status-no)]",
    maybe: "bg-[var(--status-maybe-bg)] text-[var(--status-maybe)]",
    info: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
    muted: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
  };
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${styles[cls] ?? styles.muted}`}>{label}</span>;
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

  return (
    <div
      ref={cardRef}
      className={`flex flex-col overflow-hidden rounded-xl border bg-[var(--bg-primary)] transition-all ${
        highlighted
          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]"
          : wanted
            ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
            : "border-[var(--border-primary)]"
      } ${rejected ? "opacity-60" : ""}`}
    >
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt={l.building}
          loading="lazy"
          onError={() => setImgOk(false)}
          className="h-40 w-full object-cover"
        />
      )}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-[var(--text-primary)]">£{l.price.toLocaleString()}</span>
              <Chip {...budget} />
            </div>
            <div className={`text-sm font-medium text-[var(--text-primary)] ${rejected ? "line-through" : ""}`}>
              {l.building}
            </div>
            <div className="text-xs text-[var(--text-secondary)]">
              {areaName}
              {l.street ? ` · ${l.street}` : ""}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <button
              onClick={() => onPref(l.id, wanted ? null : "want")}
              aria-label={wanted ? `Remove want on ${l.building}` : `Mark ${l.building} as wanted`}
              aria-pressed={wanted}
              title="Want"
              className={`rounded px-2 py-0.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                wanted
                  ? "bg-[var(--status-yes)] text-white"
                  : "text-[var(--status-yes)] hover:bg-[var(--status-yes-bg)]"
              }`}
            >
              ✓
            </button>
            <button
              onClick={() => onPref(l.id, rejected ? null : "reject")}
              aria-label={rejected ? `Remove reject on ${l.building}` : `Reject ${l.building}`}
              aria-pressed={rejected}
              title="Reject"
              className={`rounded px-2 py-0.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                rejected ? "bg-[var(--status-no)] text-white" : "text-[var(--status-no)] hover:bg-[var(--status-no-bg)]"
              }`}
            >
              ✗
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {l.scheme === "btr" ? (
            <Chip label={l.operator ? `BTR · ${l.operator}` : "BTR"} cls="info" />
          ) : (
            <Chip label={l.scheme === "private" ? "private" : "unknown"} cls="muted" />
          )}
          {l.isNew && <Chip label="NEW" cls="yes" />}
          {timing && <Chip {...timing} />}
          {stale && <Chip {...stale} />}
          {l.unconfirmed && <Chip label="unconfirmed" cls="maybe" />}
          {gone && <Chip label={l.goneReason === "let-agreed" ? "let agreed" : "removed"} cls="no" />}
          {l.phaseYear && <Chip label={`${l.phaseYear}`} cls="muted" />}
          {l.epc && <Chip label={`EPC ${l.epc}`} cls="muted" />}
        </div>

        <div className="mt-auto text-xs text-[var(--text-secondary)]">
          {l.available ? <span>Available: {l.available}</span> : null}
          {l.sizeSqft ? <span> · {l.sizeSqft} sqft</span> : null}
          {l.daysOnMarket != null && l.availableNow ? <span> · {l.daysOnMarket}d listed</span> : null}
        </div>

        {l.note && <div className="text-xs italic text-[var(--text-muted)]">{l.note}</div>}

        <div className="flex flex-wrap gap-2 pt-1">
          {l.sources.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[var(--accent)] hover:underline"
            >
              {s.platform}
              {s.agent ? ` · ${s.agent}` : ""}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
