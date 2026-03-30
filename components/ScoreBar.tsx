interface Props {
  label: string;
  score: number;
  weight?: string;
}

function scoreBarColor(score: number): string {
  if (score >= 7.5) return "bg-[var(--score-good-bar)]";
  if (score >= 5) return "bg-[var(--score-mid-bar)]";
  return "bg-[var(--score-bad-bar)]";
}

function scoreTextColor(score: number): string {
  if (score >= 7.5) return "text-[var(--score-good)]";
  if (score >= 5) return "text-[var(--score-mid)]";
  return "text-[var(--score-bad)]";
}

export default function ScoreBar({ label, score, weight }: Props) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className={`font-semibold ${scoreTextColor(score)}`}>{score.toFixed(1)}/10</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)]">
        <div className={`h-full rounded-full ${scoreBarColor(score)}`} style={{ width: `${score * 10}%` }} />
      </div>
      {weight && <div className="mt-0.5 text-right text-[10px] text-[var(--text-muted)]">{weight}</div>}
    </div>
  );
}
