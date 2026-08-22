"use client";

import { BUDGET_CAP_GBP, COMFORT_TOP_DEPTH_CM, MIN_TOP_DEPTH_CM } from "@/lib/consoles/types";

// Deliberately NOT a filter per column. Only controls that actually change
// which unit you'd buy earn a place here; everything else is on the card and
// in the detail drawer.
export interface ConsoleFilterState {
  maxLanded: number;
  /** The tri-state gate. "notfailed" is the default: hide units we have
   *  confirmed cannot take the kit, but keep the ones we simply don't know
   *  about, flagged. Hiding unknowns by default would silently delete most of
   *  the market for the crime of having a thin product page. */
  fit: "confirmed" | "notfailed" | "all";
  topDepth: "any" | "37" | "40";
  width: "any" | "tv" | "wall";
  backPanel: string[]; // "open" | "ported" | "solid"; empty = all
  assembly: string[]; // "included" | "paid" | "self"; empty = all
  retailers: string[]; // empty = all
  finance: "any" | "available" | "interestfree" | "12" | "24";
  hideOverBudget: boolean;
  hideThinData: boolean;
  hideRejected: boolean;
}

export const DEFAULT_CONSOLE_FILTERS: ConsoleFilterState = {
  maxLanded: BUDGET_CAP_GBP,
  fit: "notfailed",
  topDepth: "any",
  width: "any",
  backPanel: [],
  assembly: [],
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

const BACK_LABEL: Record<string, string> = {
  open: "Open back",
  ported: "Ported / cut-outs",
  solid: "Solid back",
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

export default function ConsoleFilterRail({
  retailers,
  filters,
  onChange,
}: {
  retailers: string[];
  filters: ConsoleFilterState;
  onChange: (f: ConsoleFilterState) => void;
}) {
  const set = (patch: Partial<ConsoleFilterState>) => onChange({ ...filters, ...patch });

  return (
    <div className="text-[var(--text-primary)]">
      <div className="flex items-center justify-between pb-2">
        <span className="text-sm font-bold">Filters</span>
        <button
          onClick={() => onChange(DEFAULT_CONSOLE_FILTERS)}
          className="rounded text-xs text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          reset
        </button>
      </div>

      <Section
        title="Fits your kit"
        hint="Retailers rarely publish internal bay sizes, so an unconfirmed unit is usually an unpublished spec rather than a bad unit."
      >
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

      <Section title="Landed budget" hint="Item + delivery + assembly — the only figure comparable across retailers.">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold [font-variant-numeric:tabular-nums]">
            £{filters.maxLanded.toLocaleString()}
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">max</span>
        </div>
        <input
          type="range"
          min={100}
          max={900}
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

      <Section
        title="Top depth"
        hint={`The TV base is 23.5cm and the soundbar 13.5cm, so ${MIN_TOP_DEPTH_CM}cm is the floor and ${COMFORT_TOP_DEPTH_CM}cm leaves a cable gap.`}
      >
        <Segmented
          value={filters.topDepth}
          onChange={(v) => set({ topDepth: v })}
          options={[
            { value: "any", label: "Any" },
            { value: "37", label: "37cm+" },
            { value: "40", label: "40cm+" },
          ]}
        />
      </Section>

      <Section title="Width" hint="The TV is 122.8cm wide and your wall allows 150–180cm.">
        <Segmented
          value={filters.width}
          onChange={(v) => set({ width: v })}
          options={[
            { value: "any", label: "Any" },
            { value: "tv", label: "≥ TV" },
            { value: "wall", label: "150–180" },
          ]}
        />
      </Section>

      <Section title="Back panel" hint="A PS5 and an ethernet switch share this box. A solid back cooks both.">
        {(["open", "ported", "solid"] as const).map((b) => (
          <Check
            key={b}
            checked={filters.backPanel.includes(b)}
            onChange={() => set({ backPanel: toggle(filters.backPanel, b) })}
            label={BACK_LABEL[b]}
          />
        ))}
      </Section>

      <Section title="Who builds it">
        {(["included", "paid", "self"] as const).map((a) => (
          <Check
            key={a}
            checked={filters.assembly.includes(a)}
            onChange={() => set({ assembly: toggle(filters.assembly, a) })}
            label={ASSEMBLY_LABEL[a]}
          />
        ))}
      </Section>

      <Section
        title="Finance"
        hint="Doesn't affect the ranking — it changes how you pay, not how good the unit is. Minimum spends are checked against landed cost."
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
        hint="Unpublished specs never count against a unit. This just hides ones we know too little about to judge."
      >
        <Check
          checked={filters.hideThinData}
          onChange={() => set({ hideThinData: !filters.hideThinData })}
          label="Only units with most specs published"
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
