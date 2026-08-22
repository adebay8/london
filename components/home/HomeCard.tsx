"use client";

import Link from "next/link";

// One workstream, one card. The headline number is the thing you'd want to
// know without clicking; the stats are context; the footer is the current
// front runner where a workstream has one.

export interface Stat {
  label: string;
  value: string | number;
  tone?: "good" | "bad" | "maybe" | "muted";
}

const TONE: Record<string, string> = {
  good: "text-[var(--status-yes)]",
  bad: "text-[var(--status-no)]",
  maybe: "text-[var(--status-maybe)]",
  muted: "text-[var(--text-secondary)]",
};

export default function HomeCard({
  href,
  icon,
  title,
  headline,
  headlineLabel,
  stats = [],
  footer,
  loading = false,
}: {
  href: string;
  icon: string;
  title: string;
  headline?: string | number;
  headlineLabel?: string;
  stats?: Stat[];
  footer?: { label: string; detail?: string | null } | null;
  loading?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          {icon}
        </span>
        <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
        <span className="ml-auto text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5">→</span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
          {loading ? "—" : (headline ?? "—")}
        </span>
        {headlineLabel && <span className="text-xs text-[var(--text-muted)]">{headlineLabel}</span>}
      </div>

      {stats.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {stats.map((s) => (
            <div key={s.label} className="text-[11px]">
              <span className={`font-semibold [font-variant-numeric:tabular-nums] ${TONE[s.tone ?? "muted"]}`}>
                {loading ? "—" : s.value}
              </span>{" "}
              <span className="text-[var(--text-muted)]">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {footer && (
        <div className="mt-auto border-t border-[var(--border-secondary)] pt-2">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Front runner</div>
          <div className="truncate text-xs font-medium text-[var(--text-primary)]">{footer.label}</div>
          {footer.detail && <div className="truncate text-[11px] text-[var(--text-secondary)]">{footer.detail}</div>}
        </div>
      )}
    </Link>
  );
}
