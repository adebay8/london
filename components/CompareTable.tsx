import type { ResearchProfileRow } from "@/lib/types";
import { calculateCouncilTax, calculateCommuteCost, DEFAULT_COMMUTE_DAYS, type Band } from "@/data/cost-data";

export interface RentOverride {
  low: number;
  high: number;
}

interface Props {
  profiles: ResearchProfileRow[];
  band?: Band;
  singlePerson?: boolean;
  commuteDays?: number;
  rentOverrides?: Record<string, RentOverride>;
  onRentOverride?: (neighbourhoodId: string, low: number, high: number) => void;
}

function scoreCell(score: number) {
  const color = score >= 7.5 ? "text-[var(--score-good)]" : score >= 5 ? "text-[var(--score-mid)]" : "text-[var(--score-bad)]";
  return <span className={`font-semibold ${color}`}>{score.toFixed(1)}</span>;
}

export default function CompareTable({ profiles, band = "C", singlePerson = false, commuteDays = DEFAULT_COMMUTE_DAYS, rentOverrides = {}, onRentOverride }: Props) {
  if (profiles.length === 0) return null;

  function getRent(p: ResearchProfileRow): { low: number; high: number } {
    const override = rentOverrides[p.neighbourhoodId];
    if (override) return override;
    return { low: p.rentValue.rangeLow, high: p.rentValue.rangeHigh };
  }

  function costSummary(p: ResearchProfileRow) {
    const borough = p.neighbourhood?.borough ?? "";
    const zone = p.neighbourhood?.zone ?? 3;
    const tax = Math.round(calculateCouncilTax(borough, band, singlePerson));
    const commute = calculateCommuteCost(zone, commuteDays);
    const rent = getRent(p);
    return { tax, commute, totalLow: rent.low + tax + commute, totalHigh: rent.high + tax + commute };
  }

  // Find the lowest totalLow for highlighting
  const totals = profiles.map((p) => costSummary(p).totalLow);
  const bestTotal = Math.min(...totals);

  const rows: { label: string; render: (p: ResearchProfileRow) => React.ReactNode }[] = [
    { label: "Fit Score", render: (p) => <span className="rounded-lg bg-[var(--accent)] px-2 py-1 font-bold text-[var(--text-on-accent)]">{p.fitScore.toFixed(1)}</span> },
    { label: "Commute", render: (p) => <span>{p.transport.commuteMins} min · {scoreCell(p.transport.score)}</span> },
    { label: "Safety", render: (p) => scoreCell(p.safety.score) },
    { label: "Rent (1-bed)", render: (p) => {
      const rent = getRent(p);
      return (
        <div className="flex items-center justify-center gap-1">
          <span className="text-xs text-[var(--text-muted)]">£</span>
          <input
            type="number"
            value={rent.low}
            onChange={(e) => onRentOverride?.(p.neighbourhoodId, Number(e.target.value) || 0, rent.high)}
            className="w-16 rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-center text-xs text-[var(--text-primary)]"
          />
          <span className="text-xs text-[var(--text-muted)]">–</span>
          <input
            type="number"
            value={rent.high}
            onChange={(e) => onRentOverride?.(p.neighbourhoodId, rent.low, Number(e.target.value) || 0)}
            className="w-16 rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-center text-xs text-[var(--text-primary)]"
          />
        </div>
      );
    }},
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
    { label: "Council Tax", render: (p) => {
      const { tax } = costSummary(p);
      return <span className="text-[var(--text-secondary)]">£{tax}/mo</span>;
    }},
    { label: "Commute Cost", render: (p) => {
      const { commute } = costSummary(p);
      return <span className="text-[var(--text-secondary)]">£{commute}/mo</span>;
    }},
    { label: "Est. Total/mo", render: (p) => {
      const { totalLow, totalHigh } = costSummary(p);
      const isBest = totalLow === bestTotal;
      const color = isBest ? "text-[var(--status-yes)]" : "text-[var(--text-primary)]";
      return (
        <span className={`font-semibold ${color}`}>
          {totalLow === totalHigh
            ? `£${totalLow.toLocaleString()}`
            : `£${totalLow.toLocaleString()}–£${totalHigh.toLocaleString()}`}
        </span>
      );
    }},
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
