"use client";

import { useEffect } from "react";
import { bodyDepthOf, hasSuspectDepth, seatDepthOf, type Verdict } from "@/lib/sofas/fit";
import type { ScoredSofa } from "@/lib/sofas/score";
import { GOOD_SEAT_DEPTH_CM, REF_DEPTH_CM, TARGET_DEPTH_CM } from "@/lib/sofas/types";

const TONE: Record<string, string> = {
  good: "text-[var(--status-yes)]",
  bad: "text-[var(--status-no)]",
  unknown: "text-[var(--text-muted)]",
};
const MARK: Record<string, string> = { good: "✓", bad: "✕", unknown: "?" };
const VERDICT_TONE: Record<Verdict, string> = { pass: "good", fail: "bad", unknown: "unknown" };
const VERDICT_WORD: Record<Verdict, string> = { pass: "Yes", fail: "No", unknown: "Not published" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 border-b border-[var(--border-secondary)] py-1.5 text-xs">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function VerdictRow({ label, verdict }: { label: string; verdict: Verdict }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border-secondary)] py-1.5 text-xs">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className={`font-medium ${TONE[VERDICT_TONE[verdict]]}`}>
        {MARK[VERDICT_TONE[verdict]]} {VERDICT_WORD[verdict]}
      </span>
    </div>
  );
}

/** Depth against the reference, drawn to scale. The whole brief turns on this
 *  one number, so it earns a picture rather than a table row. */
function DepthBar({ depth }: { depth: number | null }) {
  if (depth == null) {
    return <p className="text-xs text-[var(--text-muted)]">Depth not published by the retailer.</p>;
  }
  const max = Math.max(depth, REF_DEPTH_CM) + 10;
  const pct = (n: number) => `${(n / max) * 100}%`;
  const meets = depth >= TARGET_DEPTH_CM;
  return (
    <div className="space-y-1.5">
      <div>
        <div className="mb-0.5 flex justify-between text-[10px] text-[var(--text-muted)]">
          <span>This sofa</span>
          <span className={meets ? "text-[var(--status-yes)]" : ""}>{depth}cm</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
          <div
            className="h-full rounded-full"
            style={{ width: pct(depth), backgroundColor: meets ? "var(--status-yes)" : "var(--accent)" }}
          />
        </div>
      </div>
      <div>
        <div className="mb-0.5 flex justify-between text-[10px] text-[var(--text-muted)]">
          <span>Raft Loft (the one you liked)</span>
          <span>{REF_DEPTH_CM}cm</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
          <div className="h-full rounded-full bg-[var(--text-muted)]" style={{ width: pct(REF_DEPTH_CM) }} />
        </div>
      </div>
    </div>
  );
}

