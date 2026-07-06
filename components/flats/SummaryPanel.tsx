"use client";

import PickCard from "@/components/flats/PickCard";
import type { EnrichedListing, FlatView } from "@/lib/flat-search/view-model";

const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// --- Timing hero: the page's focal point. Urgency ramps the accent color. ---
function TimingHero({ view }: { view: FlatView }) {
  const d = view.noticeDaysLeft;
  const urgency = d == null ? "accent" : d <= 7 ? "no" : d <= 14 ? "maybe" : "info";
  const tint: Record<string, string> = {
    info: "border-[var(--status-info)]/30 bg-[var(--status-info-bg)]",
    maybe: "border-[var(--status-maybe)]/30 bg-[var(--status-maybe-bg)]",
    no: "border-[var(--status-no)]/30 bg-[var(--status-no-bg)]",
    accent: "border-[var(--border-primary)] bg-[var(--bg-secondary)]",
  };
  const strong: Record<string, string> = {
    info: "text-[var(--status-info)]",
    maybe: "text-[var(--status-maybe)]",
    no: "text-[var(--status-no)]",
    accent: "text-[var(--accent)]",
  };
  return (
    <section className={`grid gap-6 rounded-2xl border p-5 sm:grid-cols-2 sm:p-6 ${tint[urgency]}`}>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Earliest move-out
        </div>
        <div className="mt-1 text-4xl font-bold leading-tight text-[var(--text-primary)] sm:text-5xl">
          {fmtDate(view.moveOutFloor)}
        </div>
        <div className="mt-1 text-sm text-[var(--text-secondary)]">Two full rent periods&rsquo; notice from today</div>
      </div>
      <div className="flex flex-col justify-center sm:items-end sm:text-right">
        {view.noticeDeadline ? (
          <>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Serve notice by {fmtDate(view.noticeDeadline)}
            </div>
            <div className={`mt-1 text-3xl font-bold sm:text-4xl ${strong[urgency]}`}>
              {d} {d === 1 ? "day" : "days"} left
            </div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]">to hold this move-out date</div>
          </>
        ) : (
          <>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Notice</div>
            <div className="mt-1 text-2xl font-bold text-[var(--text-primary)]">Served — date fixed</div>
          </>
        )}
      </div>
    </section>
  );
}

function Kpi({ value, label, context, tone }: { value: string | number; label: string; context?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
      <div className="text-3xl font-bold leading-none" style={{ color: tone ? `var(${tone})` : "var(--text-primary)" }}>
        {value}
      </div>
      <div className="mt-1.5 text-xs font-medium text-[var(--text-primary)]">{label}</div>
      {context && <div className="text-[11px] text-[var(--text-secondary)]">{context}</div>}
    </div>
  );
}

function ChangeChip({ children, tone, onClick }: { children: React.ReactNode; tone: "new" | "gone"; onClick?: () => void }) {
  const cls =
    tone === "new"
      ? "bg-[var(--status-yes-bg)] text-[var(--status-yes)]"
      : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] line-through";
  const base = `rounded-full px-2.5 py-1 text-xs font-medium ${cls}`;
  return onClick ? (
    <button
      onClick={onClick}
      className={`${base} transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]`}
    >
      {children}
    </button>
  ) : (
    <span className={base}>{children}</span>
  );
}

export default function SummaryPanel({
  view,
  onOpenListing,
  onBrowse,
}: {
  view: FlatView;
  onOpenListing: (l: EnrichedListing) => void;
  onBrowse: () => void;
}) {
  const wellTimed = view.listings.filter(
    (l) =>
      l.status === "active" &&
      (l.budgetTier === "in" || l.budgetTier === "btr") &&
      (l.timingFit === "ideal" || l.timingFit === "workable"),
  ).length;
  const newListings = view.listings.filter((l) => l.isNew);
  const gone = view.listings.filter((l) => l.status === "gone" && l.lastConfirmed === view.config.lastRun);
  const picks = view.picks.filter((p) => p.newest);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <TimingHero view={view} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi value={view.counts.active} label="Active homes" context={`last run ${view.config.lastRun ?? "—"}`} />
        <Kpi
          value={view.counts.isNew ? `+${view.counts.isNew}` : 0}
          label="New this run"
          context={view.counts.isNew ? "since last run" : "none added"}
          tone={view.counts.isNew ? "--status-yes" : undefined}
        />
        <Kpi
          value={wellTimed}
          label="Well-timed"
          context={wellTimed ? "in budget" : "expected from ~Aug"}
          tone={wellTimed ? "--status-yes" : undefined}
        />
        <Kpi
          value={view.counts.unconfirmed}
          label="Unconfirmed"
          context={view.counts.unconfirmed ? "portal-blocked" : "all verified"}
          tone={view.counts.unconfirmed ? "--status-maybe" : undefined}
        />
      </div>

      {picks.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Where to look first</h2>
            <span className="text-xs text-[var(--text-secondary)]">newest in-budget pick per tier</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {picks.map((p) => (
              <PickCard
                key={p.tier}
                listing={p.newest!}
                areaName={view.areaById[p.newest!.areaId]?.name ?? p.newest!.areaId}
                tierLabel={p.label}
                onOpen={onOpenListing}
              />
            ))}
          </div>
        </section>
      )}

      {(newListings.length > 0 || gone.length > 0) && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-[var(--text-primary)]">What changed this run</h2>
          <div className="flex flex-wrap gap-2">
            {newListings.map((l) => (
              <ChangeChip key={l.id} tone="new" onClick={() => onOpenListing(l)}>
                ＋ {l.building} £{l.price.toLocaleString()}
              </ChangeChip>
            ))}
            {gone.map((l) => (
              <ChangeChip key={l.id} tone="gone">
                {l.building} £{l.price.toLocaleString()} · {l.goneReason}
              </ChangeChip>
            ))}
          </div>
        </section>
      )}

      <button
        onClick={onBrowse}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-app)]"
      >
        Browse all {view.counts.active} homes →
      </button>
    </div>
  );
}
