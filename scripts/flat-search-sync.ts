// Reconcile a flat-search run into the DB. The beaufort-flats skill produces a results
// JSON (array of {area, reconfirm[], candidates[]}) from its per-area fetches; this loads
// the current DB store, runs the pure reconcile core, writes the result back, and stamps
// flat.lastRun. Usage: npx tsx scripts/flat-search-sync.ts <results.json> [--today YYYY-MM-DD]
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import fs from "node:fs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";
import { loadAreas, loadConfig, loadListings, saveListings, setLastRun } from "../lib/flat-search/store";
import { reconcile, type AreaResult } from "../lib/flat-search/reconcile";

const databaseUrl = process.env.DATABASE_URL ?? "file:./london.db";
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const resultsPath = process.argv[2];
  if (!resultsPath || resultsPath.startsWith("--")) {
    throw new Error("usage: tsx scripts/flat-search-sync.ts <results.json> [--today YYYY-MM-DD]");
  }
  const today = arg("--today") ?? new Date().toISOString().slice(0, 10);
  const results = JSON.parse(fs.readFileSync(resultsPath, "utf8")) as AreaResult[];

  const [areas, config, before] = await Promise.all([
    loadAreas(prisma),
    loadConfig(prisma),
    loadListings(prisma),
  ]);

  const { listings, log } = reconcile({ listings: before, areas, budget: config.budget, today, results });

  await saveListings(prisma, listings);
  await setLastRun(prisma, today);

  console.log(log.join("\n"));
  const active = listings.filter((l) => l.status === "active").length;
  const isNew = listings.filter((l) => l.isNew).length;
  console.log(`\n--- run ${today} ---`);
  console.log(`active=${active} new=${isNew} total=${listings.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
