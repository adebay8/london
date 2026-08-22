"use client";

import { useEffect } from "react";
import { financeFor, financeLabel } from "@/lib/beds/finance";
import type { ScoredBed } from "@/lib/beds/score";

// The card shows what decides the purchase. This drawer is where the rest of
// the research lives — including the long-tail columns kept in `extra`.

const TONE: Record<string, string> = {
  good: "text-[var(--status-yes)]",
  bad: "text-[var(--status-no)]",
  unknown: "text-[var(--text-muted)]",
};

const MARK: Record<string, string> = { good: "✓", bad: "✕", unknown: "?" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 border-b border-[var(--border-secondary)] py-1.5 text-xs">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function humanise(key: string): string {
  return key.replace(/_/g, " ").replace(/\bgbp\b/i, "£").replace(/\bcm\b/i, "(cm)").replace(/^./, (c) => c.toUpperCase());
}

export default function BedDetail({ bed, onClose }: { bed: ScoredBed | null; onClose: () => void }) {
  useEffect(() => {
    if (!bed) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bed, onClose]);

  if (!bed) return null;
  const b = bed;
  const fin = financeFor(b);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        onClick={onClose}
        aria-label="Close details"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${b.brand} ${b.model} full specification`}
        className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-[var(--border-primary)] bg-[var(--bg-primary)] p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{b.retailer}</div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{b.model}</h2>
            <div className="text-sm text-[var(--text-secondary)]">{b.brand}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            ✕
          </button>
        </div>

        <a
          href={b.productUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 rounded-lg bg-[var(--accent)] px-3 py-2 text-center text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          View at {b.retailer} ↗
        </a>

        <div className="mt-4 rounded-xl bg-[var(--bg-secondary)] p-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold [font-variant-numeric:tabular-nums]">
              £{Math.round(b.landedCostGbp).toLocaleString()}
            </span>
            <span className="text-xs text-[var(--text-muted)]">landed cost</span>
          </div>
          <dl className="mt-2">
            <Row label="Item price" value={`£${b.doublePriceGbp.toLocaleString()}`} />
            <Row label="Delivery" value={b.deliveryIncluded ? "Included" : b.deliveryCostGbp != null ? `£${b.deliveryCostGbp}` : null} />
            <Row label="Assembly" value={b.assemblyIncluded ? "Included" : b.assemblyCostGbp != null ? `£${b.assemblyCostGbp}` : "Not offered"} />
            <Row label="Extra cost" value={b.extraMembershipCost} />
          </dl>
        </div>

        {(b.finance.available || fin.blockedBy) && (
          <>
            <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Finance
            </h3>
            {fin.eligible ? (
              <div className="mt-1">
                <div className={`text-sm font-semibold ${fin.interestFree ? "text-[var(--status-yes)]" : "text-[var(--text-primary)]"}`}>
                  {financeLabel(fin)}
                  {fin.monthly != null && ` · £${fin.monthly.toFixed(2)}/mo`}
                </div>
                <dl className="mt-1">
                  <Row label="Type" value={b.finance.type} />
                  <Row label="Provider" value={b.finance.provider} />
                  <Row label="Representative APR" value={b.finance.apr != null ? `${b.finance.apr}%` : null} />
                  <Row label="Interest-free term" value={b.finance.maxMonths ? `${b.finance.maxMonths} months` : null} />
                  <Row label="Minimum spend" value={b.finance.minSpend != null ? `£${b.finance.minSpend}` : null} />
                  <Row
                    label="Term ladder"
                    value={
                      b.finance.tiers.length > 1
                        ? b.finance.tiers
                            .slice()
                            .sort((x, y) => x.minSpend - y.minSpend)
                            .map((t) => `${t.months}m from £${t.minSpend}`)
                            .join(" · ")
                        : null
                    }
                  />
                  <Row label="Deposit" value={b.finance.deposit} />
                  <Row label="Terms" value={b.finance.notes} />
                </dl>
                {b.finance.url && (
                  <a
                    href={b.finance.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-[var(--accent)] hover:underline"
                  >
                    Retailer&apos;s finance terms ↗
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-1 text-xs text-[var(--text-muted)]">{fin.blockedBy}</p>
            )}
          </>
        )}

        <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Why it ranks {Math.round(b.score)}/100
        </h3>
        <div className="mt-2 flex gap-4 rounded-lg bg-[var(--bg-secondary)] p-2.5 text-xs">
          <div>
            <div className="font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">{b.rawScore}</div>
            <div className="text-[10px] text-[var(--text-muted)]">on measured specs</div>
          </div>
          <div>
            <div className="font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
              {Math.round(b.confidence * 100)}%
            </div>
            <div className="text-[10px] text-[var(--text-muted)]">of criteria known</div>
          </div>
          <div>
            <div className="font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">{b.score}</div>
            <div className="text-[10px] text-[var(--text-muted)]">after shrinkage</div>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-muted)]">
          Unpublished specs are excluded from the average, never scored as zero. Where evidence is thin the score is
          pulled toward the typical bed, so missing data moves a bed toward average — not toward bad.
        </p>

        <ul className="mt-2 space-y-1">
          {b.reasons.map((r) => (
            <li key={r.label} className={`flex gap-2 text-xs ${TONE[r.tone]}`}>
              <span aria-hidden>{MARK[r.tone]}</span>
              <span>{r.label}</span>
            </li>
          ))}
        </ul>

        {b.gaps.length > 0 && (
          <p className="mt-2 text-[11px] leading-snug text-[var(--text-muted)]">
            <span className="font-medium">Not published by the retailer:</span> {b.gaps.join(", ")}.
          </p>
        )}

        <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Mechanism &amp; build
        </h3>
        <dl className="mt-1">
          <Row label="Lift direction" value={b.openingDirection} />
          <Row label="Mechanism" value={b.liftMechanism} />
          <Row label="Gas struts" value={b.gasStrutRating ?? (b.strutCount ? `${b.strutCount} struts` : null)} />
          <Row label="Frame" value={b.frameMaterial} />
          <Row label="Fixings" value={b.fixingType} />
          <Row label="Base" value={b.baseType} />
          <Row label="Slat gap" value={b.slatGapCm != null ? `${b.slatGapCm}cm` : null} />
          <Row label="Max mattress" value={b.maxMattressWeightKg != null ? `${b.maxMattressWeightKg}kg` : null} />
          <Row label="Min mattress" value={b.minMattressWeightKg != null ? `${b.minMattressWeightKg}kg` : null} />
        </dl>

        <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Storage &amp; footprint
        </h3>
        <dl className="mt-1">
          <Row label="Storage depth" value={b.storageDepthCm != null ? `${b.storageDepthCm}cm` : null} />
          <Row label="Ottoman type" value={b.ottomanType} />
          <Row
            label="Overall"
            value={
              b.overallWidthCm != null
                ? `${b.overallWidthCm} × ${b.overallLengthCm ?? "?"} × ${b.overallHeightCm ?? "?"} cm (W×L×H)`
                : null
            }
          />
          <Row label="Overhang" value={b.overhangCm != null ? `${b.overhangCm.toFixed(0)}cm wider than mattress` : null} />
          <Row label="Longest box" value={b.longestBoxCm != null ? `${b.longestBoxCm}cm` : null} />
        </dl>

        <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Look, service &amp; cover
        </h3>
        <dl className="mt-1">
          <Row label="Upholstery" value={b.upholsteryMaterial} />
          <Row label="Headboard" value={b.headboardStyle} />
          <Row label="Colourways" value={b.colourwaysAvailable} />
          <Row label="Warranty" value={b.warranty} />
          <Row label="Covers mechanism" value={b.warrantyCoversMechanism} />
          <Row label="Spare parts" value={b.sparePartsAvailable} />
          <Row label="Returns" value={b.returnsWindow} />
          <Row label="Lead time" value={b.deliveryLeadTime} />
          <Row
            label="Reviews"
            value={b.reviewScore != null ? `${b.reviewScore}${b.reviewCount ? ` (${b.reviewCount.toLocaleString()})` : ""}` : null}
          />
        </dl>

        {b.notes && (
          <>
            <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Research notes
            </h3>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]">{b.notes}</p>
          </>
        )}

        {Object.keys(b.extra).length > 0 && (
          <details className="mt-5">
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Everything else ({Object.keys(b.extra).length})
            </summary>
            <dl className="mt-1">
              {Object.entries(b.extra).map(([k, v]) => (
                <Row key={k} label={humanise(k)} value={v} />
              ))}
            </dl>
          </details>
        )}
      </aside>
    </div>
  );
}
