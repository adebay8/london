import { config } from "dotenv";

// Load .env.local for DATABASE_URL (Next.js convention)
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";
import districts from "../data/districts.json";
import districtZones from "../data/districts_zones.json";
import neighbourhoodZones from "../data/neighbourhood_zones.json";

const databaseUrl = process.env.DATABASE_URL ?? "file:./london.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const boroughZoneMap: Record<string, number> = {};
  for (const entry of districtZones) {
    const zone = entry.zone.includes("/")
      ? Math.min(...entry.zone.split("/").map(Number))
      : Number(entry.zone);
    boroughZoneMap[entry.borough] = zone;
  }

  const grouped: Record<string, { location: string; borough: string; postcodes: Set<string> }> = {};

  for (const d of districts) {
    const key = `${d.location}::${d.borough}`;
    if (!grouped[key]) {
      grouped[key] = { location: d.location, borough: d.borough, postcodes: new Set() };
    }
    for (const pc of d.postcodeDistrict.split(",").map((s: string) => s.trim())) {
      grouped[key].postcodes.add(pc);
    }
  }

  // Build neighbourhood-level zone lookup (from fix-zones.ts output)
  const neighbourhoodZoneMap: Record<string, number> = {};
  for (const nz of neighbourhoodZones as { name: string; borough: string; zone: number }[]) {
    neighbourhoodZoneMap[`${nz.name}::${nz.borough}`] = nz.zone;
  }

  for (const entry of Object.values(grouped)) {
    // Try neighbourhood-level zone first, fall back to borough-level
    let zone = neighbourhoodZoneMap[`${entry.location}::${entry.borough}`];
    if (zone === undefined) {
      zone = boroughZoneMap[entry.borough];
    }
    if (zone === undefined) {
      const parts = entry.borough.split(/,\s*|\s+and\s+|\s*&\s*/).map((s) => s.trim());
      const zones = parts.map((p) => boroughZoneMap[p]).filter((z): z is number => z !== undefined);
      zone = zones.length > 0 ? Math.min(...zones) : 3;
    }
    await prisma.neighbourhood.upsert({
      where: { name_borough: { name: entry.location, borough: entry.borough } },
      update: { zone },
      create: { name: entry.location, borough: entry.borough, zone, postcodes: Array.from(entry.postcodes).join(", ") },
    });
  }

  const count = await prisma.neighbourhood.count();
  console.log(`Seeded ${count} neighbourhoods`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