export default function SofaDetail({ sofa, onClose }: { sofa: ScoredSofa | null; onClose: () => void }) {
  useEffect(() => {
    if (!sofa) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sofa, onClose]);

  if (!sofa) return null;
  const s = sofa;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button onClick={onClose} aria-label="Close details" className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${s.brand} ${s.model} full specification`}
        className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-[var(--border-primary)] bg-[var(--bg-primary)] p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{s.retailer}</div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{s.model}</h2>
            <div className="text-sm text-[var(--text-secondary)]">{s.brand}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
            ✕
          </button>
        </div>

        {s.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.imageUrl} alt="" className="mt-3 aspect-[4/3] w-full rounded-xl object-cover" />
        )}

        <a
          href={s.productUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 rounded-lg bg-[var(--accent)] px-3 py-2 text-center text-sm font-semibold text-white hover:opacity-90"
        >
          View at {s.retailer} ↗
        </a>

        <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Depth</h3>
        <div className="mt-2 rounded-xl bg-[var(--bg-secondary)] p-3">
          <DepthBar depth={bodyDepthOf(s)} />
          {hasSuspectDepth(s) && (
            <p className="mt-2 rounded bg-[var(--bg-tertiary)] p-2 text-[11px] leading-snug text-[var(--text-secondary)]">
              The retailer lists {s.overallDepthCm}cm, but that is the L-shape&apos;s footprint — how far the chaise
              projects into the room — not how deep the sofa is back to front. Treated as unpublished rather than as a
              very deep sofa.
            </p>
          )}
          <p className="mt-2 text-[11px] leading-snug text-[var(--text-muted)]">
            Overall depth includes the back cushions. The seat itself is usually 25–30cm less, and that is the part that
            supports your legs — anything past about {GOOD_SEAT_DEPTH_CM}cm of seat does the job.
            {seatDepthOf(s) != null && (
              <span className="font-medium text-[var(--text-secondary)]"> This one publishes a {seatDepthOf(s)}cm seat.</span>
            )}
          </p>
        </div>

        <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Meets the brief?</h3>
        <div className="mt-1">
          <VerdictRow label="At least 2 seats" verdict={s.fit.seats} />
          <VerdictRow label="Has a leg rest" verdict={s.fit.legRest} />
          <VerdictRow label="Fits 250cm of wall" verdict={s.fit.width} />
        </div>
        {s.fit.notes.length > 0 && (
          <ul className="mt-2 space-y-1">
            {s.fit.notes.map((n) => (
              <li key={n} className="text-[11px] leading-snug text-[var(--text-secondary)]">· {n}</li>
            ))}
          </ul>
        )}

        <div className="mt-5 rounded-xl bg-[var(--bg-secondary)] p-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold [font-variant-numeric:tabular-nums]">
              £{Math.round(s.landedCostGbp).toLocaleString()}
            </span>
            <span className="text-xs text-[var(--text-muted)]">landed</span>
          </div>
          <dl className="mt-2">
            <Row label="Item price" value={`£${s.priceGbp.toLocaleString()}`} />
            <Row label="Was" value={s.rrpGbp ? `£${s.rrpGbp.toLocaleString()}` : null} />
            <Row label="Delivery" value={s.deliveryIncluded ? "Included" : s.deliveryCostGbp != null ? `£${s.deliveryCostGbp}` : null} />
            <Row label="Condition" value={s.condition} />
            <Row label="Stock" value={s.oneOff ? "One-off — cannot be reordered" : null} />
          </dl>
        </div>

        <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Why it ranks {Math.round(s.score)}/100
        </h3>
        <div className="mt-2 flex gap-4 rounded-lg bg-[var(--bg-secondary)] p-2.5 text-xs">
          <div>
            <div className="font-bold [font-variant-numeric:tabular-nums]">{s.rawScore}</div>
            <div className="text-[10px] text-[var(--text-muted)]">on measured specs</div>
          </div>
          <div>
            <div className="font-bold [font-variant-numeric:tabular-nums]">{Math.round(s.confidence * 100)}%</div>
            <div className="text-[10px] text-[var(--text-muted)]">of criteria known</div>
          </div>
          <div>
            <div className="font-bold [font-variant-numeric:tabular-nums]">{Math.round(s.styleMatch * 100)}%</div>
            <div className="text-[10px] text-[var(--text-muted)]">like the Raft</div>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-muted)]">
          Unpublished specs are excluded from the average, never scored as zero. Style match is reported separately —
          a sofa can be well built and look nothing like the reference.
        </p>

        <ul className="mt-2 space-y-1">
          {s.reasons.map((r) => (
            <li key={r.label} className={`flex gap-2 text-xs ${TONE[r.tone]}`}>
              <span aria-hidden>{MARK[r.tone]}</span>
              <span>{r.label}</span>
            </li>
          ))}
        </ul>
        {s.gaps.length > 0 && (
          <p className="mt-2 text-[11px] leading-snug text-[var(--text-muted)]">
            <span className="font-medium">Not published:</span> {s.gaps.join(", ")}.
          </p>
        )}

        <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Specification</h3>
        <dl className="mt-1">
          <Row label="Overall" value={s.overallWidthCm != null ? `${s.overallWidthCm} × ${s.overallDepthCm ?? "?"} × ${s.overallHeightCm ?? "?"} cm (W×D×H)` : null} />
          <Row label="Seat depth" value={seatDepthOf(s) != null ? `${seatDepthOf(s)}cm` : null} />
          <Row label="Seat height" value={s.seatHeightCm != null ? `${s.seatHeightCm}cm` : null} />
          <Row label="Seats" value={s.seats} />
          <Row label="Leg rest" value={s.legRest} />
          <Row label="Chaise side" value={s.chaiseSide} />
          <Row label="Modular" value={s.modular == null ? null : s.modular ? "Yes" : "No"} />
          <Row label="Arms" value={s.armStyle} />
          <Row label="Fabric" value={s.fabric} />
          <Row label="Colourway" value={s.colourwayShown} />
          <Row label="Easy clean" value={s.easyClean == null ? null : s.easyClean ? "Yes" : "No"} />
          <Row label="Removable covers" value={s.removableCovers == null ? null : s.removableCovers ? "Yes" : "No"} />
          <Row label="Seat filling" value={s.seatFilling} />
          <Row label="Frame" value={s.frameMaterial} />
          <Row label="Warranty" value={s.warranty} />
          <Row label="Returns" value={s.returnsWindow} />
          <Row label="Lead time" value={s.deliveryLeadTime} />
          <Row label="Reviews" value={s.reviewScore != null ? `${s.reviewScore}${s.reviewCount ? ` (${s.reviewCount.toLocaleString()})` : ""}` : null} />
        </dl>

        {s.notes && (
          <>
            <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Research notes</h3>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]">{s.notes}</p>
          </>
        )}
      </aside>
    </div>
  );
}
