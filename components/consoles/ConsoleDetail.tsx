"use client";

import { useEffect } from "react";
import FitDiagram from "@/components/consoles/FitDiagram";
import { closedStorageLitres, type Verdict } from "@/lib/consoles/fit";
import type { ScoredConsole } from "@/lib/consoles/score";
import { TV_SCREEN_CLEARANCE_CM, SOUNDBAR_HEIGHT_CM } from "@/lib/consoles/types";
import { financeFor, financeLabel } from "@/lib/retail/finance";

// The card shows what decides the purchase. This drawer is where the rest of
// the research lives — including the long-tail columns kept in `extra`.

const TONE: Record<string, string> = {
  good: "text-[var(--status-yes)]",
  bad: "text-[var(--status-no)]",
  unknown: "text-[var(--text-muted)]",
};

const MARK: Record<string, string> = { good: "✓", bad: "✕", unknown: "?" };

const VERDICT_TONE: Record<Verdict, string> = { pass: "good", fail: "bad", unknown: "unknown" };
const VERDICT_WORD: Record<Verdict, string> = { pass: "Fits", fail: "Doesn't fit", unknown: "Not published" };

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
  return key
    .replace(/_/g, " ")
    .replace(/\bgbp\b/i, "£")
    .replace(/\bcm\b/i, "(cm)")
    .replace(/^./, (ch) => ch.toUpperCase());
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

