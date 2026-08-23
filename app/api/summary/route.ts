import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadBeds } from "@/lib/beds/store";
import { scoreAll as scoreBeds } from "@/lib/beds/score";
import { loadConsoles } from "@/lib/consoles/store";
import { scoreAll as scoreConsoles } from "@/lib/consoles/score";
import { loadConfig } from "@/lib/flat-search/store";

// GET /api/summary — everything the home page merchandises.
//
// Deliberately NOT several client-side fetches of the existing endpoints:
// /api/flats alone ships every listing with its sources. Counting and ranking
// happen here and only what is displayed crosses the wire.
//
// The two furniture searches are loaded in full because their ranking is
// defined as a live computation over the whole corpus (see the shrinkage note
// in lib/beds/score.ts) — a front runner cannot come from a database count.

export const dynamic = "force-dynamic";

export interface Product {
  id: string;
  dept: "bed" | "console" | "flat";
  label: string;
  eyebrow: string | null;
  price: number;
  priceSuffix: string | null;
  image: string | null;
  url: string;
  href: string;
  score: number | null;
  badge: string | null;
  saved: boolean;
}

const FIT_RANK: Record<string, number> = { pass: 0, unknown: 1, fail: 2 };

export async function GET() {
  const [
    flatsActive, flatsNew, flatsGone, savedFlatIds, areas,
    neighbourhoods, ranked, apartments,
    journalTotal, journalRecent, config, beds, consoles,
  ] = await Promise.all([
    prisma.flatListing.count({ where: { status: "active" } }),
    prisma.flatListing.count({ where: { status: "active", isNew: true } }),
    prisma.flatListing.count({ where: { status: "gone" } }),
    prisma.flatPref.findMany({ where: { pref: "want" }, select: { listingId: true } }),
    prisma.flatArea.count(),
    prisma.neighbourhood.findMany({ select: { status: true } }),
    prisma.ranking.count(),
    prisma.apartmentBuilding.count(),
    prisma.journalEntry.count(),
    prisma.journalEntry.findMany({
      orderBy: { createdAt: "desc" }, take: 3,
      include: { neighbourhood: { select: { name: true } } },
    }),
    loadConfig(prisma),
    loadBeds(prisma),
    loadConsoles(prisma),
  ]);

  const savedIds = savedFlatIds.map((p) => p.listingId);
  const flatRows = await prisma.flatListing.findMany({
    where: savedIds.length ? { OR: [{ id: { in: savedIds } }, { status: "active", isNew: true }] } : { status: "active", isNew: true },
    orderBy: { price: "asc" },
    take: 12,
    include: { area: { select: { name: true } } },
  });

  const scoredBeds = scoreBeds(beds).sort((a, b) => b.score - a.score);
  const scoredConsoles = scoreConsoles(consoles).sort(
    (a, b) => FIT_RANK[a.fit.overall] - FIT_RANK[b.fit.overall] || b.score - a.score,
  );

  const bedProduct = (b: (typeof scoredBeds)[number]): Product => ({
    id: b.id, dept: "bed", label: b.model, eyebrow: b.retailer,
    price: Math.round(b.landedCostGbp), priceSuffix: null,
    image: b.imageUrl, url: b.productUrl, href: "/beds",
    score: Math.round(b.score),
    badge: b.clearsSuitcase === true ? "Fits a suitcase" : b.arrivesAssembled === "included" ? "Built for you" : null,
    saved: b.pref === "want",
  });

  const consoleProduct = (c: (typeof scoredConsoles)[number]): Product => ({
    id: c.id, dept: "console", label: c.model, eyebrow: c.retailer,
    price: Math.round(c.landedCostGbp), priceSuffix: null,
    image: c.imageUrl, url: c.productUrl, href: "/consoles",
    score: Math.round(c.score),
    badge: c.fit.overall === "pass" ? (c.fit.ps5Route === "bay" ? "PS5 hidden in a bay" : "PS5 upright on top") : null,
    saved: c.pref === "want",
  });

  const savedSet = new Set(savedIds);
  const flatProduct = (l: (typeof flatRows)[number]): Product => ({
    id: l.id, dept: "flat", label: l.building, eyebrow: l.area?.name ?? null,
    price: l.price, priceSuffix: "pcm",
    image: l.imageUrl, url: l.building, href: "/flats",
    score: null, badge: l.isNew ? "New" : null,
    saved: savedSet.has(l.id),
  });

  // The basket. You buy ONE bed and ONE TV unit, so summing every saved item
  // would invent a room nobody is furnishing. Saved items are a shortlist: the
  // headline total is the best-scoring pick per department, with the range the
  // shortlist actually spans shown alongside it.
  const savedBeds = scoredBeds.filter((b) => b.pref === "want").map(bedProduct);
  const savedConsoles = scoredConsoles.filter((c) => c.pref === "want").map(consoleProduct);

  const dept = (label: string, href: string, items: Product[]) => {
    if (!items.length) return { label, href, chosen: null, items: [], alternatives: 0, min: 0, max: 0 };
    // Already sorted best-first by the corpus ranking.
    const [chosen, ...rest] = items;
    const prices = items.map((i) => i.price);
    return {
      label, href, chosen, items, alternatives: rest.length,
      min: Math.min(...prices), max: Math.max(...prices),
    };
  };

  const roomDepts = [dept("Bed", "/beds", savedBeds), dept("TV unit", "/consoles", savedConsoles)];
  const picked = roomDepts.filter((d) => d.chosen);

  const inBudgetFits = scoredConsoles.filter((c) => c.fit.overall === "pass" && !c.overBudget);

  return NextResponse.json({
    room: {
      depts: roomDepts,
      /** Best-scoring pick in each department. The headline figure. */
      total: picked.reduce((sum, d) => sum + (d.chosen?.price ?? 0), 0),
      /** What the shortlist spans, if you picked the cheapest or dearest of each. */
      min: picked.reduce((sum, d) => sum + d.min, 0),
      max: picked.reduce((sum, d) => sum + d.max, 0),
      shortlisted: savedBeds.length + savedConsoles.length,
      outstanding: roomDepts.filter((d) => !d.chosen).map((d) => d.label.toLowerCase()),
    },
    departments: {
      flats: { count: flatsActive, isNew: flatsNew, gone: flatsGone, saved: savedIds.length, areas, lastRun: config.lastRun },
      areas: {
        count: neighbourhoods.length,
        yes: neighbourhoods.filter((n) => n.status === "yes").length,
        maybe: neighbourhoods.filter((n) => n.status === "maybe").length,
        undecided: neighbourhoods.filter((n) => !n.status).length,
        ranked, apartments,
      },
      beds: {
        count: beds.length,
        saved: savedBeds.length,
        assembled: beds.filter((b) => b.arrivesAssembled === "included").length,
      },
      consoles: {
        count: consoles.length,
        saved: savedConsoles.length,
        confirmed: scoredConsoles.filter((c) => c.fit.overall === "pass").length,
        inBudgetFits: inBudgetFits.length,
        withBay: inBudgetFits.filter((c) => c.fit.ps5Route === "bay").length,
      },
    },
    shelves: {
      beds: scoredBeds.slice(0, 10).map(bedProduct),
      consoles: inBudgetFits.slice(0, 10).map(consoleProduct),
      flats: flatRows.map(flatProduct),
    },
    journal: {
      total: journalTotal,
      recent: journalRecent.map((e) => ({
        id: e.id,
        content: e.content.length > 150 ? `${e.content.slice(0, 150)}…` : e.content,
        decision: e.decision,
        createdAt: e.createdAt,
        neighbourhood: e.neighbourhood?.name ?? null,
      })),
    },
  });
}
