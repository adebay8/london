// One-off migration for the furnished(boolean) -> furnishing(enum) change and the
// "include unfurnished in search" change. Idempotent — safe to re-run.
//   1. flat_listings: backfill `furnishing` from the legacy `furnished` boolean, unset `furnished`.
//   2. flat_areas: strip the furnished-only params from each area's Zoopla/Rightmove search URL
//      so future runs surface unfurnished stock too.
// Uses a raw Mongo command for step 1 because the regenerated Prisma client no longer knows
// `furnished`, and reading a doc missing the now-required `furnishing` would otherwise throw.
// Run: npx tsx scripts/migrate-furnishing.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function stripFurnishParams(url: string): string {
  return url.replace(/furnished_state=furnished&/g, "").replace(/&furnishTypes=furnished/g, "");
}

async function main() {
  // 1. Backfill furnishing on listings (order-safe: false first, then true, then any stragglers).
  const res = (await prisma.$runCommandRaw({
    update: "flat_listings",
    updates: [
      { q: { furnished: false }, u: { $set: { furnishing: "unfurnished" }, $unset: { furnished: "" } }, multi: true },
      { q: { furnished: true }, u: { $set: { furnishing: "furnished" }, $unset: { furnished: "" } }, multi: true },
      { q: { furnishing: { $exists: false } }, u: { $set: { furnishing: "furnished" } }, multi: true },
    ],
  })) as { nModified?: number; n?: number };
  console.log(`listings furnishing backfill: matched=${res.n ?? "?"} modified=${res.nModified ?? "?"}`);

  // 2. Strip furnished-only params from live area search URLs.
  const areas = await prisma.flatArea.findMany();
  let changed = 0;
  for (const a of areas) {
    const urls = JSON.parse(a.searchUrls) as { zoopla?: string; rightmove?: string };
    const next = {
      ...urls,
      ...(urls.zoopla ? { zoopla: stripFurnishParams(urls.zoopla) } : {}),
      ...(urls.rightmove ? { rightmove: stripFurnishParams(urls.rightmove) } : {}),
    };
    const nextStr = JSON.stringify(next);
    if (nextStr !== a.searchUrls) {
      await prisma.flatArea.update({ where: { id: a.id }, data: { searchUrls: nextStr } });
      changed++;
    }
  }
  console.log(`area searchUrls updated: ${changed}/${areas.length}`);

  // Verify no listing is left without a furnishing value.
  const missing = (await prisma.$runCommandRaw({
    count: "flat_listings",
    query: { furnishing: { $exists: false } },
  })) as { n?: number };
  console.log(`listings still missing furnishing: ${missing.n ?? "?"}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
