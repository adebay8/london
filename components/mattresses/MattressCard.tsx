"use client";

import { dealFor } from "@/lib/mattresses/deal";
import { compatFor, type BedConstraint } from "@/lib/mattresses/compat";
import { depthOf, fitLabel } from "@/lib/mattresses/fit";
import type { ScoredMattress } from "@/lib/mattresses/score";
import { GREAT_TRIAL_NIGHTS, type Pref } from "@/lib/mattresses/types";

const CHIP: Record<string, string> = {
  good: "bg-[var(--status-yes-bg)] text-[var(--status-yes)]",
  bad: "bg-[var(--status-no-bg)] text-[var(--status-no)]",
  unknown: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
};

const FIT_TONE: Record<string, string> = { pass: "good", fail: "bad", unknown: "unknown" };

function Chip({ label, tone, title }: { label: string; tone: string; title?: string }) {
  return (
    <span title={title} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CHIP[tone] ?? CHIP.unknown}`}>
      {label}
    </span>
  );
}

export default function MattressCard({
  mattress, beds, onPref, onOpen,
}: {
  mattress: ScoredMattress;
  beds: BedConstraint[];
  onPref: (id: string, pref: Pref | null) => void;
  onOpen: (m: ScoredMattress) => void;
}) {
  const m = mattress;
  const wanted = m.pref === "want";
  const rejected = m.pref === "reject";
  const deal = dealFor(m);
  const compat = compatFor(m, beds);
  const depth = depthOf(m);
  const firmness = m.fit.firmnessRead.value;

  return (
    <div
      className={`group relative flex flex-col gap-2 rounded-2xl border bg-[var(--bg-primary)] p-3.5 transition-all hover:shadow-md ${
        wanted ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--border-primary)]"
      } ${rejected ? "opacity-55" : ""}`}
    >
      <a
        href={m.productUrl}
        target="_blank"
        rel="noreferrer"
        className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-label={`${m.brand} ${m.model} at ${m.retailer} — opens in a new tab`}
      />

      <div className="pointer-events-none relative aspect-[4/3] overflow-hidden rounded-xl bg-[var(--bg-tertiary)]">
        {m.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1" aria-label="No photo published">
            <span className="text-3xl opacity-60" aria-hidden>🛏️</span>
            <span className="text-[9px] uppercase tracking-wide text-[var(--text-muted)]">no photo</span>
          </div>
        )}
        {/* Where a "-58%" badge would normally go. A verified saving earns one;
            an unverified claim does not get to shout. */}
        {deal.credible && deal.realSavingGbp != null && (
          <span className="absolute left-2 top-2 rounded bg-[var(--status-yes)] px-1.5 py-0.5 text-[10px] font-bold text-white">
            save £{deal.realSavingGbp}
          </span>
        )}
      </div>

      <div className="pointer-events-none flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{m.retailer}</div>
          <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{m.model}</div>
        </div>
        <div
          title={
            `Score ${m.score}/100 · measured ${m.rawScore}/100 on ${Math.round(m.confidence * 100)}% of criteria.` +
            (m.gaps.length ? ` Not published: ${m.gaps.join(", ")}.` : "")
          }
          className="shrink-0 rounded-lg bg-[var(--bg-tertiary)] px-2 py-1 text-center"
        >
          <div className="text-sm font-bold leading-none text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
            {Math.round(m.score)}
          </div>
          <div className="mt-0.5 text-[9px] uppercase tracking-wide text-[var(--text-muted)]">score</div>
          <div
            className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-[var(--border-primary)]"
            role="img"
            aria-label={`${Math.round(m.confidence * 100)}% of criteria measured`}
          >
            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(6, Math.round(m.confidence * 100))}%` }} />
          </div>
        </div>
      </div>

      <div className="pointer-events-none">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
            £{Math.round(m.landedCostGbp).toLocaleString()}
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">landed</span>
        </div>
        {/* The sentence that replaces a percentage. */}
        {m.rrpGbp != null && m.rrpGbp > m.priceGbp && (
          <div
            className={`text-[11px] ${deal.credible ? "text-[var(--status-yes)]" : "text-[var(--text-muted)]"}`}
            title={deal.caution ?? undefined}
          >
            {deal.evidence === "permanent-sale"
              ? `“Was £${Math.round(m.rrpGbp).toLocaleString()}” — but this is its usual price`
              : deal.evidence === "verified-higher"
                ? `Genuinely down from £${Math.round(m.rrpGbp).toLocaleString()}`
                : `“Was £${Math.round(m.rrpGbp).toLocaleString()}” — unverified`}
          </div>
        )}
        <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
          {[
            m.type,
            m.firmnessLabel,
            depth != null ? `${depth}cm deep` : null,
          ].filter(Boolean).join(" · ")}
        </div>
      </div>

      <div className="pointer-events-none flex flex-wrap gap-1">
        <Chip label={fitLabel(m.fit)} tone={FIT_TONE[m.fit.overall]} />
        {firmness && <Chip label={firmness} tone={m.fit.firmness === "pass" ? "good" : "bad"} />}
        {m.springType === "pocket" && <Chip label="pocket springs" tone="good" />}
        {m.springType === "open-coil" && <Chip label="open coil" tone="bad" />}
        {m.trialNights != null && m.trialNights >= GREAT_TRIAL_NIGHTS && (
          <Chip label={`${m.trialNights}-night trial`} tone="good" />
        )}
        {m.condition === "clearance" && <Chip label="clearance" tone="info" />}
        {m.inStock === false && <Chip label="sold out" tone="bad" />}
        {compat.label && (
          <Chip
            label={compat.label}
            tone={compat.blocked.length ? "bad" : compat.fits === compat.total ? "good" : "unknown"}
            title={compat.blocked.map((b) => `${b.bed.model}: ${b.reason}`).join(" · ") || undefined}
          />
        )}
      </div>

      <div className="relative z-10 mt-auto flex items-center justify-between gap-2 border-t border-[var(--border-secondary)] pt-2">
        <button
          onClick={() => onOpen(m)}
          className="rounded text-xs text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Full spec
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPref(m.id, wanted ? null : "want")}
            aria-pressed={wanted}
            aria-label={wanted ? `Unsave ${m.model}` : `Save ${m.model}`}
            className={`rounded px-2 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              wanted ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            {wanted ? "♥ Saved" : "♡ Save"}
          </button>
          <button
            onClick={() => onPref(m.id, rejected ? null : "reject")}
            aria-pressed={rejected}
            aria-label={rejected ? `Restore ${m.model}` : `Dismiss ${m.model}`}
            className="rounded px-2 py-0.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--status-no)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {rejected ? "Undo" : "Hide"}
          </button>
        </div>
      </div>
    </div>
  );
}
