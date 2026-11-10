"use client";

import Link from "next/link";

// A department entrance. One number worth knowing, one line of what's inside,
// and a door. Not a stat readout — the detail lives inside the department.
//
// Drawn as a hairline-topped column, not a boxed card: a row of identical
// boxes reads as decoration, and a whole tile as the click target means the
// title, number and line all lead to the same place (NN/g, "Clickable
// elements"). `accent` marks a department with something new in focus blue.

export default function DepartmentTile({
  href,
  title,
  count,
  countLabel,
  line,
  accent = false,
}: {
  href: string;
  title: string;
  count?: number | string;
  countLabel: string;
  line?: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-1 border-t-2 pt-3 pb-1 transition-colors ${
        accent ? "border-[var(--focus)]" : "border-[var(--line)] hover:border-[var(--ink)]"
      }`}
    >
      <span className="flex items-center gap-1 text-sm font-semibold text-[var(--ink)] group-hover:underline">
        {title}
        <span aria-hidden className="text-[var(--ink-3)] transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-[-0.03em] text-[var(--ink)]">{count ?? "—"}</span>
        <span className="text-xs text-[var(--ink-3)]">{countLabel}</span>
      </span>
      {line && <span className="text-xs leading-snug text-[var(--ink-2)]">{line}</span>}
    </Link>
  );
}
