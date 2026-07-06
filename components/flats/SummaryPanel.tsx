"use client";

import type { EnrichedListing, FlatView } from "@/lib/flat-search/view-model";

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
      <div className="text-2xl font-bold" style={{ color: tone ? `var(${tone})` : "var(--text-primary)" }}>
        {value}
      </div>
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
    </div>
  );
}

// A pill that jumps to the listing in the Homes tab. Reads clearly as clickable + keyboard-operable.
function OpenButton({
  listing,
  onOpen,
  children,
}: {
  listing: EnrichedListing;
  onOpen: (l: EnrichedListing) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onOpen(listing)}
      className="group inline-flex items-center gap-1 rounded text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      aria-label={`View ${listing.building} £${listing.price.toLocaleString()} in Homes`}
    >
      {children}
      <span aria-hidden className="text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100">
        →
      </span>
    </button>
  );
}

export default function SummaryPanel({
  view,
  onOpenListing,
}: {
  view: FlatView;
  onOpenListing: (l: EnrichedListing) => void;
}) {
  const newListings = view.listings.filter((l) => l.isNew);
  const gone = view.listings.filter((l) => l.status === "gone" && l.lastConfirmed === view.config.lastRun);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active" value={view.counts.active} />
        <Stat label="New this run" value={view.counts.isNew} tone="--status-yes" />
        <Stat label="Unconfirmed" value={view.counts.unconfirmed} tone="--status-maybe" />
        <Stat label="Gone (history)" value={view.counts.gone} tone="--text-secondary" />
      </div>

      <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
        <h3 className="mb-2 text-sm font-bold text-[var(--text-primary)]">⏱ Move timing</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          Move-out floor: <strong className="text-[var(--text-primary)]">{view.moveOutFloor}</strong>
          {view.noticeDeadline && (
            <>
              {" · "}notice deadline: <strong className="text-[var(--text-primary)]">{view.noticeDeadline}</strong>
              {view.noticeDaysLeft != null && (
                <span className={view.noticeDaysLeft <= 14 ? "text-[var(--status-no)]" : "text-[var(--text-secondary)]"}>
                  {" "}({view.noticeDaysLeft} days left)
                </span>
              )}
            </>
          )}
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-[var(--text-primary)]">Top picks per tier</h3>
        <p className="mb-2 text-xs text-[var(--text-secondary)]">Tap a pick to open it in Homes.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {view.picks.map((p) => (
            <div key={p.tier} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
              <div className="mb-1 text-xs font-semibold uppercase text-[var(--text-secondary)]">{p.label}</div>
              {p.newest ? (
                <OpenButton listing={p.newest} onOpen={onOpenListing}>
                  <span className="text-sm text-[var(--text-primary)]">
                    <span className="font-medium">{p.newest.building}</span> £{p.newest.price.toLocaleString()}
                    <span className="text-[var(--text-secondary)]">
                      {" "}
                      ({p.newest.phaseYear ?? "?"}, {p.newest.budgetTier})
                    </span>
                  </span>
                </OpenButton>
              ) : (
                <div className="text-sm text-[var(--text-secondary)]">none in budget</div>
              )}
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                Well-timed:{" "}
                {p.wellTimed ? (
                  <OpenButton listing={p.wellTimed} onOpen={onOpenListing}>
                    <span>
                      {p.wellTimed.building} £{p.wellTimed.price.toLocaleString()} ({p.wellTimed.timingFit})
                    </span>
                  </OpenButton>
                ) : (
                  <span className="text-[var(--text-secondary)]">none yet</span>
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
                <OpenButton listing={l} onOpen={onOpenListing}>
                  <span>
                    <span className="text-[var(--status-yes)]" aria-hidden>
                      ＋
                    </span>{" "}
                    <span className="text-[var(--text-primary)]">{l.building}</span> £{l.price.toLocaleString()}{" "}
                    <span className="text-[var(--text-secondary)]">
                      [{view.areaById[l.areaId]?.name ?? l.areaId}] · {l.budgetTier}
                    </span>
                  </span>
                </OpenButton>
              </li>
            ))}
          </ul>
        </div>
      )}

      {gone.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-[var(--text-primary)]">Delisted this run</h3>
          <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
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
