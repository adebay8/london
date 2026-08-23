"use client";

import { fitLabel } from "@/lib/sofas/fit";
import type { ScoredSofa } from "@/lib/sofas/score";
import { TARGET_DEPTH_CM, type Pref } from "@/lib/sofas/types";

const CHIP: Record<string, string> = {
  good: "bg-[var(--status-yes-bg)] text-[var(--status-yes)]",
  bad: "bg-[var(--status-no-bg)] text-[var(--status-no)]",
  unknown: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
};

const FIT_TONE: Record<string, string> = { pass: "good", fail: "bad", unknown: "unknown" };

const CONDITION_TONE: Record<string, string> = {
  new: "info",
  "ex-display": "unknown",
  clearance: "unknown",
  "second-hand": "unknown",
};

function Chip({ label, tone }: { label: string; tone: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CHIP[tone] ?? CHIP.unknown}`}>{label}</span>;
}

export default function SofaCard({
  sofa, onPref, onOpen,
}: { sofa: ScoredSofa; onPref: (id: string, pref: Pref | null) => void; onOpen: (s: ScoredSofa) => void }) {
  const s = sofa;
  const wanted = s.pref === "want";
  const rejected = s.pref === "reject";
  const deep = (s.overallDepthCm ?? 0) >= TARGET_DEPTH_CM;
  const discount = s.rrpGbp && s.rrpGbp > s.landedCostGbp * 1.1 ? Math.round((1 - s.landedCostGbp / s.rrpGbp) * 100) : null;

  return (
    <div
      className={`group relative flex flex-col gap-2 rounded-2xl border bg-[var(--bg-primary)] p-3.5 transition-all hover:shadow-md ${
        wanted ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--border-primary)]"
      } ${rejected ? "opacity-55" : ""}`}
    >
      <a
        href={s.productUrl}
        target="_blank"
        rel="noreferrer"
        className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-label={`${s.brand} ${s.model} at ${s.retailer} — opens in a new tab`}
      />

      <div className="pointer-events-none relative aspect-[4/3] overflow-hidden rounded-xl bg-[var(--bg-tertiary)]">
        {s.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1" aria-label="No photo published">
            <span className="text-3xl opacity-60" aria-hidden>🛋️</span>
            <span className="text-[9px] uppercase tracking-wide text-[var(--text-muted)]">no photo</span>
          </div>
        )}
        {discount != null && (
          <span className="absolute left-2 top-2 rounded bg-[var(--status-no)] px-1.5 py-0.5 text-[10px] font-bold text-white">
            −{discount}%
          </span>
        )}
      </div>

      <div className="pointer-events-none flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{s.retailer}</div>
          <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{s.model}</div>
        </div>
        <div
          title={
            `Score ${s.score}/100 · measured ${s.rawScore}/100 on ${Math.round(s.confidence * 100)}% of criteria.` +
            (s.gaps.length ? ` Not published: ${s.gaps.join(", ")}.` : "")
          }
          className="shrink-0 rounded-lg bg-[var(--bg-tertiary)] px-2 py-1 text-center"
        >
          <div className="text-sm font-bold leading-none text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
            {Math.round(s.score)}
          </div>
          <div className="mt-0.5 text-[9px] uppercase tracking-wide text-[var(--text-muted)]">score</div>
          <div
            className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-[var(--border-primary)]"
            role="img"
            aria-label={`${Math.round(s.confidence * 100)}% of criteria measured`}
          >
            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(6, Math.round(s.confidence * 100))}%` }} />
          </div>
        </div>
      </div>

      <div className="pointer-events-none">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
            £{Math.round(s.landedCostGbp).toLocaleString()}
          </span>
          {s.rrpGbp && s.rrpGbp > s.landedCostGbp && (
            <span className="text-[11px] text-[var(--text-muted)] line-through">£{Math.round(s.rrpGbp).toLocaleString()}</span>
          )}
          <span className="text-[11px] text-[var(--text-muted)]">landed</span>
        </div>
        <div className="text-[11px] text-[var(--text-secondary)]">
          {[
            s.overallWidthCm != null ? `${s.overallWidthCm}cm wide` : null,
            s.overallDepthCm != null ? `${s.overallDepthCm}cm deep` : "depth unpublished",
            s.seats != null ? `${s.seats} seats` : null,
          ].filter(Boolean).join(" · ")}
        </div>
      </div>

      <div className="pointer-events-none flex flex-wrap gap-1">
        <Chip label={fitLabel(s.fit)} tone={FIT_TONE[s.fit.overall]} />
        {deep && <Chip label={`${s.overallDepthCm}cm deep`} tone="good" />}
        <Chip label={s.condition} tone={CONDITION_TONE[s.condition] ?? "unknown"} />
        {s.oneOff && <Chip label="one-off stock" tone="unknown" />}
        {s.modular && <Chip label="modular" tone="good" />}
      </div>

      <div className="relative z-10 mt-auto flex items-center justify-between gap-2 border-t border-[var(--border-secondary)] pt-2">
        <button
          onClick={() => onOpen(s)}
          className="rounded text-xs text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Full spec
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPref(s.id, wanted ? null : "want")}
            aria-pressed={wanted}
            aria-label={wanted ? `Unsave ${s.model}` : `Save ${s.model}`}
            className={`rounded px-2 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              wanted ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            {wanted ? "♥ Saved" : "♡ Save"}
          </button>
          <button
            onClick={() => onPref(s.id, rejected ? null : "reject")}
            aria-pressed={rejected}
            aria-label={rejected ? `Restore ${s.model}` : `Dismiss ${s.model}`}
            className="rounded px-2 py-0.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--status-no)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {rejected ? "Undo" : "Hide"}
          </button>
        </div>
      </div>
    </div>
  );
}
