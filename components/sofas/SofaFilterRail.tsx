"use client";

import { BUDGET_CAP_GBP, MAX_WIDTH_CM, TARGET_DEPTH_CM } from "@/lib/sofas/types";

// Only controls that change which sofa you'd buy. Depth gets a slider rather
// than presets because it is the buyer's primary comfort requirement and the
// useful threshold is personal — 112cm is the reference, but the honest
// question is "how much am I willing to give up", which is a continuum.
export interface SofaFilterState {
  maxLanded: number;
  minDepth: number; // cm; 0 = any
  maxWidth: number; // cm
  fit: "confirmed" | "notfailed" | "all";
  legRest: string[]; // "chaise" | "footstool" | "both"; empty = all
  condition: string[]; // empty = all
  modularOnly: boolean;
  retailers: string[];
  hideSoldOut: boolean;
  hideOverBudget: boolean;
  hideThinData: boolean;
  hideRejected: boolean;
}

export const DEFAULT_SOFA_FILTERS: SofaFilterState = {
  maxLanded: BUDGET_CAP_GBP,
  minDepth: 0,
  maxWidth: MAX_WIDTH_CM,
  fit: "notfailed",
  legRest: [],
  condition: [],
  modularOnly: false,
  retailers: [],
  hideSoldOut: true,
  hideOverBudget: true,
  hideThinData: false,
  hideRejected: true,
};

const LEG_REST_LABEL: Record<string, string> = {
  chaise: "Built-in chaise",
  footstool: "Separate footstool",
  both: "Both",
};

const CONDITION_LABEL: Record<string, string> = {
  new: "New",
  "ex-display": "Ex-display",
  clearance: "Clearance / outlet",
  "second-hand": "Second-hand",
};

function toggle(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--text-secondary)]">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 accent-[var(--accent)]" />
      <span>{label}</span>
    </label>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--border-secondary)] py-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{title}</div>
      {hint && <div className="mb-2 text-[11px] leading-snug text-[var(--text-muted)]">{hint}</div>}
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  value, options, onChange,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-[var(--border-primary)] text-[11px]">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`flex-1 whitespace-nowrap px-1.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] ${
            value === o.value ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function SofaFilterRail({
  retailers, conditions, filters, onChange,
}: {
  retailers: string[];
  conditions: string[];
  filters: SofaFilterState;
  onChange: (f: SofaFilterState) => void;
}) {
  const set = (patch: Partial<SofaFilterState>) => onChange({ ...filters, ...patch });

  return (
    <div className="text-[var(--text-primary)]">
      <div className="flex items-center justify-between pb-2">
        <span className="text-sm font-bold">Filters</span>
        <button
          onClick={() => onChange(DEFAULT_SOFA_FILTERS)}
          className="rounded text-xs text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          reset
        </button>
      </div>

      <Section
        title="Minimum depth"
        hint={`The Raft you liked is ${TARGET_DEPTH_CM}cm. Below about 100cm you sit upright with no thigh support.`}
      >
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold [font-variant-numeric:tabular-nums]">
            {filters.minDepth === 0 ? "Any" : `${filters.minDepth}cm+`}
          </span>
          {filters.minDepth >= TARGET_DEPTH_CM && (
            <span className="text-[11px] font-medium text-[var(--status-yes)]">matches the Raft</span>
          )}
        </div>
        <input
          type="range"
          min={0}
          max={125}
          step={5}
          value={filters.minDepth}
          onChange={(e) => set({ minDepth: Number(e.target.value) })}
          aria-label="Minimum overall depth in centimetres"
          className="w-full accent-[var(--accent)]"
        />
        <div className="flex gap-1">
          {[0, 100, 105, 112].map((d) => (
            <button
              key={d}
              onClick={() => set({ minDepth: d })}
              aria-pressed={filters.minDepth === d}
              className={`flex-1 rounded border px-1 py-0.5 text-[10px] transition-colors ${
                filters.minDepth === d
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              {d === 0 ? "Any" : `${d}+`}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">
          Sofas with no published depth are hidden while this is set — a blank never passes as deep.
        </p>
      </Section>

      <Section title="Fits the brief" hint="Two seats, a leg rest, and within the wall allowance.">
        <Segmented
          value={filters.fit}
          onChange={(v) => set({ fit: v })}
          options={[
            { value: "confirmed", label: "Confirmed" },
            { value: "notfailed", label: "Not ruled out" },
            { value: "all", label: "All" },
          ]}
        />
      </Section>

      <Section title="Leg rest">
        {(["chaise", "footstool", "both"] as const).map((v) => (
          <Check
            key={v}
            checked={filters.legRest.includes(v)}
            onChange={() => set({ legRest: toggle(filters.legRest, v) })}
            label={LEG_REST_LABEL[v]}
          />
        ))}
      </Section>

      <Section title="Landed budget" hint="Item + delivery.">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold [font-variant-numeric:tabular-nums]">
            £{filters.maxLanded.toLocaleString()}
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">max</span>
        </div>
        <input
          type="range" min={200} max={3000} step={50}
          value={filters.maxLanded}
          onChange={(e) => set({ maxLanded: Number(e.target.value) })}
          aria-label="Maximum landed cost"
          className="w-full accent-[var(--accent)]"
        />
        <Check
          checked={filters.hideOverBudget}
          onChange={() => set({ hideOverBudget: !filters.hideOverBudget })}
          label={`Hide over £${BUDGET_CAP_GBP}`}
        />
      </Section>

      <Section title="Maximum width" hint="Your wall allowance is 250cm.">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold [font-variant-numeric:tabular-nums]">{filters.maxWidth}cm</span>
        </div>
        <input
          type="range" min={160} max={300} step={5}
          value={filters.maxWidth}
          onChange={(e) => set({ maxWidth: Number(e.target.value) })}
          aria-label="Maximum overall width"
          className="w-full accent-[var(--accent)]"
        />
      </Section>

      <Section title="Condition" hint="Doesn't affect the ranking — it changes what you get, not how good the sofa is.">
        {conditions.map((c) => (
          <Check
            key={c}
            checked={filters.condition.includes(c)}
            onChange={() => set({ condition: toggle(filters.condition, c) })}
            label={CONDITION_LABEL[c] ?? c}
          />
        ))}
      </Section>

      <Section title="Availability" hint="A sofa you can't buy shouldn't be recommended, however well it scores.">
        <Check
          checked={filters.hideSoldOut}
          onChange={() => set({ hideSoldOut: !filters.hideSoldOut })}
          label="Hide sold out"
        />
      </Section>

      <Section title="Build">
        <Check
          checked={filters.modularOnly}
          onChange={() => set({ modularOnly: !filters.modularOnly })}
          label="Modular only (easier up a staircase)"
        />
      </Section>

      <Section title="Retailer">
        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {retailers.map((r) => (
            <Check
              key={r}
              checked={filters.retailers.includes(r)}
              onChange={() => set({ retailers: toggle(filters.retailers, r) })}
              label={r}
            />
          ))}
        </div>
      </Section>

      <Section title="Evidence" hint="Unpublished specs never count against a sofa. This hides ones we know too little about.">
        <Check
          checked={filters.hideThinData}
          onChange={() => set({ hideThinData: !filters.hideThinData })}
          label="Only sofas with most specs published"
        />
        <Check
          checked={filters.hideRejected}
          onChange={() => set({ hideRejected: !filters.hideRejected })}
          label="Hide dismissed"
        />
      </Section>
    </div>
  );
}
