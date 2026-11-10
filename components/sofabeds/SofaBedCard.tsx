"use client";

import NoPhoto from "@/components/NoPhoto";
import { bedWidthOf, bodyDepthOf, budgetVerdict, fitLabel } from "@/lib/sofabeds/fit";
import type { ScoredSofaBed } from "@/lib/sofabeds/score";
import { BUDGET_CAP_GBP, TARGET_DEPTH_CM, type Pref } from "@/lib/sofabeds/types";

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

/** The badge the card leads with. Not a dimension — the ranking's heaviest
 *  criterion is whether the thing you sleep on is a different object from the
 *  thing you sit on, so that is what you should see first. Three states, never
 *  two: null means the listing was not unambiguous, which is not the same as
 *  "you sleep on the seat". */
const SLEEP: Record<string, { label: string; tone: string }> = {
  true: { label: "Separate mattress", tone: "good" },
  false: { label: "Sleep on the seat", tone: "bad" },
  null: { label: "Mechanism unclear", tone: "unknown" },
};

function Chip({ label, tone }: { label: string; tone: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${CHIP[tone] ?? CHIP.unknown}`}>{label}</span>;
}

export default function SofaBedCard({
  sofaBed, onPref, onOpen,
}: { sofaBed: ScoredSofaBed; onPref: (id: string, pref: Pref | null) => void; onOpen: (s: ScoredSofaBed) => void }) {
  const s = sofaBed;
  const wanted = s.pref === "want";
  const rejected = s.pref === "reject";
  // Both read through the guards, never off the raw column. A corner unit that
  // publishes its L-shape footprint as "depth" must show as unpublished here,
  // not as the deepest sofa bed in the corpus.
  const bodyDepth = bodyDepthOf(s);
  const bedWidth = bedWidthOf(s);
  const deep = (bodyDepth ?? 0) >= TARGET_DEPTH_CM;
  const sleep = SLEEP[String(s.separateMattress)];
  const budget = budgetVerdict(s);
  const overBudget = budget === "over";
  // The retailer publishes no delivery charge, so the landed figure is price
  // with nothing added: a floor, not the total. Shown as "£1,199+".
  const landedIsFloor = budget === "unknown";
  const discount = s.rrpGbp && s.rrpGbp > s.landedCostGbp * 1.1 ? Math.round((1 - s.landedCostGbp / s.rrpGbp) * 100) : null;
  const dims = [
    bedWidth != null ? `${bedWidth}cm bed` : null,
    bodyDepth != null ? `${bodyDepth}cm deep` : null,
  ].filter(Boolean);

  return (
    <div
      className={`group relative flex flex-col gap-2 rounded-2xl border bg-[var(--bg-primary)] p-3.5 transition-all ${
        wanted ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--border-primary)]"
      } ${rejected ? "opacity-55" : ""}`}
    >
      <a
        href={s.productUrl}
        target="_blank"
        rel="noreferrer"
        className="absolute inset-0 z-0 rounded-2xl"
        aria-label={`${s.brand} ${s.model} at ${s.retailer} — opens in a new tab`}
      />

      <div className="pointer-events-none relative aspect-[4/3] overflow-hidden rounded-xl bg-[var(--bg-tertiary)]">
        {s.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <NoPhoto />
        )}
        {discount != null && (
          <span className="absolute left-2 top-2 rounded bg-[var(--status-no)] px-1.5 py-0.5 text-xs font-bold text-[var(--on-status)]">
            −{discount}%
          </span>
        )}
      </div>

      <div className="pointer-events-none flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium text-[var(--text-muted)]">{s.retailer}</div>
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
          <div className="mt-0.5 text-xs text-[var(--text-muted)]">Score</div>
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
          <span className="text-xl font-bold text-[var(--text-primary)] tracking-[-0.02em]">
            £{Math.round(s.landedCostGbp).toLocaleString()}
            {landedIsFloor && "+"}
          </span>
          {s.rrpGbp && s.rrpGbp > s.landedCostGbp && (
            <span className="text-xs text-[var(--text-muted)] line-through">£{Math.round(s.rrpGbp).toLocaleString()}</span>
          )}
          <span className="text-xs text-[var(--text-muted)]">{landedIsFloor ? "landed, at least" : "landed"}</span>
        </div>
        <div className="text-xs text-[var(--text-secondary)]">
          {dims.length ? dims.join(" · ") : "no dimensions published"}
        </div>
      </div>

      <div className="pointer-events-none flex flex-wrap gap-1">
        <Chip label={sleep.label} tone={sleep.tone} />
        <Chip label={fitLabel(s.fit)} tone={FIT_TONE[s.fit.overall]} />
        {deep && <Chip label={`${bodyDepth}cm deep`} tone="good" />}
        {/* Over budget is flagged, never hidden — most of the corpus is, and a
            search that quietly drops it answers a question you didn't ask. */}
        {overBudget && <Chip label={`£${Math.round(s.landedCostGbp - BUDGET_CAP_GBP).toLocaleString()} over budget`} tone="bad" />}
        {/* Unpublished delivery must read as unknown, never as free (spec §8). */}
        {landedIsFloor && <Chip label="delivery not published" tone="unknown" />}
        <Chip label={s.condition} tone={CONDITION_TONE[s.condition] ?? "unknown"} />
        {s.inStock === false && <Chip label="sold out" tone="bad" />}
        {s.oneOff && <Chip label="one-off stock" tone="unknown" />}
        {s.legRest === "storage-chaise" && <Chip label="storage chaise" tone="good" />}
      </div>

      <div className="relative z-10 mt-auto flex items-center justify-between gap-2 border-t border-[var(--border-secondary)] pt-2">
        <button
          onClick={() => onOpen(s)}
          className="rounded text-xs text-[var(--accent)] hover:underline"
        >
          Full spec
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPref(s.id, wanted ? null : "want")}
            aria-pressed={wanted}
            aria-label={wanted ? `Unsave ${s.model}` : `Save ${s.model}`}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              wanted ? "bg-[var(--action)] text-[var(--on-action)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            {wanted ? "♥ Saved" : "♡ Save"}
          </button>
          <button
            onClick={() => onPref(s.id, rejected ? null : "reject")}
            aria-pressed={rejected}
            aria-label={rejected ? `Restore ${s.model}` : `Dismiss ${s.model}`}
            className="rounded px-2 py-0.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--status-no)]"
          >
            {rejected ? "Undo" : "Hide"}
          </button>
        </div>
      </div>
    </div>
  );
}
