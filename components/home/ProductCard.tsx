"use client";

import NoPhoto from "@/components/NoPhoto";
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
      } p-2 transition-colors hover:border-[var(--line-control)]`}
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
            className="h-full w-full object-contain"
          />
        ) : (
          // Not every retailer exposes a photo — several render their PDPs
          // entirely client-side. Make the gap look deliberate rather than
          // broken: a plain tile with the department mark, not a lonely glyph.
          <NoPhoto />
        )}
        {p.saved && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-[var(--action)] px-1.5 py-0.5 text-xs font-semibold text-[var(--on-action)]">
            ♥ Saved
          </span>
        )}
      </div>

      {p.eyebrow && (
        <div className="truncate text-xs text-[var(--text-muted)]">{p.eyebrow}</div>
      )}
      <div className="line-clamp-2 min-h-[2.1rem] text-xs font-medium leading-snug text-[var(--text-primary)]">
        {p.label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-sm font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
          £{p.price.toLocaleString()}
        </span>
        {p.priceSuffix && <span className="text-xs text-[var(--text-muted)]">{p.priceSuffix}</span>}
        {/* Leaving the app is announced, not discovered (NN/g, "Opening links in new windows"). */}
        {external && (
          <svg className="ml-auto shrink-0 self-center text-[var(--ink-3)]" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M6 3H3v10h10v-3M9 3h4v4M13 3 7 9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      {external && <span className="sr-only">(opens the retailer&apos;s site in a new tab)</span>}
      {p.badge && (
        <div className="mt-1 truncate text-xs font-medium text-[var(--status-yes)]">{p.badge}</div>
      )}
    </a>
  );
}
