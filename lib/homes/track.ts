// How a new research pass updates what we already know about a listing.
//
//  - firstSeenAt is the earliest pass that saw it, and never moves later.
//  - lastSeenAt is the latest pass that saw it.
//  - priceHistory gets a point whenever a pass sees a different price from
//    the one before it, so reductions show up as a trail, not an overwrite.
//  - Fields come from whichever pass is newest. Re-importing an older pass
//    adds its price point but never overwrites newer facts.
import type { PricePoint } from "./types";

export interface Seen {
  priceGbp: number;
  firstSeenAt: string;
  lastSeenAt: string;
  priceHistory: PricePoint[];
}

export function normaliseHistory(points: PricePoint[]): PricePoint[] {
  const byDate = new Map<string, number>();
  for (const p of points) byDate.set(p.date, p.priceGbp);
  const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, priceGbp]) => ({ date, priceGbp }));
  // Drop points that repeat the price before them — only changes matter.
  return sorted.filter((p, i) => i === 0 || p.priceGbp !== sorted[i - 1].priceGbp);
}

export function mergeSeen(existing: Seen | null, seenOn: string, priceGbp: number): Seen & { newer: boolean } {
  if (!existing) {
    return { priceGbp, firstSeenAt: seenOn, lastSeenAt: seenOn, priceHistory: [{ date: seenOn, priceGbp }], newer: true };
  }
  const newer = seenOn >= existing.lastSeenAt;
  return {
    priceGbp: newer ? priceGbp : existing.priceGbp,
    firstSeenAt: seenOn < existing.firstSeenAt ? seenOn : existing.firstSeenAt,
    lastSeenAt: newer ? seenOn : existing.lastSeenAt,
    priceHistory: normaliseHistory([...existing.priceHistory, { date: seenOn, priceGbp }]),
    newer,
  };
}

/** Change since first seen, negative for a reduction. Null with one price. */
export function priceChange(history: PricePoint[]): { amount: number; pct: number } | null {
  if (history.length < 2) return null;
  const first = history[0].priceGbp;
  const last = history[history.length - 1].priceGbp;
  return { amount: last - first, pct: ((last - first) / first) * 100 };
}
