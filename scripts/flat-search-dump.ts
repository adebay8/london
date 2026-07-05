// Dump the flat-search store from the DB for a run: the area roster/config plus the
// active listings (id, building, price, scheme, source URLs) the skill needs to plan
// its per-area fetches and re-confirms. Read-only. Usage: npx tsx scripts/flat-search-dump.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";
import { loadAreas, loadConfig, loadListings } from "../lib/flat-search/store";

const databaseUrl = process.env.DATABASE_URL ?? "file:./london.db";
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });

async function main() {
  const [areas, config, listings] = await Promise.all([
    loadAreas(prisma),
    loadConfig(prisma),
    loadListings(prisma),
  ]);
  const active = listings
    .filter((l) => l.status === "active")
    .map((l) => ({
      id: l.id,
      area: l.areaId,
      building: l.building,
      price: l.price,
      scheme: l.scheme,
      sources: l.sources.map((s) => ({ platform: s.platform, url: s.url })),
    }));
  process.stdout.write(JSON.stringify({ config, areas, active }, null, 2) + "\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
