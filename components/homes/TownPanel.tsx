"use client";

import Link from "next/link";
import type { BuyTown } from "@/lib/homes/types";

// The research state of one town: what was searched, why coverage is thin,
// any decision you need to make, and the leads still to capture. Shown when a
// town is chosen, so the gaps in the data are as visible as the data.

const k = (p: number) => `£${Math.round(p / 1000)}k`;

export default function TownPanel({
  town,
  count,
  onClear,
  clearLabel = "Show all towns",
  homesHref,
}: {
  town: BuyTown;
  count: number;
  onClear: () => void;
  clearLabel?: string;
  /** On the Towns page: a link through to this town's homes. */
  homesHref?: string;
}) {
  return (
    <section aria-labelledby="town-heading" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="mr-auto">
          <h2 id="town-heading" className="text-lg font-semibold text-[var(--ink)]">
            {town.town} <span className="font-normal text-[var(--ink-3)]">· {town.station} station</span>
          </h2>
          <p className="text-sm text-[var(--ink-2)]">
            {count ? `${count} home${count === 1 ? "" : "s"} captured` : "No homes captured yet"}
            {town.lastSearchedAt && ` · searched ${town.lastSearchedAt.split("-").reverse().join("/")}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {homesHref && count > 0 && (
            <Link href={homesHref} className="flex h-9 items-center rounded-full bg-[var(--action)] px-4 text-sm font-semibold text-[var(--on-action)]">
              See its {count} homes
            </Link>
          )}
          <button
            type="button"
            onClick={onClear}
            className="h-9 rounded-full border border-[var(--line-control)] px-4 text-sm font-semibold text-[var(--ink)]"
          >
            {clearLabel}
          </button>
        </div>
      </div>

      {town.policy && (
        <p className="mt-4 rounded-lg border-l-4 border-[var(--counter)] bg-[var(--counter-wash)] px-3 py-2 text-sm text-[var(--ink)]">
          <span className="font-semibold">Decision needed: </span>
          {town.policy}
        </p>
      )}

      <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        {town.gap && (
          <div>
            <dt className="text-xs text-[var(--ink-3)]">Why coverage is thin</dt>
            <dd className="mt-0.5 font-serif leading-snug text-[var(--ink)]">{town.gap}</dd>
          </div>
        )}
        {town.nextAction && (
          <div>
            <dt className="text-xs text-[var(--ink-3)]">Next research step</dt>
            <dd className="mt-0.5 font-medium text-[var(--ink)]">{town.nextAction}</dd>
          </div>
        )}
        {town.searched && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-[var(--ink-3)]">Searched</dt>
            <dd className="mt-0.5 text-[var(--ink-2)]">{town.searched}</dd>
          </div>
        )}
      </dl>

      {town.leads.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs text-[var(--ink-3)]">Leads seen without a link</h3>
          <ul className="mt-1 divide-y divide-[var(--line)]">
            {town.leads.map((l, i) => (
              <li key={i} className="flex items-baseline gap-3 py-1.5 text-sm">
                <span className="mr-auto text-[var(--ink)]">{l.label}</span>
                <span className="text-[var(--ink-2)] tabular">{l.priceGbp ? k(l.priceGbp) : "price not seen"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
