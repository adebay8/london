// Seed/bootstrap the flat-search tables from the committed baseline snapshot
// (data/flat-search-seed.json). The live store is the DB — this only bootstraps a
// FRESH/empty flat store (e.g. after a DB rebuild), so it SKIPS if listings already
// exist to avoid reverting live runs. Idempotent otherwise. Run: npx tsx scripts/flat-search-seed.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { upsertAreas, saveConfig, saveListing } from "../lib/flat-search/store";
import type { Area, Budget, Listing, MoveTiming, StaleThresholds } from "../lib/flat-search/types";

const prisma = new PrismaClient();

interface LegacyStore {
  meta: {
    lastRun: string;
    budget: Budget;
    staleThresholdsDays: StaleThresholds;
    moveTiming: MoveTiming;
    areas: (Omit<Area, "tier" | "zone" | "sortOrder" | "expectedBand"> & {
      tier: string | number;
      zone: string | number;
      expectedBand?: string;
    })[];
  };
  listings: (Record<string, unknown> & { id: string; area: string; building: string; price: number })[];
}

async function main() {
  const force = process.argv.includes("--force");
  const existing = await prisma.flatListing.count();
  if (existing > 0 && !force) {
    console.log(`flat store already has ${existing} listings — skipping seed (pass --force to overwrite from snapshot).`);
    return;
  }

  const raw = JSON.parse(fs.readFileSync("data/flat-search-seed.json", "utf8")) as LegacyStore;

  const areas: Area[] = raw.meta.areas.map((a, i) => ({
    id: a.id,
    name: a.name,
    borough: a.borough,
    zone: String(a.zone),
    tier: a.tier === "anchor" ? "anchor" : String(a.tier),
    expectedBand: a.expectedBand ?? null,
    sortOrder: i,
    buildingRoster: a.buildingRoster ?? [],
    phaseYears: a.phaseYears ?? {},
    btrOperators: a.btrOperators ?? [],
    operatorPortals: a.operatorPortals ?? [],
    searchUrls: a.searchUrls ?? {},
    flags: a.flags ?? [],
  }));
  await upsertAreas(prisma, areas);
  await saveConfig(prisma, {
    budget: raw.meta.budget,
    staleThresholds: raw.meta.staleThresholdsDays,
    moveTiming: raw.meta.moveTiming,
    lastRun: raw.meta.lastRun,
  });

  const g = (l: Record<string, unknown>, k: string) => l[k];
  for (const l of raw.listings) {
    const listing: Listing = {
      id: l.id,
      areaId: l.area,
      building: l.building,
      street: (g(l, "street") as string) ?? null,
      phaseYear: (g(l, "phaseYear") as number) ?? null,
      phaseLabel: (g(l, "phaseLabel") as string) ?? null,
      price: l.price,
      budgetTier: ((g(l, "budgetTier") as string) ?? "over") as Listing["budgetTier"],
      furnishing:
        ((g(l, "furnishing") as Listing["furnishing"]) ?? (g(l, "furnished") === false ? "unfurnished" : "furnished")),
      available: (g(l, "available") as string) ?? null,
      availableNow: (g(l, "availableNow") as boolean) ?? false,
      availableDate: (g(l, "availableDate") as string) ?? null,
      listedDate: (g(l, "listedDate") as string) ?? null,
      epc: (g(l, "epc") as string) ?? null,
      sizeSqft: (g(l, "sizeSqft") as number) ?? null,
      scheme: ((g(l, "scheme") as string) ?? "unknown") as Listing["scheme"],
      operator: (g(l, "operator") as string) ?? null,
      schemeConfidence: (g(l, "schemeConfidence") as string) ?? "unverified",
      schemeSource: (g(l, "schemeSource") as string) ?? null,
      firstSeen: (g(l, "firstSeen") as string) ?? raw.meta.lastRun,
      lastSeen: (g(l, "lastSeen") as string) ?? raw.meta.lastRun,
      lastConfirmed: (g(l, "lastConfirmed") as string) ?? null,
      status: ((g(l, "status") as string) ?? "active") as Listing["status"],
      goneReason: ((g(l, "goneReason") as string) ?? null) as Listing["goneReason"],
      unconfirmed: (g(l, "unconfirmed") as boolean) ?? false,
      isNew: (g(l, "isNew") as boolean) ?? false,
      imageUrl: (g(l, "imageUrl") as string) ?? null,
      note: (g(l, "note") as string) ?? null,
      sources: ((g(l, "sources") as { platform: string; url: string; agent?: string }[]) ?? []).map((s) => ({
        platform: s.platform,
        url: s.url,
        agent: s.agent ?? null,
      })),
    };
    await saveListing(prisma, listing);
  }

  const areasN = await prisma.flatArea.count();
  const listingsN = await prisma.flatListing.count();
  console.log(`seeded flat store: areas=${areasN} listings=${listingsN}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
