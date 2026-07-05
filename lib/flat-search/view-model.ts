// Builds the derived view for the /flats page from the raw store. Timing + staleness are
// computed here (live, from nowMs) so they never live in the DB. Pure + testable.
import {
  daysOnMarket,
  moveOutFloorMs,
  noticeDeadlineMs,
  staleTier,
  timingFit,
  timingRank,
  timingRefMs,
  tierRank,
} from "./view-logic";
import type { Area, FlatConfig, Listing, StaleTier, TimingFit } from "./types";

export interface EnrichedListing extends Listing {
  timingFit: TimingFit;
  staleTier: StaleTier;
  daysOnMarket: number | null;
}

export interface FlatStore {
  areas: Area[];
  listings: Listing[];
  config: FlatConfig;
}

export interface TierPick {
  tier: string; // "anchor" | "1" | "2"
  label: string;
  newest: EnrichedListing | null; // newest in-budget/btr pick
  wellTimed: EnrichedListing | null; // best ideal/workable in-budget pick
}

export interface FlatView {
  config: FlatConfig;
  areas: Area[];
  areaById: Record<string, Area>;
  listings: EnrichedListing[];
  floorMs: number;
  deadlineMs: number | null;
  moveOutFloor: string; // ISO
  noticeDeadline: string | null; // ISO
  noticeDaysLeft: number | null;
  counts: { active: number; gone: number; isNew: number; unconfirmed: number };
  picks: TierPick[];
}

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const TIER_LABEL: Record<string, string> = { anchor: "Anchor", "1": "Tier 1", "2": "Tier 2" };

export function enrich(store: FlatStore, nowMs: number): EnrichedListing[] {
  const { config } = store;
  const floorMs = moveOutFloorMs(timingRefMs(nowMs, config.moveTiming), config.moveTiming);
  return store.listings.map((l) => ({
    ...l,
    timingFit: timingFit(l, floorMs, config.moveTiming, nowMs),
    staleTier: staleTier(l, config.staleThresholds, nowMs),
    daysOnMarket: daysOnMarket(l.listedDate, nowMs),
  }));
}

export function buildView(store: FlatStore, nowMs: number): FlatView {
  const { config, areas } = store;
  const areaById = Object.fromEntries(areas.map((a) => [a.id, a])) as Record<string, Area>;
  const floorMs = moveOutFloorMs(timingRefMs(nowMs, config.moveTiming), config.moveTiming);
  const deadlineMs = noticeDeadlineMs(nowMs, config.moveTiming);
  const listings = enrich(store, nowMs);

  const active = listings.filter((l) => l.status === "active");
  const counts = {
    active: active.length,
    gone: listings.filter((l) => l.status === "gone").length,
    isNew: listings.filter((l) => l.isNew).length,
    unconfirmed: listings.filter((l) => l.unconfirmed && l.status === "active").length,
  };

  const tierOf = (l: Listing) => {
    const t = areaById[l.areaId]?.tier ?? "2";
    return t === "anchor" ? "anchor" : t;
  };
  const inBudget = (l: EnrichedListing) => l.budgetTier === "in" || l.budgetTier === "btr";

  const picks: TierPick[] = ["anchor", "1", "2"].map((tier) => {
    const pool = active.filter((l) => tierOf(l) === tier && inBudget(l));
    const newest =
      [...pool].sort(
        (a, b) =>
          (b.scheme === "btr" ? 0 : 1) - (a.scheme === "btr" ? 0 : 1) ||
          (b.phaseYear ?? 0) - (a.phaseYear ?? 0) ||
          a.price - b.price,
      )[0] ?? null;
    const wellTimed =
      pool
        .filter((l) => l.timingFit === "ideal" || l.timingFit === "workable")
        .sort((a, b) => timingRank(a.timingFit) - timingRank(b.timingFit) || a.price - b.price)[0] ?? null;
    return { tier, label: TIER_LABEL[tier] ?? tier, newest, wellTimed };
  });

  return {
    config,
    areas: [...areas].sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.sortOrder - b.sortOrder),
    areaById,
    listings,
    floorMs,
    deadlineMs,
    moveOutFloor: iso(floorMs),
    noticeDeadline: deadlineMs == null ? null : iso(deadlineMs),
    noticeDaysLeft: deadlineMs == null ? null : Math.round((deadlineMs - nowMs) / 86400000),
    counts,
    picks,
  };
}
