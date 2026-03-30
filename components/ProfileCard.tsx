import Link from "next/link";
import ScoreBar from "./ScoreBar";
import type { ResearchProfileRow } from "@/lib/types";

interface Props {
  profile: ResearchProfileRow;
}

export default function ProfileCard({ profile }: Props) {
  const n = profile.neighbourhood;
  const status = n?.status;
  const statusBadge: Record<string, string> = {
    yes: "bg-[var(--status-yes-bg)] text-[var(--status-yes)]",
    no: "bg-[var(--status-no-bg)] text-[var(--status-no)]",
    maybe: "bg-[var(--status-maybe-bg)] text-[var(--status-maybe)]",
  };

  return (
    <Link href={`/research/${profile.neighbourhoodId}`} className="block rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 transition-colors hover:border-[var(--border-secondary)]">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <div className="font-semibold text-[var(--text-primary)]">{n?.name}</div>
          <div className="text-xs text-[var(--text-muted)]">{n?.borough} · Zone {n?.zone}</div>
        </div>
        <div className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-lg font-bold text-[var(--text-on-accent)]">{profile.fitScore.toFixed(1)}</div>
      </div>
      <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">{profile.overview}</p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <ScoreBar label="Commute" score={profile.transport.score} />
        <ScoreBar label="Safety" score={profile.safety.score} />
        <ScoreBar label="Rent" score={profile.rentValue.score} />
        <ScoreBar label="New Builds" score={profile.newBuilds.score} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {status && <span className={`rounded px-2 py-0.5 text-[11px] ${statusBadge[status] ?? ""}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>}
        {profile.transport.lines.length > 0 && <span className="rounded bg-[var(--status-info-bg)] px-2 py-0.5 text-[11px] text-[var(--status-info)]">{profile.transport.lines.join(", ")}</span>}
        <span className="rounded bg-[var(--bg-tertiary)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">{profile.transport.commuteMins} min</span>
      </div>
    </Link>
  );
}
