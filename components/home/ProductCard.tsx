"use client";

import type { Product } from "@/app/api/summary/route";

// A shop card: picture first, price loud, one reason to care. The score is
// deliberately quiet — it belongs to the ranking pages, and a shelf is for
// recognising something you like, not auditing it.

/** `tone` exists because the dark palette gives --bg-primary and --bg-secondary
 *  the same value, so a default card sitting inside a --bg-secondary panel
 *  dissolves into it. "sunken" drops the card to --bg-app, which is genuinely
 *  darker in dark mode and still reads as a surface in light mode. */
export default function ProductCard({
  p,
  width = "w-44",
  tone = "default",
}: {
  p: Product;
  width?: string;
  tone?: "default" | "sunken";
}) {
  const href = p.dept === "flat" ? p.href : p.url;
  const external = p.dept !== "flat";

  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      // `block` matters: an <a> is inline by default, and an inline element
      // ignores width. Inside a flex shelf it gets blockified and the width
      // lands, but anywhere else the card silently sizes to its own title.
      className={`group block ${width} shrink-0 snap-start rounded-xl border border-[var(--border-primary)] ${
        tone === "sunken" ? "bg-[var(--bg-app)]" : "bg-[var(--bg-primary)]"
      } p-2 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]`}
    >
      <div className="relative mb-2 aspect-square overflow-hidden rounded-lg bg-[var(--bg-tertiary)]">
        {p.image ? (
          // Plain <img>: the corpus spans a dozen retailer CDNs, so the Next
          // image optimiser would need a remotePattern per host.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.image}
            alt=""
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          // Not every retailer exposes a photo — several render their PDPs
          // entirely client-side. Make the gap look deliberate rather than
          // broken: a plain tile with the department mark, not a lonely glyph.
          <div
            className="flex h-full flex-col items-center justify-center gap-1 bg-[var(--bg-tertiary)]"
            aria-label="No photo published"
          >
            <span className="text-3xl opacity-70" aria-hidden>
              {p.dept === "bed" ? "🛏️" : p.dept === "console" ? "📺" : "🔑"}
            </span>
            <span className="text-[9px] uppercase tracking-wide text-[var(--text-muted)]">no photo</span>
          </div>
        )}
        {p.saved && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-semibold text-white">
            ♥ Saved
          </span>
        )}
      </div>

      {p.eyebrow && (
        <div className="truncate text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{p.eyebrow}</div>
      )}
      <div className="line-clamp-2 min-h-[2.1rem] text-xs font-medium leading-snug text-[var(--text-primary)]">
        {p.label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-sm font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
          £{p.price.toLocaleString()}
        </span>
        {p.priceSuffix && <span className="text-[10px] text-[var(--text-muted)]">{p.priceSuffix}</span>}
      </div>
      {p.badge && (
        <div className="mt-1 truncate text-[10px] font-medium text-[var(--status-yes)]">{p.badge}</div>
      )}
    </a>
  );
}
