"use client";

import type { FlatView } from "@/lib/flat-search/view-model";

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
      <div className="text-2xl font-bold" style={{ color: tone ? `var(${tone})` : "var(--text-primary)" }}>
        {value}
      </div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
    </div>
  );
}

export default function SummaryPanel({ view }: { view: FlatView }) {
  const newListings = view.listings.filter((l) => l.isNew);
  const gone = view.listings.filter((l) => l.status === "gone" && l.lastConfirmed === view.config.lastRun);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active" value={view.counts.active} />
        <Stat label="New this run" value={view.counts.isNew} tone="--status-yes" />
        <Stat label="Unconfirmed" value={view.counts.unconfirmed} tone="--status-maybe" />
        <Stat label="Gone (history)" value={view.counts.gone} tone="--text-muted" />
      </div>

      <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
        <h3 className="mb-2 text-sm font-bold text-[var(--text-primary)]">⏱ Move timing</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          Move-out floor: <strong className="text-[var(--text-primary)]">{view.moveOutFloor}</strong>
          {view.noticeDeadline && (
            <>
              {" · "}notice deadline: <strong className="text-[var(--text-primary)]">{view.noticeDeadline}</strong>
              {view.noticeDaysLeft != null && (
                <span className={view.noticeDaysLeft <= 14 ? "text-[var(--status-no)]" : "text-[var(--text-muted)]"}>
                  {" "}({view.noticeDaysLeft} days left)
                </span>
              )}
            </>
          )}
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-[var(--text-primary)]">Top picks per tier</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {view.picks.map((p) => (
            <div key={p.tier} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
              <div className="mb-1 text-xs font-semibold uppercase text-[var(--text-muted)]">{p.label}</div>
              {p.newest ? (
                <div className="text-sm text-[var(--text-primary)]">
                  <span className="font-medium">{p.newest.building}</span> £{p.newest.price.toLocaleString()}
                  <span className="text-[var(--text-muted)]">
                    {" "}
                    ({p.newest.phaseYear ?? "?"}, {p.newest.budgetTier})
                  </span>
                </div>
              ) : (
                <div className="text-sm text-[var(--text-muted)]">none in budget</div>
              )}
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                Well-timed:{" "}
                {p.wellTimed ? (
                  <span>
                    {p.wellTimed.building} £{p.wellTimed.price.toLocaleString()} ({p.wellTimed.timingFit})
                  </span>
                ) : (
                  <span className="text-[var(--text-muted)]">none yet</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {newListings.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-[var(--text-primary)]">New this run</h3>
          <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
            {newListings.map((l) => (
              <li key={l.id}>
                <span className="text-[var(--status-yes)]">＋</span> {l.building} £{l.price.toLocaleString()}{" "}
                <span className="text-[var(--text-muted)]">
                  [{view.areaById[l.areaId]?.name ?? l.areaId}] · {l.budgetTier}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {gone.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-[var(--text-primary)]">Delisted this run</h3>
          <ul className="space-y-1 text-sm text-[var(--text-muted)]">
            {gone.map((l) => (
              <li key={l.id} className="line-through">
                {l.building} £{l.price.toLocaleString()} — {l.goneReason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
