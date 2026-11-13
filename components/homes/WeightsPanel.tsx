"use client";

import { CRITERIA, PRESETS, presetOf, type CriterionId, type Weight, type Weights } from "@/lib/homes/score";

// Say what matters, and both buying pages rank by it. Presets come first so
// nobody starts from blank sliders; each criterion is a four-step choice in
// words rather than a slider, because "matters a lot" is easier to mean than 0.75.

const STEPS: { v: Weight; label: string }[] = [
  { v: 0, label: "Off" },
  { v: 1, label: "A little" },
  { v: 2, label: "Matters" },
  { v: 3, label: "A lot" },
];

export function presetLabel(w: Weights): string {
  const id = presetOf(w);
  return PRESETS.find((p) => p.id === id)?.label ?? "Custom";
}

export default function WeightsPanel({
  weights,
  onChange,
  coverage,
}: {
  weights: Weights;
  onChange: (w: Weights) => void;
  /** Share (0–1) of homes where each factor is known. */
  coverage?: Partial<Record<CriterionId, number>>;
}) {
  const current = presetOf(weights);
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
      <fieldset>
        <legend className="text-sm font-semibold text-[var(--ink)]">Rank by</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const on = current === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                title={p.question}
                onClick={() => onChange(p.weights)}
                className={`h-9 rounded-full border px-3 text-sm transition-colors ${
                  on
                    ? "border-[var(--focus)] bg-[var(--focus-wash)] font-semibold text-[var(--ink)]"
                    : "border-[var(--line-control)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--sunk)]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
          {!current && (
            <span className="flex h-9 items-center rounded-full border border-[var(--focus)] bg-[var(--focus-wash)] px-3 text-sm font-semibold text-[var(--ink)]">
              Custom
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-[var(--ink-3)]">
          {PRESETS.find((p) => p.id === current)?.question ?? "Your own mix."} Filters still rule homes out.
        </p>
      </fieldset>

      {/* Presets answer most visits; the rows are there for fine-tuning. Open
          by default once the mix is custom, so its settings are visible. */}
      <details open={!current || undefined} className="group mt-3">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-[var(--focus)] hover:underline">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="transition-transform group-open:rotate-90">
            <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Fine-tune each factor ({CRITERIA.filter((c) => weights[c.id] > 0).length} of {CRITERIA.length} on)
        </summary>
      <div className="mt-3 grid gap-x-8 gap-y-3 lg:grid-cols-2">
        {CRITERIA.map((c) => {
          const known = coverage?.[c.id];
          return (
            <div key={c.id} role="radiogroup" aria-label={c.label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="min-w-[9rem]">
                <span className="block text-sm font-medium text-[var(--ink)]">{c.label}</span>
                <span className="block text-xs text-[var(--ink-3)]">
                  {c.hint}
                  {known != null && known < 0.95 ? ` · known for ${Math.round(known * 100)}%` : ""}
                </span>
              </div>
              <div className="flex rounded-full border border-[var(--line-control)] p-0.5">
                {STEPS.map((s) => {
                  const on = weights[c.id] === s.v;
                  return (
                    <button
                      key={s.v}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => onChange({ ...weights, [c.id]: s.v })}
                      className={`h-7 rounded-full px-2.5 text-xs transition-colors ${
                        on ? "bg-[var(--ink)] font-semibold text-[var(--paper)]" : "text-[var(--ink-2)] hover:bg-[var(--sunk)]"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      </details>
    </div>
  );
}
