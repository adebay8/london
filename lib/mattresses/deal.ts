// What the "was" price is worth, and what to print instead of a discount badge.
//
// THE RULE: discount is recorded and displayed. It is never scored. Nothing in
// score.ts imports this file, and it must stay that way.
//
// Why. Mattresses are the worst category in UK retail for anchor pricing. A
// "was £1,299, now £549" is very often not a drop at all — £549 is the only
// price the mattress has ever had, and the £1,299 exists so the £549 looks
// like a rescue. Rank on percentage-off and you rank retailers by how
// aggressively they inflate their own RRP, putting the least honest listing
// on top. That is the opposite of finding a good deal.
//
// So this module does the one useful thing instead: it says how much the claim
// can be believed, and it says it in words rather than in a red percentage.
import type { Condition, Mattress, RrpEvidence } from "./types";

/** A discount this deep on current-line NEW stock is not a sale, it is an
 *  anchor. Genuine clearance goes deeper — hence the condition check. */
export const IMPLAUSIBLE_DISCOUNT_PCT = 55;

/** Below this a "was" price is rounding, not an offer worth mentioning. */
const MEANINGFUL_DISCOUNT_PCT = 8;

export interface Deal {
  /** Off the claimed RRP. Reported because it is a fact about the listing —
   *  not because it is a fact about the mattress's value. */
  claimedDiscountPct: number | null;
  claimedSavingGbp: number | null;
  evidence: RrpEvidence | null;
  /** Whether the saving is believable enough to act on. */
  credible: boolean;
  /** The saving we would actually stand behind. Null unless the higher price
   *  was seen with our own eyes. */
  realSavingGbp: number | null;
  /** What the card prints where a discount badge would otherwise go. */
  headline: string;
  /** The sentence under it, when there is something to warn about. */
  caution: string | null;
  /** Cheapest this has been seen, when we have seen it more than once. */
  floorGbp: number | null;
  /** True when today's price is the lowest we have observed. */
  atFloor: boolean;
}

const pounds = (n: number) => `£${Math.round(n).toLocaleString()}`;

/** Downgrade an implausible claim on full-price stock. A 70%-off "sale" on
 *  current-line stock is an anchor, whatever the listing says, and calling it
 *  a single observation would be too generous. */
function assess(claimedPct: number | null, stated: RrpEvidence | null, condition: Condition): RrpEvidence | null {
  if (stated === "verified-higher" || stated === "permanent-sale") return stated;
  if (claimedPct != null && claimedPct >= IMPLAUSIBLE_DISCOUNT_PCT && condition === "new") return "permanent-sale";
  return stated ?? (claimedPct != null ? "single-observation" : null);
}

export function dealFor(m: Pick<Mattress,
  "priceGbp" | "landedCostGbp" | "rrpGbp" | "rrpEvidence" | "priceFloorGbp" | "condition">): Deal {
  const price = m.priceGbp;
  const rrp = m.rrpGbp;
  const floor = m.priceFloorGbp;
  const atFloor = floor != null && price <= floor;

  const hasClaim = rrp != null && rrp > price;
  const claimedSavingGbp = hasClaim ? Math.round(rrp - price) : null;
  const rawPct = hasClaim ? Math.round((1 - price / rrp) * 100) : null;
  const claimedDiscountPct = rawPct != null && rawPct >= MEANINGFUL_DISCOUNT_PCT ? rawPct : null;

  const evidence = assess(claimedDiscountPct, m.rrpEvidence, m.condition);

  // No claim at all — the honest majority.
  if (!hasClaim || claimedDiscountPct == null) {
    return {
      claimedDiscountPct: null,
      claimedSavingGbp: null,
      evidence: m.rrpEvidence,
      credible: false,
      realSavingGbp: null,
      floorGbp: floor,
      atFloor,
      headline: `${pounds(m.landedCostGbp)} landed`,
      caution: null,
    };
  }

  if (evidence === "verified-higher") {
    return {
      claimedDiscountPct,
      claimedSavingGbp,
      evidence,
      credible: true,
      realSavingGbp: claimedSavingGbp,
      floorGbp: floor,
      atFloor,
      headline: `${pounds(price)} — genuinely down from ${pounds(rrp)}`,
      caution: null,
    };
  }

  if (evidence === "permanent-sale") {
    return {
      claimedDiscountPct,
      claimedSavingGbp,
      evidence,
      credible: false,
      realSavingGbp: null,
      floorGbp: floor,
      atFloor,
      headline: `${pounds(price)} — its usual price, not a sale`,
      caution: `The listing claims ${claimedDiscountPct}% off ${pounds(rrp)}, but ${pounds(price)} is what it always costs. Treat ${pounds(price)} as the price and ignore the saving.`,
    };
  }

  return {
    claimedDiscountPct,
    claimedSavingGbp,
    evidence: "single-observation",
    credible: false,
    realSavingGbp: null,
    floorGbp: floor,
    atFloor,
    headline: `${pounds(price)} — "was ${pounds(rrp)}" unverified`,
    caution: `Seen at this price once. Until it has been checked again there is no way to tell a real ${claimedDiscountPct}% drop from a permanent sale ticket.`,
  };
}

/** Sort key for "best deal first". Verified savings rank above unverified
 *  ones at any headline percentage — which is the whole point. */
export function compareDeal(a: Deal, b: Deal): number {
  if (a.credible !== b.credible) return a.credible ? -1 : 1;
  return (b.realSavingGbp ?? b.claimedSavingGbp ?? 0) - (a.realSavingGbp ?? a.claimedSavingGbp ?? 0);
}
