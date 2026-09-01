"use client";

import { useEffect } from "react";
import { compatFor, type BedConstraint } from "@/lib/mattresses/compat";
import { dealFor } from "@/lib/mattresses/deal";
import { depthOf, hasSuspectDepth, type Verdict } from "@/lib/mattresses/fit";
import type { ScoredMattress } from "@/lib/mattresses/score";
import { FIRMNESS_ORDER, TARGET_FIRMNESS, type Firmness } from "@/lib/mattresses/types";

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

/** The firmness scale, with your band marked. Drawn rather than tabulated
 *  because the whole question is "is it in the band or one step out", which a
 *  row of text answers badly. The retailer's own wording sits underneath,
 *  because their scale and ours are not the same scale. */
function FirmnessScale({ value, label, source }: { value: Firmness | null; label: string | null; source: string | null }) {
  return (
    <div>
      <div className="flex gap-1">
        {FIRMNESS_ORDER.map((f) => {
          const isThis = f === value;
          const inBand = TARGET_FIRMNESS.includes(f);
          return (
            <div key={f} className="flex-1">
              <div
                className={`h-2 rounded-full ${
                  isThis
                    ? inBand ? "bg-[var(--status-yes)]" : "bg-[var(--status-no)]"
                    : inBand ? "bg-[var(--bg-tertiary)] ring-1 ring-inset ring-[var(--status-yes)]" : "bg-[var(--bg-tertiary)]"
                }`}
              />
              <div className={`mt-1 text-center text-[9px] leading-tight ${isThis ? "font-bold text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                {f.replace("-", "‑")}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-[var(--text-muted)]">
        The outlined pair is the band that serves both side and back nights.
        {label ? (
          <>
            {" "}
            The retailer calls this one <span className="font-medium text-[var(--text-secondary)]">“{label}”</span>
            {source === "scale" && " — read off their own 1–10 scale"}
            {source === "label" && " — mapped from their wording"}.
          </>
        ) : (
          " This retailer publishes no firmness at all, so it is left unplaced rather than guessed."
        )}
      </p>
    </div>
  );
}

export default function MattressDetail({
  mattress, beds, onClose,
}: { mattress: ScoredMattress | null; beds: BedConstraint[]; onClose: () => void }) {
  useEffect(() => {
    if (!mattress) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mattress, onClose]);

  if (!mattress) return null;
  const m = mattress;
  const deal = dealFor(m);
  const compat = compatFor(m, beds);
  const depth = depthOf(m);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button onClick={onClose} aria-label="Close details" className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${m.brand} ${m.model} full specification`}
        className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-[var(--border-primary)] bg-[var(--bg-primary)] p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{m.retailer}</div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{m.model}</h2>
            <div className="text-sm text-[var(--text-secondary)]">{m.brand}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
            ✕
          </button>
        </div>

        {m.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.imageUrl} alt="" className="mt-3 aspect-[4/3] w-full rounded-xl object-cover" />
        )}

        <a
          href={m.productUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 rounded-lg bg-[var(--accent)] px-3 py-2 text-center text-sm font-semibold text-white hover:opacity-90"
        >
          View at {m.retailer} ↗
        </a>

        <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Firmness</h3>
        <div className="mt-2 rounded-xl bg-[var(--bg-secondary)] p-3">
          <FirmnessScale value={m.fit.firmnessRead.value} label={m.firmnessLabel} source={m.fit.firmnessRead.source} />
        </div>

        <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          The price, and what the “was” is worth
        </h3>
        <div className="mt-2 rounded-xl bg-[var(--bg-secondary)] p-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold [font-variant-numeric:tabular-nums]">
              £{Math.round(m.landedCostGbp).toLocaleString()}
            </span>
            <span className="text-xs text-[var(--text-muted)]">landed</span>
          </div>
          <p className={`mt-1 text-xs font-medium ${deal.credible ? "text-[var(--status-yes)]" : "text-[var(--text-secondary)]"}`}>
            {deal.headline}
          </p>
          {deal.caution && (
            <p className="mt-2 rounded bg-[var(--bg-tertiary)] p-2 text-[11px] leading-snug text-[var(--text-secondary)]">
              {deal.caution}
            </p>
          )}
          {deal.floorGbp != null && deal.floorGbp < m.priceGbp && (
            <p className="mt-2 text-[11px] leading-snug text-[var(--text-muted)]">
              Seen as low as £{Math.round(deal.floorGbp).toLocaleString()} on a previous check — today is not its best price.
            </p>
          )}
          <dl className="mt-2">
            <Row label="Item price" value={`£${m.priceGbp.toLocaleString()}`} />
            <Row label="Claimed was" value={m.rrpGbp ? `£${m.rrpGbp.toLocaleString()}` : null} />
            <Row label="Delivery" value={m.deliveryIncluded ? "Included" : m.deliveryCostGbp != null ? `£${m.deliveryCostGbp}` : null} />
            <Row label="Old mattress taken" value={m.disposalCostGbp != null ? `£${m.disposalCostGbp}` : null} />
            <Row label="Condition" value={m.condition} />
          </dl>
          <p className="mt-2 text-[11px] leading-snug text-[var(--text-muted)]">
            The discount is shown but never scored. Ranking on percentage-off would put whichever retailer inflates its
            own RRP hardest at the top of the page.
          </p>
        </div>

        <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Meets the brief?</h3>
        <div className="mt-1">
          <VerdictRow label="A 135 × 190 double" verdict={m.fit.size} />
          <VerdictRow label="Firmness suits how you sleep" verdict={m.fit.firmness} />
          <VerdictRow label="Rated for a slatted / ottoman base" verdict={m.fit.base} />
        </div>
        {m.fit.notes.length > 0 && (
          <ul className="mt-2 space-y-1">
            {m.fit.notes.map((n) => (
              <li key={n} className="text-[11px] leading-snug text-[var(--text-secondary)]">· {n}</li>
            ))}
          </ul>
        )}

        {compat.total > 0 && (
          <>
            <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              In your shortlisted beds
            </h3>
            <div className="mt-1">
              {compat.beds.map((c) => (
                <div key={c.bed.id} className="border-b border-[var(--border-secondary)] py-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[var(--text-secondary)]">
                      {c.bed.model}
                      <span className="text-[var(--text-muted)]"> · {c.bed.retailer}</span>
                    </span>
                    <span
                      className={`shrink-0 font-medium ${
                        c.verdict === "fits" ? TONE.good : c.verdict === "unknown" ? TONE.unknown : TONE.bad
                      }`}
                    >
                      {c.verdict === "fits" ? "✓ works" : c.verdict === "unknown" ? "? can't tell" : `✕ ${c.verdict.replace("-", " ")}`}
                    </span>
                  </div>
                  {c.reason && <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">{c.reason}</p>}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-[var(--text-muted)]">
              Two things can go wrong: the mattress is heavier than the ottoman&apos;s gas struts are rated to lift, or
              it is all foam sitting on a solid base with no slats, which traps moisture underneath. This check never
              affects the score — most listings do not publish a weight, and ranking on that would just reward chatty
              spec sheets.
            </p>
          </>
        )}

        <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Why it ranks {Math.round(m.score)}/100
        </h3>
        <div className="mt-2 flex gap-4 rounded-lg bg-[var(--bg-secondary)] p-2.5 text-xs">
          <div>
            <div className="font-bold [font-variant-numeric:tabular-nums]">{m.rawScore}</div>
            <div className="text-[10px] text-[var(--text-muted)]">on measured specs</div>
          </div>
          <div>
            <div className="font-bold [font-variant-numeric:tabular-nums]">{Math.round(m.confidence * 100)}%</div>
            <div className="text-[10px] text-[var(--text-muted)]">of criteria known</div>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-muted)]">
          Unpublished specs are excluded from the average, never scored as zero. Firmness carries the most weight;
          spring count carries the least, and stops counting past 2,000 — in a 135cm-wide double, more springs means
          thinner ones.
        </p>

        <ul className="mt-2 space-y-1">
          {m.reasons.map((r) => (
            <li key={r.label} className={`flex gap-2 text-xs ${TONE[r.tone]}`}>
              <span aria-hidden>{MARK[r.tone]}</span>
              <span>{r.label}</span>
            </li>
          ))}
        </ul>
        {m.gaps.length > 0 && (
          <p className="mt-2 text-[11px] leading-snug text-[var(--text-muted)]">
            <span className="font-medium">Not published:</span> {m.gaps.join(", ")}.
          </p>
        )}

        <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Specification</h3>
        <dl className="mt-1">
          <Row label="Size" value={m.widthCm != null ? `${m.widthCm} × ${m.lengthCm ?? "?"} cm` : m.size} />
          <Row label="Depth" value={depth != null ? `${depth}cm` : null} />
          <Row label="Type" value={m.type} />
          <Row label="Springs" value={m.springCount != null ? `${m.springCount.toLocaleString()} ${m.springType ?? ""}`.trim() : m.springType} />
          <Row label="Zoned" value={m.zoned == null ? null : m.zoned ? "Yes" : "No"} />
          <Row label="Needs turning" value={m.turnRequired == null ? null : m.turnRequired ? "Yes" : "No — rotate only"} />
          <Row label="Comfort layer" value={m.comfortLayer} />
          <Row label="Weight" value={m.weightKg != null ? `${m.weightKg}kg` : null} />
          <Row label="Slatted base" value={m.slattedBaseOk == null ? null : m.slattedBaseOk ? "Suitable" : "Not suitable"} />
          <Row label="Solid platform" value={m.platformBaseOk == null ? null : m.platformBaseOk ? "Suitable" : "Not suitable"} />
          <Row label="Ottoman" value={m.ottomanOk == null ? null : m.ottomanOk ? "Suitable" : "Not suitable"} />
          <Row label="Cover" value={[m.coverRemovable ? "removable" : null, m.coverWashable ? "washable" : null].filter(Boolean).join(", ") || null} />
          <Row label="Sleep trial" value={m.trialNights != null ? `${m.trialNights} nights${m.trialFreeReturns === false ? " (returns chargeable)" : m.trialFreeReturns ? " (free returns)" : ""}` : null} />
          <Row label="Warranty" value={m.warrantyYears != null ? `${m.warrantyYears} years` : null} />
          <Row label="Returns" value={m.returnsWindow} />
          <Row label="Lead time" value={m.deliveryLeadTime} />
          <Row label="Reviews" value={m.reviewScore != null ? `${m.reviewScore}${m.reviewCount ? ` (${m.reviewCount.toLocaleString()})` : ""}` : null} />
          <Row label="Independent test" value={m.testedBy && m.testScore != null ? `${m.testedBy}: ${m.testScore}%` : null} />
        </dl>
        {hasSuspectDepth(m) && (
          <p className="mt-2 rounded bg-[var(--bg-tertiary)] p-2 text-[11px] leading-snug text-[var(--text-secondary)]">
            The listing says {m.depthCm}cm, which is the shipping carton rather than the mattress — bed-in-a-box
            listings mix the two constantly. Treated as unpublished rather than as an unusually deep mattress.
          </p>
        )}

        {m.notes && (
          <>
            <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Research notes</h3>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]">{m.notes}</p>
          </>
        )}
      </aside>
    </div>
  );
}
