"use client";

import Link from "next/link";

// A department entrance. One number worth knowing, one line of what's inside,
// and a door. Not a stat readout — the detail lives inside the department.

export default function DepartmentTile({
  href,
  icon,
  title,
  count,
  countLabel,
  line,
  accent = false,
}: {
  href: string;
  icon: string;
  title: string;
  count?: number | string;
  countLabel: string;
  line?: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-1 rounded-xl border p-3 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
        accent
          ? "border-[var(--accent)] bg-[var(--status-info-bg)]"
          : "border-[var(--border-primary)] bg-[var(--bg-primary)]"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-base" aria-hidden>{icon}</span>
        <span className="text-xs font-semibold text-[var(--text-primary)]">{title}</span>
        <span className="ml-auto text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5">→</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
          {count ?? "—"}
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">{countLabel}</span>
      </div>
      {line && <p className="text-[11px] leading-snug text-[var(--text-secondary)]">{line}</p>}
    </Link>
  );
}
