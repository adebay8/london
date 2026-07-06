"use client";

import type { FlatView } from "@/lib/flat-search/view-model";

export default function OperatorsPanel({ view }: { view: FlatView }) {
  const btrByArea = (areaId: string) =>
    view.listings.filter((l) => l.areaId === areaId && l.scheme === "btr" && l.status === "active");

  return (
    <div className="space-y-3">
      {view.areas.map((a) => {
        const btr = btrByArea(a.id);
        return (
          <div key={a.id} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{a.name}</h3>
              <span className="text-xs text-[var(--text-secondary)]">
                {a.borough} · Zone {a.zone} · {a.tier === "anchor" ? "Anchor" : `Tier ${a.tier}`}
              </span>
            </div>
            {a.btrOperators.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {a.btrOperators.map((op) => (
                  <span
                    key={op}
                    className="rounded bg-[var(--status-info-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--status-info)]"
                  >
                    {op}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {a.operatorPortals.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  {new URL(url).hostname.replace("www.", "")}
                </a>
              ))}
            </div>
            <div className="mt-2 text-xs text-[var(--text-secondary)]">
              {btr.length} active BTR listing{btr.length === 1 ? "" : "s"} tracked
            </div>
          </div>
        );
      })}
    </div>
  );
}
