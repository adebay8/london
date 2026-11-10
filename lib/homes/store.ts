// DB <-> plain-object boundary for the buying search. JSON-string columns are
// parsed and serialised here; nothing derived is ever persisted.
import type { PrismaClient } from "@prisma/client";
import { mergeSeen, type Seen } from "./track";
import type { BuyTown, HomeListing, Lead, ListedEvent, ListingStatus, Pref, PricePoint, Tenure } from "./types";

type PC = PrismaClient;

function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return (JSON.parse(s) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const asDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

export async function loadTowns(prisma: PC): Promise<BuyTown[]> {
  const rows = await prisma.buyTown.findMany({ orderBy: { town: "asc" } });
  return rows.map((t) => ({
    id: t.id,
    town: t.town,
    station: t.station,
    searched: t.searched,
    gap: t.gap,
    policy: t.policy,
    nextAction: t.nextAction,
    leads: parseJson<Lead[]>(t.leads, []),
    lastSearchedAt: day(t.lastSearchedAt),
  }));
}

export async function loadListings(prisma: PC): Promise<HomeListing[]> {
  const rows = await prisma.homeListing.findMany({ include: { pref: true }, orderBy: { priceGbp: "asc" } });
  return rows.map((l) => ({
    id: l.id,
    townId: l.townId,
    source: l.source,
    listingUrl: l.listingUrl,
    agent: l.agent,
    priceGbp: l.priceGbp,
    priceQualifier: l.priceQualifier,
    address: l.address,
    propertyType: l.propertyType,
    newBuild: l.newBuild,
    tenure: l.tenure as Tenure | null,
    leaseYears: l.leaseYears,
    serviceChargePa: l.serviceChargePa,
    groundRentPa: l.groundRentPa,
    beds: l.beds,
    baths: l.baths,
    floorAreaSqFt: l.floorAreaSqFt,
    councilTax: l.councilTax,
    epc: l.epc,
    listedEvent: l.listedEvent as ListedEvent | null,
    listedOn: day(l.listedOn),
    distanceMiles: l.distanceMiles,
    distanceNote: l.distanceNote,
    keyFeatures: parseJson<string[]>(l.keyFeatures, []),
    photos: parseJson<string[]>(l.photos, []),
    status: l.status as ListingStatus,
    firstSeenAt: day(l.firstSeenAt)!,
    lastSeenAt: day(l.lastSeenAt)!,
    priceHistory: parseJson<PricePoint[]>(l.priceHistory, []),
    raw: parseJson<Record<string, string>>(l.raw, {}),
    pref: (l.pref?.pref as Pref | undefined) ?? null,
  }));
}

export async function saveTown(prisma: PC, t: Omit<BuyTown, "lastSearchedAt"> & { lastSearchedAt?: string | null }) {
  const data = {
    town: t.town,
    station: t.station,
    searched: t.searched,
    gap: t.gap,
    policy: t.policy,
    nextAction: t.nextAction,
    leads: JSON.stringify(t.leads ?? []),
    ...(t.lastSearchedAt ? { lastSearchedAt: asDate(t.lastSearchedAt) } : {}),
  };
  await prisma.buyTown.upsert({ where: { id: t.id }, create: { id: t.id, ...data }, update: data });
}

export type IncomingListing = Omit<HomeListing, "pref" | "priceHistory" | "firstSeenAt">;

/** Merge one pass's view of a listing into the store. Returns what changed. */
export async function trackListing(prisma: PC, l: IncomingListing): Promise<"new" | "price-change" | "seen" | "older"> {
  const existing = await prisma.homeListing.findUnique({
    where: { id: l.id },
    select: { priceGbp: true, firstSeenAt: true, lastSeenAt: true, priceHistory: true },
  });
  const prior: Seen | null = existing
    ? {
        priceGbp: existing.priceGbp,
        firstSeenAt: day(existing.firstSeenAt)!,
        lastSeenAt: day(existing.lastSeenAt)!,
        priceHistory: parseJson<PricePoint[]>(existing.priceHistory, []),
      }
    : null;
  const merged = mergeSeen(prior, l.lastSeenAt, l.priceGbp);

  const tracking = {
    priceGbp: merged.priceGbp,
    firstSeenAt: asDate(merged.firstSeenAt)!,
    lastSeenAt: asDate(merged.lastSeenAt)!,
    priceHistory: JSON.stringify(merged.priceHistory),
  };
  const facts = {
    townId: l.townId,
    source: l.source,
    listingUrl: l.listingUrl,
    agent: l.agent,
    priceQualifier: l.priceQualifier,
    address: l.address,
    propertyType: l.propertyType,
    newBuild: l.newBuild,
    tenure: l.tenure,
    leaseYears: l.leaseYears,
    serviceChargePa: l.serviceChargePa,
    groundRentPa: l.groundRentPa,
    beds: l.beds,
    baths: l.baths,
    floorAreaSqFt: l.floorAreaSqFt,
    councilTax: l.councilTax,
    epc: l.epc,
    listedEvent: l.listedEvent,
    listedOn: asDate(l.listedOn),
    distanceMiles: l.distanceMiles,
    distanceNote: l.distanceNote,
    keyFeatures: JSON.stringify(l.keyFeatures),
    photos: JSON.stringify(l.photos),
    status: l.status,
    raw: JSON.stringify(l.raw),
  };

  if (!existing) {
    await prisma.homeListing.create({ data: { id: l.id, ...facts, ...tracking } });
    return "new";
  }
  // An older pass contributes its price point only; newer facts stand.
  await prisma.homeListing.update({ where: { id: l.id }, data: merged.newer ? { ...facts, ...tracking } : tracking });
  if (!merged.newer) return "older";
  return existing.priceGbp !== merged.priceGbp ? "price-change" : "seen";
}

export async function setListingPref(prisma: PC, listingId: string, pref: Pref | null): Promise<void> {
  if (pref == null) {
    await prisma.homeListingPref.deleteMany({ where: { listingId } });
    return;
  }
  await prisma.homeListingPref.upsert({ where: { listingId }, create: { listingId, pref }, update: { pref } });
}
