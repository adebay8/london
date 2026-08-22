// Finance eligibility and ranking.
//
// Kept entirely out of lib/beds/score.ts on purpose: finance changes how you
// PAY for a bed, not how good the bed is. Folding it into the recommendation
// would let a mediocre bed outrank a better one purely because its retailer
// has a credit agreement. It is a filter and a separate sort instead.
//
// The one genuinely per-bed part is eligibility: most 0% deals carry a minimum
// order value, so a cheap frame can fail to qualify for its own retailer's
// offer.
import type { Bed, FinanceType } from "./types";

export interface FinanceOffer {
  /** Retailer offers something AND this bed's landed cost clears the minimum. */
  eligible: boolean;
  /** True interest-free fixed-term credit (not BNPL, not a deferred-interest card). */
  interestFree: boolean;
  /** Longest interest-free term this bed qualifies for. 0 for BNPL/none. */
  months: number;
  apr: number | null;
  type: FinanceType | null;
  /** Rough monthly cost if spread over the interest-free term. */
  monthly: number | null;
  /** Why it does not qualify, when it doesn't. */
  blockedBy: string | null;
}

export function financeFor(b: Bed): FinanceOffer {
  const p = b.finance;
  const none: FinanceOffer = {
    eligible: false,
    interestFree: false,
    months: 0,
    apr: p?.apr ?? null,
    type: p?.type ?? null,
    monthly: null,
    blockedBy: null,
  };

  if (!p || !p.available || p.type === "none") {
    return { ...none, blockedBy: "Retailer offers no finance" };
  }

  // Tiered ladders take precedence: pick the best rung this bed's spend reaches.
  // Minimum spend is assessed on LANDED cost, since delivery and assembly
  // normally go on the same order.
  const tiers = (p.tiers ?? []).filter((t) => b.landedCostGbp >= t.minSpend);
  if (p.tiers?.length) {
    if (!tiers.length) {
      const cheapest = Math.min(...p.tiers.map((t) => t.minSpend));
      return { ...none, blockedBy: `Needs a £${cheapest} minimum spend` };
    }
    // Longest term wins; break ties on the lower APR.
    const best = [...tiers].sort((x, y) => y.months - x.months || x.apr - y.apr)[0];
    return {
      eligible: true,
      interestFree: best.apr === 0 && best.months > 0,
      months: best.months,
      apr: best.apr,
      type: p.type ?? null,
      monthly: best.months > 0 ? Math.round((b.landedCostGbp / best.months) * 100) / 100 : null,
      blockedBy: null,
    };
  }

  if (p.minSpend != null && b.landedCostGbp < p.minSpend) {
    return { ...none, blockedBy: `Needs a £${p.minSpend} minimum spend` };
  }

  const months = p.maxMonths ?? 0;
  const interestFree = (p.apr ?? 99) === 0 && months > 0;

  return {
    eligible: true,
    interestFree,
    months,
    apr: p.apr ?? null,
    type: p.type ?? null,
    monthly: months > 0 ? Math.round((b.landedCostGbp / months) * 100) / 100 : null,
    blockedBy: null,
  };
}

/** Better finance sorts first: interest-free before interest-bearing, then the
 *  longest term, then the lowest APR — "the lower the interest and the longer
 *  the period, the better". */
export function compareFinance(a: Bed, b: Bed): number {
  const fa = financeFor(a);
  const fb = financeFor(b);
  if (fa.eligible !== fb.eligible) return fa.eligible ? -1 : 1;
  if (fa.interestFree !== fb.interestFree) return fa.interestFree ? -1 : 1;
  // A committed point-of-sale agreement beats a store card's promotional plan
  // even when the card advertises a longer term, because the card's term is
  // subject to the issuer's assessment.
  const cardA = fa.type === "store card";
  const cardB = fb.type === "store card";
  if (cardA !== cardB) return cardA ? 1 : -1;
  if (fb.months !== fa.months) return fb.months - fa.months;
  return (fa.apr ?? 999) - (fb.apr ?? 999);
}

export function financeLabel(f: FinanceOffer): string | null {
  if (!f.eligible) return null;
  if (f.interestFree) {
    // A store card's promotional 0% plan depends on the issuer's assessment of
    // you and your basket, unlike a fixed point-of-sale agreement. Say so
    // rather than printing a term the buyer may never be offered.
    return f.type === "store card" ? `0% up to ${f.months}m — if approved` : `0% for ${f.months} months`;
  }
  if (f.type === "BNPL") return "Pay in 3 (BNPL)";
  if (f.apr != null) return `${f.apr}% APR`;
  return "Finance available";
}
