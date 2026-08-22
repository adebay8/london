"use client";

import { fitLabel } from "@/lib/consoles/fit";
import type { ScoredConsole } from "@/lib/consoles/score";
import type { Pref } from "@/lib/consoles/types";
import { financeFor, financeLabel } from "@/lib/retail/finance";

const CHIP: Record<string, string> = {
  good: "bg-[var(--status-yes-bg)] text-[var(--status-yes)]",
  bad: "bg-[var(--status-no-bg)] text-[var(--status-no)]",
  unknown: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
};

const FIT_TONE: Record<string, string> = { pass: "good", fail: "bad", unknown: "unknown" };

function Chip({ label, tone }: { label: string; tone: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CHIP[tone] ?? CHIP.unknown}`}>{label}</span>;
}

/** Landed cost is the comparable number, so it leads. The breakdown underneath
 *  is what stops a bundled-service price reading as "expensive". */
function costLine(c: ScoredConsole): string {
  const bits: string[] = [`£${c.priceGbp.toLocaleString()} item`];
  if (c.deliveryIncluded) bits.push("free delivery");
  else if (c.deliveryCostGbp) bits.push(`+£${c.deliveryCostGbp} delivery`);
  if (c.assemblyIncluded) bits.push("assembly included");
  else if (c.assemblyCostGbp) bits.push(`+£${c.assemblyCostGbp} assembly`);
  return bits.join(" · ");
}

export default function ConsoleCard({
  console: item,
  onPref,
  onOpen,
}: {
  console: ScoredConsole;
  onPref: (id: string, pref: Pref | null) => void;
  onOpen: (c: ScoredConsole) => void;
}) {
  const c = item;
  const wanted = c.pref === "want";
  const rejected = c.pref === "reject";
  const fin = financeFor(c);

  const specs = [
    c.topDepthCm != null ? `${c.topDepthCm}cm deep top` : null,
    c.overallWidthCm != null ? `${c.overallWidthCm}cm wide` : null,
    c.backPanel ? `${c.backPanel} back` : null,
    c.frameMaterial,
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
        href={c.productUrl}
        target="_blank"
        rel="noreferrer"
        className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-label={`${c.brand} ${c.model} at ${c.retailer} — opens ${c.retailer} in a new tab`}
      />

      <div className="pointer-events-none flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{c.retailer}</div>
          <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{c.model}</div>
          {c.brand !== c.retailer && <div className="truncate text-xs text-[var(--text-secondary)]">{c.brand}</div>}
        </div>
        <div
          title={
            `Score ${c.score}/100 · measured ${c.rawScore}/100 on ${Math.round(c.confidence * 100)}% of criteria.` +
            (c.gaps.length ? ` Not published: ${c.gaps.join(", ")}.` : "") +
            (c.confidence < 0.6
              ? " Thin evidence pulls the score toward the average — it is not a mark against the unit."
              : "")
          }
          className="shrink-0 rounded-lg bg-[var(--bg-tertiary)] px-2 py-1 text-center"
        >
          <div className="text-sm font-bold leading-none text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
            {Math.round(c.score)}
          </div>
          <div className="mt-0.5 text-[9px] uppercase tracking-wide text-[var(--text-muted)]">score</div>
          {/* Evidence bar — how much of the spec we actually have. Kept
              visually separate from the score so thin data never reads as a
              low verdict. */}
          <div
            className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-[var(--border-primary)]"
            role="img"
            aria-label={`${Math.round(c.confidence * 100)}% of criteria measured`}
          >
            <div
              className="h-full rounded-full bg-[var(--accent)]"
              style={{ width: `${Math.max(6, Math.round(c.confidence * 100))}%` }}
            />
          </div>
        </div>
      </div>

      <div className="pointer-events-none">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
            £{Math.round(c.landedCostGbp).toLocaleString()}
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">landed</span>
          {c.arrivesAssembled === "included" && (
            <span
              className="ml-auto rounded-md px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: "var(--status-yes)" }}
            >
              Assembled
            </span>
          )}
        </div>
        <div className="text-[11px] text-[var(--text-secondary)]">{costLine(c)}</div>
        {fin.interestFree && fin.monthly != null && (
          <div className="text-[11px] font-medium text-[var(--status-yes)]">
            {financeLabel(fin)} · £{fin.monthly.toFixed(2)}/mo
          </div>
        )}
      </div>

      {/* The fit verdict leads the chips — it is the whole point of the search. */}
      <div className="pointer-events-none flex flex-wrap gap-1">
        <Chip label={fitLabel(c.fit)} tone={FIT_TONE[c.fit.overall]} />
        {c.fit.overall === "unknown" && <Chip label="specs incomplete" tone="unknown" />}
        {c.overBudget && <Chip label="over budget" tone="bad" />}
        {c.reasons
          .filter((r) => r.tone !== "unknown")
          .slice(0, 2)
          .map((r) => (
            <Chip key={r.label} label={r.label} tone={r.tone} />
          ))}
      </div>

      {specs.length > 0 && (
        <div className="pointer-events-none text-xs text-[var(--text-secondary)]">{specs.join(" · ")}</div>
      )}

      <div className="relative z-10 mt-auto flex items-center justify-between gap-2 border-t border-[var(--border-secondary)] pt-2">
        <button
          onClick={() => onOpen(c)}
          className="rounded text-xs text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Fit &amp; full spec
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPref(c.id, wanted ? null : "want")}
            aria-pressed={wanted}
            aria-label={wanted ? `Unsave ${c.model}` : `Save ${c.model}`}
            className={`rounded px-2 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              wanted ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            {wanted ? "♥ Saved" : "♡ Save"}
          </button>
          <button
            onClick={() => onPref(c.id, rejected ? null : "reject")}
            aria-pressed={rejected}
            aria-label={rejected ? `Restore ${c.model}` : `Dismiss ${c.model}`}
            className="rounded px-2 py-0.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--status-no)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {rejected ? "Undo" : "Hide"}
          </button>
        </div>
      </div>
    </div>
  );
}
