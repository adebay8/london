"use client";

import { useEffect, useRef, useState } from "react";

// One home for a page's filter rail at every width.
//
// Wide screens: the rail sits in a column on the left, as before.
// Narrow screens: the rail used to be hidden outright, so filtering was
// impossible on a phone or a half-width window. Now a "Filters" button opens
// the same rail in a sheet, and the sheet closes with a button that says how
// many results the choices leave — feedback before you commit (NN/g, "Mobile
// faceted search"). Filters still apply live, so the count is always true.

export default function FilterPanel({
  resultCount,
  children,
}: {
  resultCount: number | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const results =
    resultCount == null ? "Show results" : `Show ${resultCount} result${resultCount === 1 ? "" : "s"}`;

  return (
    <>
      <aside
        aria-label="Filters"
        className="hidden w-64 shrink-0 overflow-y-auto border-r border-[var(--line)] bg-[var(--paper)] p-5 lg:block"
      >
        {children}
      </aside>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="fixed bottom-5 left-1/2 z-30 h-11 -translate-x-1/2 rounded-full bg-[var(--action)] px-6 text-sm font-semibold text-[var(--on-action)] shadow-lg lg:hidden"
      >
        Filters
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button
            type="button"
            aria-label="Close filters"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 right-0 flex w-80 max-w-[90vw] flex-col bg-[var(--paper)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
              <h2 className="text-lg font-semibold text-[var(--ink)]">Filters</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 rounded-full border border-[var(--line-control)] px-4 text-sm font-semibold text-[var(--ink)]"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
            <div className="border-t border-[var(--line)] p-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-11 w-full rounded-full bg-[var(--action)] text-sm font-semibold text-[var(--on-action)]"
              >
                {results}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
