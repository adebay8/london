"use client";

import { financeFor, financeLabel } from "@/lib/beds/finance";
import type { ScoredBed } from "@/lib/beds/score";
import type { Pref } from "@/lib/beds/types";

const CHIP: Record<string, string> = {
  good: "bg-[var(--status-yes-bg)] text-[var(--status-yes)]",
  bad: "bg-[var(--status-no-bg)] text-[var(--status-no)]",
  unknown: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
};

const ASSEMBLY_BADGE: Record<string, { label: string; bg: string } | null> = {
  included: { label: "Assembled", bg: "var(--status-yes)" },
  paid: { label: "Assembly £", bg: "var(--accent)" },
  self: null,
};

function Chip({ label, tone }: { label: string; tone: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CHIP[tone] ?? CHIP.unknown}`}>{label}</span>;
}

/** Landed cost is the comparable number, so it leads. The breakdown underneath
 *  is what stops a bundled-service price reading as "expensive". */
function costLine(b: ScoredBed): string {
  const bits: string[] = [`£${b.doublePriceGbp.toLocaleString()} item`];
  if (b.deliveryIncluded) bits.push("free delivery");
  else if (b.deliveryCostGbp) bits.push(`+£${b.deliveryCostGbp} delivery`);
  if (b.assemblyIncluded) bits.push("assembly included");
  else if (b.assemblyCostGbp) bits.push(`+£${b.assemblyCostGbp} assembly`);
  return bits.join(" · ");
}

export default function BedCard({
  bed,
  onPref,
  onOpen,
}: {
  bed: ScoredBed;
  onPref: (id: string, pref: Pref | null) => void;
  onOpen: (bed: ScoredBed) => void;
}) {
  const b = bed;
  const wanted = b.pref === "want";
  const rejected = b.pref === "reject";
  const badge = ASSEMBLY_BADGE[b.arrivesAssembled];
  const fin = financeFor(b);

  const specs = [
    b.storageDepthCm != null ? `${b.storageDepthCm}cm deep` : null,
    b.overhangCm != null ? `+${b.overhangCm.toFixed(0)}cm wide` : null,
    b.gasStrutRating ?? (b.strutCount ? `${b.strutCount} struts` : null),
    b.openingDirection === "either" ? "either side" : b.openingDirection ? `${b.openingDirection} lift` : null,
  ].filter(Boolean);

  return (
    <div
      className={`group relative flex flex-col gap-2 rounded-2xl border bg-[var(--bg-primary)] p-3.5 transition-all hover:shadow-md ${
        wanted ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--border-primary)]"
      } ${rejected ? "opacity-55" : ""}`}
    >
      {/* Stretched link: the whole card opens the retailer's page, while the
          buttons below sit above it and stay independently clickable. */}
      <a
        href={b.productUrl}
        target="_blank"
        rel="noreferrer"
        className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-label={`${b.brand} ${b.model} at ${b.retailer} — opens ${b.retailer} in a new tab`}
      />

      <div className="pointer-events-none flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{b.retailer}</div>
          <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{b.model}</div>
          {b.brand !== b.retailer && <div className="truncate text-xs text-[var(--text-secondary)]">{b.brand}</div>}
        </div>
        <div
          title={
            `Score ${b.score}/100 · measured ${b.rawScore}/100 on ${Math.round(b.confidence * 100)}% of criteria.` +
            (b.gaps.length ? ` Not published: ${b.gaps.join(", ")}.` : "") +
            (b.confidence < 0.6
              ? " Thin evidence pulls the score toward the average — it is not a mark against the bed."
              : "")
          }
          className="shrink-0 rounded-lg bg-[var(--bg-tertiary)] px-2 py-1 text-center"
        >
          <div className="text-sm font-bold leading-none text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
            {Math.round(b.score)}
          </div>
          <div className="mt-0.5 text-[9px] uppercase tracking-wide text-[var(--text-muted)]">score</div>
          {/* Evidence bar — how much of the spec we actually have. Kept visually
              separate from the score so thin data never reads as a low verdict. */}
          <div
            className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-[var(--border-primary)]"
            role="img"
            aria-label={`${Math.round(b.confidence * 100)}% of criteria measured`}
          >
            <div
              className="h-full rounded-full bg-[var(--accent)]"
              style={{ width: `${Math.max(6, Math.round(b.confidence * 100))}%` }}
            />
          </div>
        </div>
      </div>

      <div className="pointer-events-none">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
            £{Math.round(b.landedCostGbp).toLocaleString()}
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">landed</span>
          {badge && (
            <span
              className="ml-auto rounded-md px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: badge.bg }}
            >
              {badge.label}
            </span>
          )}
        </div>
        <div className="text-[11px] text-[var(--text-secondary)]">{costLine(b)}</div>
        {b.extraMembershipCost && (
          <div className="text-[11px] text-[var(--status-maybe)]">+ {b.extraMembershipCost}</div>
        )}
        {fin.interestFree && fin.monthly != null && (
          <div className="text-[11px] font-medium text-[var(--status-yes)]">
            {financeLabel(fin)} · £{fin.monthly.toFixed(2)}/mo
          </div>
        )}
      </div>

      {specs.length > 0 && (
        <div className="pointer-events-none text-xs text-[var(--text-secondary)]">{specs.join(" · ")}</div>
      )}

      <div className="pointer-events-none flex flex-wrap gap-1">
        {b.clearsSuitcase === true && <Chip label="fits a suitcase" tone="good" />}
        {b.ottomanType === "half" && <Chip label="half ottoman" tone="unknown" />}
        {b.overBudget && <Chip label="over budget" tone="bad" />}
        {b.confidence < 0.5 && <Chip label={`${b.gaps.length} specs unpublished`} tone="unknown" />}
        {b.reasons
          .filter((r) => r.tone !== "unknown")
          .slice(0, 2)
          .map((r) => (
            <Chip key={r.label} label={r.label} tone={r.tone} />
          ))}
      </div>

      <div className="relative z-10 mt-auto flex items-center justify-between gap-2 border-t border-[var(--border-secondary)] pt-2">
        <button
          onClick={() => onOpen(b)}
          className="rounded text-xs text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Full spec
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPref(b.id, wanted ? null : "want")}
            aria-pressed={wanted}
            aria-label={wanted ? `Unsave ${b.model}` : `Save ${b.model}`}
            className={`rounded px-2 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              wanted ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            {wanted ? "♥ Saved" : "♡ Save"}
          </button>
          <button
            onClick={() => onPref(b.id, rejected ? null : "reject")}
            aria-pressed={rejected}
            aria-label={rejected ? `Restore ${b.model}` : `Dismiss ${b.model}`}
            className="rounded px-2 py-0.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--status-no)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {rejected ? "Undo" : "Hide"}
          </button>
        </div>
      </div>
    </div>
  );
}
