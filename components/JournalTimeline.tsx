import type { JournalEntryRow } from "@/lib/types";

interface Props {
  entries: JournalEntryRow[];
}

function dotColor(decision: string | null): string {
  switch (decision) {
    case "yes": return "bg-[var(--score-good-bar)]";
    case "no": return "bg-[var(--score-bad-bar)]";
    case "maybe": return "bg-[var(--score-mid-bar)]";
    default: return "bg-[var(--accent)]";
  }
}

function badgeStyle(decision: string | null): string {
  switch (decision) {
    case "yes": return "bg-[var(--status-yes-bg)] text-[var(--status-yes)] border-[var(--status-yes)]";
    case "no": return "bg-[var(--status-no-bg)] text-[var(--status-no)] border-[var(--status-no)]";
    case "maybe": return "bg-[var(--status-maybe-bg)] text-[var(--status-maybe)] border-[var(--status-maybe)]";
    default: return "bg-[var(--status-info-bg)] text-[var(--status-info)] border-[var(--status-info)]";
  }
}

function badgeLabel(decision: string | null): string {
  switch (decision) {
    case "yes": return "Changed to Yes";
    case "no": return "Changed to No";
    case "maybe": return "Changed to Maybe";
    default: return "Note";
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function JournalTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[var(--text-muted)] text-sm">No journal entries yet. Add your first note above.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {entries.map((entry, idx) => (
        <div key={entry.id} className="flex gap-4 group">
          {/* Left gutter: line + dot */}
          <div className="flex flex-col items-center">
            <div className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full ${dotColor(entry.decision)} ring-2 ring-[var(--bg-primary)]`} />
            {idx < entries.length - 1 && (
              <div className="w-px flex-1 bg-[var(--border-primary)] mt-1" />
            )}
          </div>

          {/* Content */}
          <div className="pb-6 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${badgeStyle(entry.decision)}`}>
                {badgeLabel(entry.decision)}
              </span>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {entry.neighbourhood ? entry.neighbourhood.name : "General"}
              </span>
              {entry.neighbourhood && (
                <span className="text-xs text-[var(--text-muted)]">{entry.neighbourhood.borough}</span>
              )}
              <span className="ml-auto text-xs text-[var(--text-muted)] flex-shrink-0">{formatDate(entry.createdAt)}</span>
            </div>

            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{entry.content}</p>

            {entry.fitScoreSnapshot != null && (
              <span className="mt-2 inline-block rounded bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs text-[var(--text-secondary)] border border-[var(--border-primary)]">
                Fit score at time: <span className="font-semibold text-[var(--text-primary)]">{entry.fitScoreSnapshot.toFixed(1)}</span>
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
