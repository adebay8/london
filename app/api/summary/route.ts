import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadBeds } from "@/lib/beds/store";
import { scoreAll as scoreBeds } from "@/lib/beds/score";
import { loadConsoles } from "@/lib/consoles/store";
import { scoreAll as scoreConsoles } from "@/lib/consoles/score";
import { loadConfig } from "@/lib/flat-search/store";

// GET /api/summary — the home page's single round trip.
//
// Deliberately NOT six client-side fetches of the existing endpoints:
// /api/flats alone ships every listing with its sources, which is a lot of
// payload to compute four counters from. Counting happens in the database and
// only the counters cross the wire.
//
// The two product searches are the exception — beds and consoles are small
// collections and their ranking is defined as a live computation over the
// whole corpus (see the shrinkage note in lib/beds/score.ts), so the front
// runner genuinely cannot be derived from a count. They are loaded and scored.

export const dynamic = "force-dynamic";

export async function GET() {
  const [
    flatsActive,
    flatsNew,
    flatsGone,
    flatsSaved,
    areas,
    neighbourhoods,
    ranked,
    apartments,
    journalTotal,
    journalRecent,
    config,
    beds,
    consoles,
  ] = await Promise.all([
    prisma.flatListing.count({ where: { status: "active" } }),
    prisma.flatListing.count({ where: { status: "active", isNew: true } }),
    prisma.flatListing.count({ where: { status: "gone" } }),
    prisma.flatPref.count({ where: { pref: "want" } }),
    prisma.flatArea.count(),
    prisma.neighbourhood.findMany({ select: { status: true } }),
    prisma.ranking.count(),
    prisma.apartmentBuilding.count(),
    prisma.journalEntry.count(),
    prisma.journalEntry.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { neighbourhood: { select: { name: true } } },
    }),
    loadConfig(prisma),
    loadBeds(prisma),
    loadConsoles(prisma),
  ]);

  const scoredBeds = scoreBeds(beds).sort((a, b) => b.score - a.score);
  const scoredConsoles = scoreConsoles(consoles);

  // Same ordering rule as the /consoles default sort: confirmed fits lead,
  // score orders within a rank. A unit we know takes the kit outranks one we
  // merely have not ruled out.
  const fitRank: Record<string, number> = { pass: 0, unknown: 1, fail: 2 };
  const consolesRanked = [...scoredConsoles].sort(
    (a, b) => fitRank[a.fit.overall] - fitRank[b.fit.overall] || b.score - a.score,
  );

  const topBed = scoredBeds[0];
  const topConsole = consolesRanked[0];

  return NextResponse.json({
    flats: {
      active: flatsActive,
      isNew: flatsNew,
      gone: flatsGone,
      saved: flatsSaved,
      areas,
      lastRun: config.lastRun,
    },
    neighbourhoods: {
      total: neighbourhoods.length,
      yes: neighbourhoods.filter((n) => n.status === "yes").length,
      maybe: neighbourhoods.filter((n) => n.status === "maybe").length,
      no: neighbourhoods.filter((n) => n.status === "no").length,
      undecided: neighbourhoods.filter((n) => !n.status).length,
      ranked,
    },
    apartments: { total: apartments },
    beds: {
      total: beds.length,
      saved: beds.filter((b) => b.pref === "want").length,
      top: topBed
        ? {
            label: `${topBed.retailer} ${topBed.model}`,
            score: Math.round(topBed.score),
            price: Math.round(topBed.landedCostGbp),
            note: topBed.clearsSuitcase === true ? "fits a suitcase" : null,
          }
        : null,
    },
    consoles: {
      total: consoles.length,
      saved: consoles.filter((c) => c.pref === "want").length,
      confirmedFit: scoredConsoles.filter((c) => c.fit.overall === "pass").length,
      unconfirmed: scoredConsoles.filter((c) => c.fit.overall === "unknown").length,
      top: topConsole
        ? {
            label: `${topConsole.retailer} ${topConsole.model}`,
            score: Math.round(topConsole.score),
            price: Math.round(topConsole.landedCostGbp),
            note: topConsole.fit.overall === "pass" ? "takes TV, bar & PS5" : "fit unconfirmed",
          }
        : null,
    },
    journal: {
      total: journalTotal,
      recent: journalRecent.map((e) => ({
        id: e.id,
        content: e.content.length > 160 ? `${e.content.slice(0, 160)}…` : e.content,
        decision: e.decision,
        createdAt: e.createdAt,
        neighbourhood: e.neighbourhood?.name ?? null,
      })),
    },
  });
}