export default function ConsoleDetail({ console: item, onClose }: { console: ScoredConsole | null; onClose: () => void }) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;
  const c = item;
  const fin = financeFor(c);
  const litres = closedStorageLitres(c.bays);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button onClick={onClose} aria-label="Close details" className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${c.brand} ${c.model} fit and full specification`}
        className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-[var(--border-primary)] bg-[var(--bg-primary)] p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{c.retailer}</div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{c.model}</h2>
            <div className="text-sm text-[var(--text-secondary)]">{c.brand}</div>
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
          href={c.productUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 rounded-lg bg-[var(--accent)] px-3 py-2 text-center text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          View at {c.retailer} ↗
        </a>

        <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Does your kit fit?
        </h3>
        <div className="mt-2 rounded-xl bg-[var(--bg-secondary)] p-3">
          <FitDiagram console={c} />
        </div>
        <div className="mt-2">
          <VerdictRow label="55&quot; LG B5 on its stand" verdict={c.fit.tv} />
          <VerdictRow label="S80TR soundbar in front" verdict={c.fit.soundbar} />
          <VerdictRow label="PS5 Slim housed" verdict={c.fit.ps5} />
          <div className="pl-3">
            <VerdictRow label="— lying flat in a bay" verdict={c.fit.ps5Bay} />
            <VerdictRow label="— upright beside the TV" verdict={c.fit.ps5Top} />
          </div>
        </div>
        {c.fit.notes.length > 0 && (
          <ul className="mt-2 space-y-1">
            {c.fit.notes.map((n) => (
              <li key={n} className="text-[11px] leading-snug text-[var(--text-secondary)]">
                · {n}
              </li>
            ))}
          </ul>
        )}
        {c.fit.overall === "unknown" && (
          <p className="mt-2 text-[11px] leading-snug text-[var(--text-muted)]">
            Unconfirmed means the retailer hasn&apos;t published the measurement — not that the unit is too small. Check
            the assembly manual or ask the retailer before ruling it out.
          </p>
        )}
        {/* A property of the TV and the soundbar, not of any console — so it is
            stated once, everywhere, rather than scored per unit. */}
        <p className="mt-2 rounded-lg bg-[var(--bg-tertiary)] p-2 text-[11px] leading-snug text-[var(--text-secondary)]">
          <span className="font-medium">Applies to every unit:</span> the gap under your TV&apos;s screen is about{" "}
          {TV_SCREEN_CLEARANCE_CM}cm and the S80TR is {SOUNDBAR_HEIGHT_CM}cm tall, so the bar will sit flush with the
          bottom bezel. That figure is derived from LG&apos;s published heights, not published directly — worth a tape
          measure before you buy.
        </p>

        <div className="mt-5 rounded-xl bg-[var(--bg-secondary)] p-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold [font-variant-numeric:tabular-nums]">
              £{Math.round(c.landedCostGbp).toLocaleString()}
            </span>
            <span className="text-xs text-[var(--text-muted)]">landed cost</span>
          </div>
          <dl className="mt-2">
            <Row label="Item price" value={`£${c.priceGbp.toLocaleString()}`} />
            <Row
              label="Delivery"
              value={c.deliveryIncluded ? "Included" : c.deliveryCostGbp != null ? `£${c.deliveryCostGbp}` : null}
            />
            <Row
              label="Assembly"
              value={c.assemblyIncluded ? "Included" : c.assemblyCostGbp != null ? `£${c.assemblyCostGbp}` : "Not offered"}
            />
          </dl>
        </div>

        {(c.finance.available || fin.blockedBy) && (
          <>
            <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Finance
            </h3>
            {fin.eligible ? (
              <div className="mt-1">
                <div
                  className={`text-sm font-semibold ${
                    fin.interestFree ? "text-[var(--status-yes)]" : "text-[var(--text-primary)]"
                  }`}
                >
                  {financeLabel(fin)}
                  {fin.monthly != null && ` · £${fin.monthly.toFixed(2)}/mo`}
                </div>
                <dl className="mt-1">
                  <Row label="Type" value={c.finance.type} />
                  <Row label="Provider" value={c.finance.provider} />
                  <Row label="Representative APR" value={c.finance.apr != null ? `${c.finance.apr}%` : null} />
                  <Row label="Interest-free term" value={c.finance.maxMonths ? `${c.finance.maxMonths} months` : null} />
                  <Row label="Minimum spend" value={c.finance.minSpend != null ? `£${c.finance.minSpend}` : null} />
                  <Row label="Deposit" value={c.finance.deposit} />
                  <Row label="Terms" value={c.finance.notes} />
                </dl>
                {c.finance.url && (
                  <a
                    href={c.finance.url}
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
          Why it ranks {Math.round(c.score)}/100
        </h3>
        <div className="mt-2 flex gap-4 rounded-lg bg-[var(--bg-secondary)] p-2.5 text-xs">
          <div>
            <div className="font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">{c.rawScore}</div>
            <div className="text-[10px] text-[var(--text-muted)]">on measured specs</div>
          </div>
          <div>
            <div className="font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
              {Math.round(c.confidence * 100)}%
            </div>
            <div className="text-[10px] text-[var(--text-muted)]">of criteria known</div>
          </div>
          <div>
            <div className="font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">{c.score}</div>
            <div className="text-[10px] text-[var(--text-muted)]">after shrinkage</div>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-muted)]">
          Unpublished specs are excluded from the average, never scored as zero. Where evidence is thin the score is
          pulled toward the typical unit, so missing data moves a console toward average — not toward bad.
        </p>

        <ul className="mt-2 space-y-1">
          {c.reasons.map((r) => (
            <li key={r.label} className={`flex gap-2 text-xs ${TONE[r.tone]}`}>
              <span aria-hidden>{MARK[r.tone]}</span>
              <span>{r.label}</span>
            </li>
          ))}
        </ul>

        {c.gaps.length > 0 && (
          <p className="mt-2 text-[11px] leading-snug text-[var(--text-muted)]">
            <span className="font-medium">Not published by the retailer:</span> {c.gaps.join(", ")}.
          </p>
        )}

        <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Dimensions
        </h3>
        <dl className="mt-1">
          <Row label="Top surface" value={c.topWidthCm != null ? `${c.topWidthCm} × ${c.topDepthCm ?? "?"} cm (W×D)` : null} />
          <Row label="Top load" value={c.topLoadKg != null ? `${c.topLoadKg}kg` : null} />
          <Row
            label="Overall"
            value={
              c.overallWidthCm != null
                ? `${c.overallWidthCm} × ${c.overallDepthCm ?? "?"} × ${c.overallHeightCm ?? "?"} cm (W×D×H)`
                : null
            }
          />
          <Row label="Closed storage" value={litres != null ? `~${litres} litres` : null} />
        </dl>

        {c.bays.length > 0 && (
          <>
            <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Compartments
            </h3>
            <dl className="mt-1">
              {c.bays.map((b, i) => (
                <Row
                  key={`${b.kind}-${i}`}
                  label={`${b.count}× ${b.kind}`}
                  value={
                    b.widthCm != null
                      ? `${b.widthCm} × ${b.depthCm ?? "?"} × ${b.heightCm ?? "?"} cm (W×D×H)`
                      : "dimensions not published"
                  }
                />
              ))}
            </dl>
          </>
        )}

        <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Build, look &amp; cover
        </h3>
        <dl className="mt-1">
          <Row label="Carcass" value={c.frameMaterial} />
          <Row label="Finish" value={c.finishMaterial} />
          <Row label="Legs" value={c.legStyle} />
          <Row label="Back panel" value={c.backPanel} />
          <Row label="Cable management" value={c.cableManagement} />
          <Row label="Colourways" value={c.colourwaysAvailable} />
          <Row label="Warranty" value={c.warranty} />
          <Row label="Spare parts" value={c.sparePartsAvailable} />
          <Row label="Returns" value={c.returnsWindow} />
          <Row label="Lead time" value={c.deliveryLeadTime} />
          <Row
            label="Reviews"
            value={c.reviewScore != null ? `${c.reviewScore}${c.reviewCount ? ` (${c.reviewCount.toLocaleString()})` : ""}` : null}
          />
        </dl>

        {c.notes && (
          <>
            <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Research notes
            </h3>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]">{c.notes}</p>
          </>
        )}

        {Object.keys(c.extra).length > 0 && (
          <details className="mt-5">
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Everything else ({Object.keys(c.extra).length})
            </summary>
            <dl className="mt-1">
              {Object.entries(c.extra).map(([k, v]) => (
                <Row key={k} label={humanise(k)} value={v} />
              ))}
            </dl>
          </details>
        )}
      </aside>
    </div>
  );
}
