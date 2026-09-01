"use client";

import { BUDGET_CAP_GBP, FIRMNESS_ORDER, TARGET_FIRMNESS } from "@/lib/mattresses/types";

// Only controls that change which mattress you'd buy.
//
// Firmness gets the top slot because it is what people actually return
// mattresses over — ahead of springs, filling, depth and everything else the
// listing leads with.
export interface MattressFilterState {
  maxLanded: number;
  firmness: string[]; // empty = all
  types: string[]; // empty = all
  fit: "confirmed" | "notfailed" | "all";
  minTrial: number; // nights; 0 = any
  pocketOnly: boolean;
  verifiedDealsOnly: boolean;
  fitsAllBeds: boolean;
  retailers: string[];
  hideSoldOut: boolean;
  hideOverBudget: boolean;
  hideThinData: boolean;
  hideRejected: boolean;
}

export const DEFAULT_MATTRESS_FILTERS: MattressFilterState = {
  maxLanded: BUDGET_CAP_GBP,
  firmness: [],
  types: [],
  fit: "notfailed",
  minTrial: 0,
  pocketOnly: false,
  verifiedDealsOnly: false,
  fitsAllBeds: false,
  retailers: [],
  hideSoldOut: true,
  hideOverBudget: true,
  hideThinData: false,
  hideRejected: true,
};

const TYPE_LABEL: Record<string, string> = {
  "pocket-sprung": "Pocket sprung",
  hybrid: "Hybrid",
  "memory-foam": "Memory foam",
  foam: "Foam",
  "open-coil": "Open coil",
  latex: "Latex",
  natural: "Natural fill",
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

export default function MattressFilterRail({
  retailers, types, bedCount, filters, onChange,
}: {
  retailers: string[];
  types: string[];
  bedCount: number;
  filters: MattressFilterState;
  onChange: (f: MattressFilterState) => void;
}) {
  const set = (patch: Partial<MattressFilterState>) => onChange({ ...filters, ...patch });

  return (
    <div className="text-[var(--text-primary)]">
      <div className="flex items-center justify-between pb-2">
        <span className="text-sm font-bold">Filters</span>
        <button
          onClick={() => onChange(DEFAULT_MATTRESS_FILTERS)}
          className="rounded text-xs text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          reset
        </button>
      </div>

      <Section
        title="Firmness"
        hint="You sleep on your side and on your back. Medium and medium-firm serve both; firm is the usual regret for side sleepers."
      >
        {FIRMNESS_ORDER.map((f) => (
          <Check
            key={f}
            checked={filters.firmness.includes(f)}
            onChange={() => set({ firmness: toggle(filters.firmness, f) })}
            label={TARGET_FIRMNESS.includes(f) ? `${f} — your band` : f}
          />
        ))}
        <p className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">
          Mattresses whose firmness the retailer never states are hidden while this is set.
        </p>
      </Section>

      <Section title="Meets the brief" hint="A 135 x 190 double, in your firmness band, rated for a slatted or ottoman base.">
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

      <Section title="Landed budget" hint="Item + delivery + taking the old mattress away.">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold [font-variant-numeric:tabular-nums]">£{filters.maxLanded.toLocaleString()}</span>
          <span className="text-[11px] text-[var(--text-muted)]">max</span>
        </div>
        <input
          type="range" min={100} max={1500} step={25}
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
        title="Sleep trial"
        hint="The only honest test is sleeping on it. A 14-day returns policy on an unopened box is not a trial."
      >
        <div className="flex gap-1">
          {[0, 30, 60, 100].map((n) => (
            <button
              key={n}
              onClick={() => set({ minTrial: n })}
              aria-pressed={filters.minTrial === n}
              className={`flex-1 rounded border px-1 py-0.5 text-[10px] transition-colors ${
                filters.minTrial === n
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              {n === 0 ? "Any" : `${n}+`}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Construction">
        {types.map((t) => (
          <Check
            key={t}
            checked={filters.types.includes(t)}
            onChange={() => set({ types: toggle(filters.types, t) })}
            label={TYPE_LABEL[t] ?? t}
          />
        ))}
        <Check
          checked={filters.pocketOnly}
          onChange={() => set({ pocketOnly: !filters.pocketOnly })}
          label="Pocket springs only (best for sharing)"
        />
      </Section>

      <Section
        title="Deals"
        hint="Discount never affects the ranking — a bigger “saving” usually just means a more inflated RRP."
      >
        <Check
          checked={filters.verifiedDealsOnly}
          onChange={() => set({ verifiedDealsOnly: !filters.verifiedDealsOnly })}
          label="Only savings we could verify"
        />
      </Section>

      {bedCount > 0 && (
        <Section
          title="Your beds"
          hint={`Checked against the ${bedCount} ottoman${bedCount === 1 ? "" : "s"} you shortlisted — strut weight limit and base ventilation.`}
        >
          <Check
            checked={filters.fitsAllBeds}
            onChange={() => set({ fitsAllBeds: !filters.fitsAllBeds })}
            label="Only ones that work in every bed"
          />
        </Section>
      )}

      <Section title="Availability">
        <Check
          checked={filters.hideSoldOut}
          onChange={() => set({ hideSoldOut: !filters.hideSoldOut })}
          label="Hide sold out"
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

      <Section title="Evidence" hint="Unpublished specs never count against a mattress. This hides ones we know too little about.">
        <Check
          checked={filters.hideThinData}
          onChange={() => set({ hideThinData: !filters.hideThinData })}
          label="Only mattresses with most specs published"
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
