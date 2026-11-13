import Link from "next/link";

// One of the standout answers ("Quickest train", "Cheapest house"…). Each is
// a door to the homes behind it.
export default function Pick({ label, title, detail, href, cta = "See these homes" }: { label: string; title: string; detail: string; href: string; cta?: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-start rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-left transition-colors hover:border-[var(--line-control)]"
    >
      <span className="text-xs font-medium text-[var(--ink-3)]">{label}</span>
      <span className="mt-1 text-xl font-bold tracking-[-0.015em] text-[var(--ink)]">{title}</span>
      <span className="mt-0.5 text-sm text-[var(--ink-2)]">{detail}</span>
      <span className="mt-2 text-xs font-medium text-[var(--focus)] group-hover:underline">{cta}</span>
    </Link>
  );
}
