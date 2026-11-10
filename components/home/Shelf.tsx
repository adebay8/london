"use client";

import Link from "next/link";
import ProductCard from "./ProductCard";
import type { Product } from "@/app/api/summary/route";

// A shop aisle: a titled row you scan sideways. Horizontal scroll rather than a
// grid, so a shelf takes one band of vertical space no matter how much is on it.

export default function Shelf({
  title,
  hint,
  href,
  hrefLabel,
  items,
  empty,
}: {
  title: string;
  hint?: string;
  href: string;
  hrefLabel: string;
  items: Product[];
  empty?: string;
}) {
  return (
    <section className="mt-10">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-lg font-semibold text-[var(--ink)]">{title}</h2>
        <Link href={href} className="text-sm font-medium text-[var(--focus)] underline-offset-2 hover:underline">
          {hrefLabel} →
        </Link>
        {hint && <p className="mt-0.5 w-full max-w-[68ch] text-sm text-[var(--ink-2)]">{hint}</p>}
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-primary)] p-5 text-center text-xs text-[var(--text-muted)]">
          {empty ?? "Nothing here yet."}
        </p>
      ) : (
        <div className="-mx-1 flex snap-x items-start gap-3 overflow-x-auto px-1 pb-2">
          {items.map((p) => (
            <ProductCard key={`${p.dept}-${p.id}`} p={p} />
          ))}
        </div>
      )}
    </section>
  );
}
