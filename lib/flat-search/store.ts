// DB <-> plain-object mapping for the flat-search store. The Flat* Prisma models
// are the source of truth; the page, migrate script, and sync script all read/write
// through here. JSON-string columns (rosters, config) are parsed/serialised at this boundary.
import type { PrismaClient } from "@prisma/client";
import type { Area, FlatConfig, Listing, Pref, Source } from "./types";

const CONFIG_KEYS = {
  budget: "flat.budget",
  staleThresholds: "flat.staleThresholds",
  moveTiming: "flat.moveTiming",
  lastRun: "flat.lastRun",
} as const;

const DEFAULT_CONFIG: FlatConfig = {
  budget: { min: 1600, inMax: 1850, searchMax: 2000, btrMax: 2150 },
  staleThresholds: { slow: 45, stale: 90, problem: 150 },
  moveTiming: {
    rentPeriodAnchorDay: 14,
    noticePeriodsRequired: 2,
    overlapIdealDays: 7,
    overlapMaxDays: 14,
    noticeServedDate: null,
  },
  lastRun: null,
};

type PC = PrismaClient;
const parse = <T>(s: string | undefined, fallback: T): T => (s == null ? fallback : (JSON.parse(s) as T));

export async function loadConfig(prisma: PC): Promise<FlatConfig> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(CONFIG_KEYS) } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    budget: parse(map.get(CONFIG_KEYS.budget), DEFAULT_CONFIG.budget),
    staleThresholds: parse(map.get(CONFIG_KEYS.staleThresholds), DEFAULT_CONFIG.staleThresholds),
    moveTiming: parse(map.get(CONFIG_KEYS.moveTiming), DEFAULT_CONFIG.moveTiming),
    lastRun: map.has(CONFIG_KEYS.lastRun) ? (JSON.parse(map.get(CONFIG_KEYS.lastRun)!) as string | null) : null,
  };
}

export async function saveConfig(prisma: PC, config: FlatConfig): Promise<void> {
  const entries: [string, unknown][] = [
    [CONFIG_KEYS.budget, config.budget],
    [CONFIG_KEYS.staleThresholds, config.staleThresholds],
    [CONFIG_KEYS.moveTiming, config.moveTiming],
    [CONFIG_KEYS.lastRun, config.lastRun],
  ];
  for (const [key, value] of entries) {
    const v = JSON.stringify(value);
    await prisma.setting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
  }
}

export async function setLastRun(prisma: PC, date: string): Promise<void> {
  const value = JSON.stringify(date);
  await prisma.setting.upsert({
    where: { key: CONFIG_KEYS.lastRun },
    create: { key: CONFIG_KEYS.lastRun, value },
    update: { value },
  });
}

export async function loadAreas(prisma: PC): Promise<Area[]> {
  const rows = await prisma.flatArea.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    borough: a.borough,
    zone: a.zone,
    tier: a.tier,
    expectedBand: a.expectedBand,
    sortOrder: a.sortOrder,
    buildingRoster: parse<string[]>(a.buildingRoster, []),
    phaseYears: parse<Record<string, number>>(a.phaseYears, {}),
    btrOperators: parse<string[]>(a.btrOperators, []),
    operatorPortals: parse<string[]>(a.operatorPortals, []),
    searchUrls: parse<Area["searchUrls"]>(a.searchUrls, {}),
    flags: parse<string[]>(a.flags, []),
  }));
}

export async function upsertAreas(prisma: PC, areas: Area[]): Promise<void> {
  for (let i = 0; i < areas.length; i++) {
    const a = areas[i];
    const data = {
      name: a.name,
      borough: a.borough,
      zone: a.zone,
      tier: a.tier,
      expectedBand: a.expectedBand ?? null,
      sortOrder: a.sortOrder ?? i,
      buildingRoster: JSON.stringify(a.buildingRoster ?? []),
      phaseYears: JSON.stringify(a.phaseYears ?? {}),
      btrOperators: JSON.stringify(a.btrOperators ?? []),
      operatorPortals: JSON.stringify(a.operatorPortals ?? []),
      searchUrls: JSON.stringify(a.searchUrls ?? {}),
      flags: JSON.stringify(a.flags ?? []),
    };
    await prisma.flatArea.upsert({ where: { id: a.id }, create: { id: a.id, ...data }, update: data });
  }
}

export async function loadListings(prisma: PC): Promise<Listing[]> {
  const rows = await prisma.flatListing.findMany({ include: { sources: true, pref: true } });
  return rows.map((l): Listing => ({
    id: l.id,
    areaId: l.areaId,
    building: l.building,
    street: l.street,
    phaseYear: l.phaseYear,
    phaseLabel: l.phaseLabel,
    price: l.price,
    budgetTier: l.budgetTier as Listing["budgetTier"],
    furnishing: l.furnishing as Listing["furnishing"],
    available: l.available,
    availableNow: l.availableNow,
    availableDate: l.availableDate,
    listedDate: l.listedDate,
    epc: l.epc,
    sizeSqft: l.sizeSqft,
    scheme: l.scheme as Listing["scheme"],
    operator: l.operator,
    schemeConfidence: l.schemeConfidence,
    schemeSource: l.schemeSource,
    firstSeen: l.firstSeen,
    lastSeen: l.lastSeen,
    lastConfirmed: l.lastConfirmed,
    status: l.status as Listing["status"],
    goneReason: (l.goneReason as Listing["goneReason"]) ?? null,
    unconfirmed: l.unconfirmed,
    isNew: l.isNew,
    imageUrl: l.imageUrl,
    note: l.note,
    sources: l.sources.map((s): Source => ({ platform: s.platform, url: s.url, agent: s.agent })),
    pref: (l.pref?.pref as Pref | undefined) ?? null,
  }));
}

// Upsert one listing and replace its sources. Caller wraps a batch as needed.
export async function saveListing(prisma: PC, l: Listing): Promise<void> {
  const data = {
    areaId: l.areaId,
    building: l.building,
    street: l.street ?? null,
    phaseYear: l.phaseYear ?? null,
    phaseLabel: l.phaseLabel ?? null,
    price: l.price,
    budgetTier: l.budgetTier,
    furnishing: l.furnishing as Listing["furnishing"],
    available: l.available ?? null,
    availableNow: l.availableNow,
    availableDate: l.availableDate ?? null,
    listedDate: l.listedDate ?? null,
    epc: l.epc ?? null,
    sizeSqft: l.sizeSqft ?? null,
    scheme: l.scheme,
    operator: l.operator ?? null,
    schemeConfidence: l.schemeConfidence,
    schemeSource: l.schemeSource ?? null,
    firstSeen: l.firstSeen,
    lastSeen: l.lastSeen,
    lastConfirmed: l.lastConfirmed ?? null,
    status: l.status,
    goneReason: l.goneReason ?? null,
    unconfirmed: l.unconfirmed,
    isNew: l.isNew,
    imageUrl: l.imageUrl ?? null,
    note: l.note ?? null,
  };
  await prisma.flatListing.upsert({ where: { id: l.id }, create: { id: l.id, ...data }, update: data });
  await prisma.flatListingSource.deleteMany({ where: { listingId: l.id } });
  if (l.sources.length) {
    await prisma.flatListingSource.createMany({
      data: l.sources.map((s) => ({ listingId: l.id, platform: s.platform, url: s.url, agent: s.agent ?? null })),
    });
  }
}

export async function saveListings(prisma: PC, listings: Listing[]): Promise<void> {
  for (const l of listings) await saveListing(prisma, l);
}
