"use client";

import type { Area } from "@/lib/flat-search/types";

export interface FilterState {
  areas: string[]; // empty = all
  tiers: string[]; // "anchor" | "1" | "2"; empty = all
  schemes: string[]; // "btr" | "private"; empty = all
  bands: string[]; // "in" | "btr" | "over"
  wellTimedOnly: boolean;
  newOnly: boolean;
  topPicksOnly: boolean;
  hideGone: boolean;
  hideRejected: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
  areas: [],
  tiers: [],
  schemes: [],
  bands: ["in", "btr"],
  wellTimedOnly: false,
  newOnly: false,
  topPicksOnly: false,
  hideGone: true,
  hideRejected: false,
};

function toggle(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-[var(--accent)]" />
      {label}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--border-secondary)] py-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export default function FilterRail({
  areas,
  filters,
  onChange,
}: {
  areas: Area[];
  filters: FilterState;
  onChange: (f: FilterState) => void;
}) {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  return (
    <div className="text-[var(--text-primary)]">
      <div className="flex items-center justify-between pb-2">
        <span className="text-sm font-bold">Filters</span>
        <button onClick={() => onChange(DEFAULT_FILTERS)} className="text-xs text-[var(--accent)] hover:underline">
          reset
        </button>
      </div>

      <Section title="View">
        <Check
          checked={filters.topPicksOnly}
          onChange={() => set({ topPicksOnly: !filters.topPicksOnly })}
          label="Top picks only"
        />
        <Check checked={filters.newOnly} onChange={() => set({ newOnly: !filters.newOnly })} label="New this run" />
        <Check
          checked={filters.wellTimedOnly}
          onChange={() => set({ wellTimedOnly: !filters.wellTimedOnly })}
          label="Well-timed only"
        />
        <Check checked={filters.hideGone} onChange={() => set({ hideGone: !filters.hideGone })} label="Hide delisted" />
        <Check
          checked={filters.hideRejected}
          onChange={() => set({ hideRejected: !filters.hideRejected })}
          label="Hide rejected"
        />
      </Section>

      <Section title="Budget band">
        {(["in", "btr", "over"] as const).map((b) => (
          <Check
            key={b}
            checked={filters.bands.includes(b)}
            onChange={() => set({ bands: toggle(filters.bands, b) })}
            label={b === "in" ? "In budget" : b === "btr" ? "BTR band" : "Over budget"}
          />
        ))}
      </Section>

      <Section title="Scheme">
        {(["btr", "private"] as const).map((s) => (
          <Check
            key={s}
            checked={filters.schemes.includes(s)}
            onChange={() => set({ schemes: toggle(filters.schemes, s) })}
            label={s === "btr" ? "Build-to-rent" : "Private"}
          />
        ))}
      </Section>

      <Section title="Tier">
        {(["anchor", "1", "2"] as const).map((t) => (
          <Check
            key={t}
            checked={filters.tiers.includes(t)}
            onChange={() => set({ tiers: toggle(filters.tiers, t) })}
            label={t === "anchor" ? "Anchor" : `Tier ${t}`}
          />
        ))}
      </Section>

      <Section title="Area">
        {areas.map((a) => (
          <Check
            key={a.id}
            checked={filters.areas.includes(a.id)}
            onChange={() => set({ areas: toggle(filters.areas, a.id) })}
            label={a.name}
          />
        ))}
      </Section>
    </div>
  );
}
