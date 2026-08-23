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
    <section className="mt-8">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-sm font-bold text-[var(--text-primary)]">{title}</h2>
        <Link href={href} className="text-xs text-[var(--accent)] hover:underline">
          {hrefLabel} →
        </Link>
        {hint && <p className="w-full text-xs text-[var(--text-secondary)]">{hint}</p>}
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
