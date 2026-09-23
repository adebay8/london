"use client";

import {
  BUDGET_CAP_GBP, FULL_DOUBLE_WIDTH_CM, MAX_WIDTH_CM, MIN_BED_WIDTH_CM, MIN_WIDTH_CM, type Mechanism,
} from "@/lib/sofabeds/types";

// Only controls that change which sofa bed you'd buy. The sofa rail's depth
// slider is gone: depth is still scored, but on this shelf the question that
// separates one row from the next is what you sleep on, and that is a boolean
// rather than a continuum.
export interface SofaBedFilterState {
  retailer: string;            // "" = all
  condition: string[];         // empty = all
  fit: "all" | "pass";
  budget: "all" | "in";
  mechanism: Mechanism[];      // empty = all
  separateMattressOnly: boolean;
  bedSize: "all" | "small-double" | "double";  // >=120 | >=135
  beddingStorage: boolean;
  hideSoldOut: boolean;
  hideRejected: boolean;
  sort: "score" | "price" | "depth" | "bed";
}

export const DEFAULT_SOFABED_FILTERS: SofaBedFilterState = {
  retailer: "", condition: [], fit: "all", budget: "all",
  mechanism: [], separateMattressOnly: false, bedSize: "all",
  beddingStorage: false, hideSoldOut: true, hideRejected: true, sort: "score",
};

const MECHANISM_LABEL: Record<Mechanism, string> = {
  "fold-out": "Fold-out",
  "pull-out": "Pull-out",
  "click-clack": "Click-clack",
  futon: "Futon",
};

const CONDITION_LABEL: Record<string, string> = {
  new: "New",
  "ex-display": "Ex-display",
  clearance: "Clearance / outlet",
  "second-hand": "Second-hand",
};

function toggle<T extends string>(list: T[], v: T): T[] {
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

/** Single-select over a list the corpus decides — retailers and conditions are
 *  whatever got imported, so they can't be a fixed segmented control. */
function Radio({
  name, checked, onChange, label,
}: { name: string; checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--text-secondary)]">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-0.5 accent-[var(--accent)]" />
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

export default function SofaBedFilterRail({
  retailers, conditions, filters, onChange,
}: {
  retailers: string[];
  conditions: string[];
  filters: SofaBedFilterState;
  onChange: (f: SofaBedFilterState) => void;
}) {
  const set = (patch: Partial<SofaBedFilterState>) => onChange({ ...filters, ...patch });

  return (
    <div className="text-[var(--text-primary)]">
      <div className="flex items-center justify-between pb-2">
        <span className="text-sm font-bold">Filters</span>
        <button
          onClick={() => onChange(DEFAULT_SOFABED_FILTERS)}
          className="rounded text-xs text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          reset
        </button>
      </div>

      <Section
        title="Sitting comfort"
        hint="The mechanism lives in the seat box. A separate mattress is the difference between a sofa that also sleeps and a bench that folds."
      >
        <Check
          checked={filters.separateMattressOnly}
          onChange={() => set({ separateMattressOnly: !filters.separateMattressOnly })}
          label="Separate mattress only"
        />
        <p className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">
          Listings that never said plainly are hidden while this is set — an unclear mechanism never passes as a good one.
        </p>
      </Section>

      <Section
        title="Fits the brief"
        hint={`Seats three, ${MIN_WIDTH_CM}–${MAX_WIDTH_CM}cm wide, and opens to at least a small double.`}
      >
        <Segmented
          value={filters.fit}
          onChange={(v) => set({ fit: v })}
          options={[
            { value: "all", label: "All" },
            { value: "pass", label: "Confirmed" },
          ]}
        />
      </Section>

      <Section title="Bed size" hint="Measured across the sleeper, not along it.">
        <Segmented
          value={filters.bedSize}
          onChange={(v) => set({ bedSize: v })}
          options={[
            { value: "all", label: "Any" },
            { value: "small-double", label: `${MIN_BED_WIDTH_CM}cm+` },
            { value: "double", label: `${FULL_DOUBLE_WIDTH_CM}cm+` },
          ]}
        />
        <p className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">
          A blank bed width never passes as a big bed, and a figure that is really a bed length is treated as blank.
        </p>
      </Section>

      <Section title="Mechanism" hint="How the bed comes out. All four routes are in scope.">
        {(["fold-out", "pull-out", "click-clack", "futon"] as const).map((m) => (
          <Check
            key={m}
            checked={filters.mechanism.includes(m)}
            onChange={() => set({ mechanism: toggle(filters.mechanism, m) })}
            label={MECHANISM_LABEL[m]}
          />
        ))}
      </Section>

      <Section title="Landed budget" hint="Item + delivery. Over-budget rows are flagged, not deleted.">
        <Segmented
          value={filters.budget}
          onChange={(v) => set({ budget: v })}
          options={[
            { value: "all", label: "All prices" },
            { value: "in", label: `Under £${BUDGET_CAP_GBP.toLocaleString()}` },
          ]}
        />
      </Section>

      <Section title="Storage" hint="Somewhere for the duvet, so the bedding doesn't live in the wardrobe.">
        <Check
          checked={filters.beddingStorage}
          onChange={() => set({ beddingStorage: !filters.beddingStorage })}
          label="Has bedding storage"
        />
      </Section>

      {/* Multi-select, because clearance and second-hand are the two routes
          the research says to look at together at this budget — the empty
          state sends you here to tick both. */}
      <Section title="Condition" hint="Doesn't affect the ranking — it changes what you get, not how good the sofa bed is.">
        {conditions.map((c) => (
          <Check
            key={c}
            checked={filters.condition.includes(c)}
            onChange={() => set({ condition: toggle(filters.condition, c) })}
            label={CONDITION_LABEL[c] ?? c}
          />
        ))}
      </Section>

      <Section title="Availability" hint="A sofa bed you can't buy shouldn't be recommended, however well it scores.">
        <Check
          checked={filters.hideSoldOut}
          onChange={() => set({ hideSoldOut: !filters.hideSoldOut })}
          label="Hide sold out"
        />
        <p className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">
          Only listings that say sold out. A retailer who publishes no availability at all is left in.
        </p>
      </Section>

      <Section title="Retailer">
        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          <Radio name="sofabed-retailer" checked={filters.retailer === ""} onChange={() => set({ retailer: "" })} label="All" />
          {retailers.map((r) => (
            <Radio
              key={r}
              name="sofabed-retailer"
              checked={filters.retailer === r}
              onChange={() => set({ retailer: r })}
              label={r}
            />
          ))}
        </div>
      </Section>

      <Section title="Dismissed" hint="A row you've hidden stays hidden — that is what dismissing it was for.">
        <Check
          checked={filters.hideRejected}
          onChange={() => set({ hideRejected: !filters.hideRejected })}
          label="Hide dismissed"
        />
      </Section>
    </div>
  );
}
