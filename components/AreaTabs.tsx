"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AREA_TABS, isPageActive } from "@/lib/nav";

// Map, Profiles, Rankings and Compare are four views of the same thing — the
// neighbourhoods you're weighing up — so they share one header and switch with
// tabs instead of taking four places in the sidebar. Tabs suit this because
// the views are parallel and you move between them often (NN/g, "Tabs, used
// right").
export default function AreaTabs({ blurb }: { blurb?: string }) {
  const pathname = usePathname();
  return (
    <div className="border-b border-[var(--line)] bg-[var(--paper)] px-4 pt-5 sm:px-6">
      <h1 className="text-2xl font-bold tracking-[-0.02em] text-[var(--ink)]">Areas</h1>
      {blurb && <p className="mt-1 text-sm text-[var(--ink-2)]">{blurb}</p>}
      <nav aria-label="Area views" className="-mb-px mt-3 flex gap-1 overflow-x-auto">
        {AREA_TABS.map((tab) => {
          const active = isPageActive(pathname, tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-10 shrink-0 items-center border-b-2 px-3 text-sm transition-colors ${
                active
                  ? "border-[var(--focus)] font-semibold text-[var(--ink)]"
                  : "border-transparent text-[var(--ink-2)] hover:border-[var(--line-control)] hover:text-[var(--ink)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
