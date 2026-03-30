import type { ResearchProfileRow } from "@/lib/types";

interface Props {
  profiles: ResearchProfileRow[];
}

function scoreCell(score: number) {
  const color = score >= 7.5 ? "text-[var(--score-good)]" : score >= 5 ? "text-[var(--score-mid)]" : "text-[var(--score-bad)]";
  return <span className={`font-semibold ${color}`}>{score.toFixed(1)}</span>;
}

export default function CompareTable({ profiles }: Props) {
  if (profiles.length === 0) return null;

  const rows: { label: string; render: (p: ResearchProfileRow) => React.ReactNode }[] = [
    { label: "Fit Score", render: (p) => <span className="rounded-lg bg-[var(--accent)] px-2 py-1 font-bold text-[var(--text-on-accent)]">{p.fitScore.toFixed(1)}</span> },
    { label: "Commute", render: (p) => <span>{p.transport.commuteMins} min · {scoreCell(p.transport.score)}</span> },
    { label: "Safety", render: (p) => scoreCell(p.safety.score) },
    { label: "Rent (1-bed)", render: (p) => <span className="text-[var(--text-secondary)]">£{p.rentValue.rangeLow.toLocaleString()}-£{p.rentValue.rangeHigh.toLocaleString()}</span> },
    { label: "New Builds", render: (p) => scoreCell(p.newBuilds.score) },
    { label: "Amenities", render: (p) => scoreCell(p.amenities.score) },
    { label: "Area Quality", render: (p) => scoreCell(p.areaQuality.score) },
    { label: "Status", render: (p) => {
      const s = p.neighbourhood?.status;
      const colors: Record<string, string> = { yes: "text-[var(--status-yes)]", no: "text-[var(--status-no)]", maybe: "text-[var(--status-maybe)]" };
      return s ? <span className={colors[s] ?? ""}>{s.charAt(0).toUpperCase() + s.slice(1)}</span> : <span className="text-[var(--text-muted)]">—</span>;
    }},
    { label: "Key Pro", render: (p) => <span className="text-xs text-[var(--text-secondary)]">{p.pros[0] ?? "—"}</span> },
    { label: "Key Con", render: (p) => <span className="text-xs text-[var(--text-secondary)]">{p.cons[0] ?? "—"}</span> },
    { label: "Lines", render: (p) => <span className="text-xs text-[var(--status-info)]">{p.transport.lines.join(", ")}</span> },
  ];

  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className="border-b border-[var(--border-primary)] p-3 text-left text-[var(--text-muted)]"></th>
          {profiles.map((p) => <th key={p.id} className="border-b border-[var(--border-primary)] p-3 text-center font-semibold text-[var(--text-primary)]">{p.neighbourhood?.name}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.label} className={i % 2 === 0 ? "bg-[var(--bg-secondary)]" : ""}>
            <td className="p-3 text-[var(--text-secondary)]">{row.label}</td>
            {profiles.map((p) => <td key={p.id} className="p-3 text-center">{row.render(p)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
