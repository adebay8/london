"use client";

import { BUDGET_CAP_GBP } from "@/lib/beds/types";

// Deliberately NOT a filter per column. The research CSV has 60+ fields, but
// only the ones that actually change which bed you'd buy earn a control here.
// Everything else is visible on the card and in the detail drawer.
export interface BedFilterState {
  maxLanded: number;
  assembly: string[]; // "included" | "paid" | "self"; empty = all
  depth: "any" | "28" | "32"; // 32 = fits a hard-shell suitcase
  opening: string[]; // "end" | "side" | "either"; empty = all
  footprint: "any" | "12" | "6"; // max cm wider than the 135cm mattress
  ottomanType: string[]; // "full" | "half"; empty = all
  retailers: string[]; // empty = all
  finance: "any" | "available" | "interestfree" | "12" | "24"; // 12/24 = months at 0%
  hideOverBudget: boolean;
  hideThinData: boolean;
  hideRejected: boolean;
}

export const DEFAULT_BED_FILTERS: BedFilterState = {
  maxLanded: BUDGET_CAP_GBP,
  assembly: [],
  depth: "any",
  opening: [],
  footprint: "any",
  ottomanType: [],
  retailers: [],
  finance: "any",
  hideOverBudget: true,
  hideThinData: false,
  hideRejected: true,
};

const ASSEMBLY_LABEL: Record<string, string> = {
  included: "Built in your room, in the price",
  paid: "Assembly available, extra cost",
  self: "Self-assembly",
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
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-[var(--border-primary)] text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`flex-1 px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] ${
            value === o.value
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function BedFilterRail({
  retailers,
  filters,
  onChange,
}: {
  retailers: string[];
  filters: BedFilterState;
  onChange: (f: BedFilterState) => void;
}) {
  const set = (patch: Partial<BedFilterState>) => onChange({ ...filters, ...patch });

  return (
    <div className="text-[var(--text-primary)]">
      <div className="flex items-center justify-between pb-2">
        <span className="text-sm font-bold">Filters</span>
        <button
          onClick={() => onChange(DEFAULT_BED_FILTERS)}
          className="rounded text-xs text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          reset
        </button>
      </div>

      <Section title="Landed budget" hint="Item + delivery + assembly — the only figure comparable across retailers.">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold [font-variant-numeric:tabular-nums]">
            £{filters.maxLanded.toLocaleString()}
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">max</span>
        </div>
        <input
          type="range"
          min={200}
          max={1400}
          step={25}
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

      <Section title="Who builds it" hint="You said you'd rather it arrived assembled, or pay to have it built.">
        {(["included", "paid", "self"] as const).map((a) => (
          <Check
            key={a}
            checked={filters.assembly.includes(a)}
            onChange={() => set({ assembly: toggle(filters.assembly, a) })}
            label={ASSEMBLY_LABEL[a]}
          />
        ))}
      </Section>

      <Section title="Storage depth" hint="A hard-shell suitcase is ~30cm thick, so the lid won't close below about 32cm.">
        <Segmented
          value={filters.depth}
          onChange={(v) => set({ depth: v })}
          options={[
            { value: "any", label: "Any" },
            { value: "28", label: "28cm+" },
            { value: "32", label: "Suitcase" },
          ]}
        />
      </Section>

      <Section title="Lift direction" hint="End lift needs clear floor at the foot; side lift needs it along one whole side.">
        {(
          [
            ["end", "End / foot lift"],
            ["side", "Side lift"],
            ["either", "Either side (you choose)"],
          ] as const
        ).map(([v, label]) => (
          <Check
            key={v}
            checked={filters.opening.includes(v)}
            onChange={() => set({ opening: toggle(filters.opening, v) })}
            label={label}
          />
        ))}
      </Section>

      <Section title="Footprint" hint="How much wider than the 135cm mattress. Matters in a small bedroom.">
        <Segmented
          value={filters.footprint}
          onChange={(v) => set({ footprint: v })}
          options={[
            { value: "any", label: "Any" },
            { value: "12", label: "≤12cm" },
            { value: "6", label: "≤6cm" },
          ]}
        />
      </Section>

      <Section title="Ottoman type" hint="Full = one continuous cavity. Half trades that for two small drawers.">
        {(
          [
            ["full", "Full ottoman"],
            ["half", "Half / conti"],
          ] as const
        ).map(([v, label]) => (
          <Check
            key={v}
            checked={filters.ottomanType.includes(v)}
            onChange={() => set({ ottomanType: toggle(filters.ottomanType, v) })}
            label={label}
          />
        ))}
      </Section>

      <Section
        title="Finance"
        hint="Doesn't affect the ranking — it changes how you pay, not how good the bed is. Minimum spends are checked against landed cost."
      >
        <Segmented
          value={filters.finance}
          onChange={(v) => set({ finance: v })}
          options={[
            { value: "any", label: "Any" },
            { value: "interestfree", label: "0%" },
            { value: "12", label: "0% 12m+" },
            { value: "24", label: "0% 24m+" },
          ]}
        />
        <label className="mt-1.5 flex cursor-pointer items-start gap-2 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={filters.finance === "available"}
            onChange={() => set({ finance: filters.finance === "available" ? "any" : "available" })}
            className="mt-0.5 accent-[var(--accent)]"
          />
          <span>Any finance, including pay-in-3</span>
        </label>
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

      <Section
        title="Evidence"
        hint="Unpublished specs never count against a bed. This just hides ones we know too little about to judge."
      >
        <Check
          checked={filters.hideThinData}
          onChange={() => set({ hideThinData: !filters.hideThinData })}
          label="Only beds with most specs published"
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
