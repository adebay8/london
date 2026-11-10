// Import a buying research pass into MongoDB.
//
//   npx tsx scripts/homes-import.ts [dir-or-file]
//
// Default: docs/home-buying/ — towns.json first, then every .csv in date
// order. Safe to re-run: listings are tracked, not replaced (see
// lib/homes/track.ts), and save/reject prefs are never touched. Listings
// missing from a pass are kept; passes are partial by town.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { parseCsv } from "./sofabeds-import";
import { rowToListing } from "../lib/homes/parse";
import { saveTown, trackListing } from "../lib/homes/store";
import type { Lead } from "../lib/homes/types";

const prisma = new PrismaClient();
const DEFAULT_DIR = path.join(process.cwd(), "docs", "home-buying");

interface TownFile {
  id: string;
  town: string;
  station: string;
  searched?: string;
  gap?: string;
  policy?: string;
  nextAction?: string;
  leads?: Lead[];
}

async function main() {
  const target = process.argv[2] ?? DEFAULT_DIR;
  const dir = fs.statSync(target).isDirectory() ? target : path.dirname(target);
  const csvs = fs.statSync(target).isDirectory()
    ? fs.readdirSync(target).filter((f) => f.endsWith(".csv")).sort().map((f) => path.join(target, f))
    : [target];

  // Towns first, so every listing has a town to belong to.
  const townsFile = path.join(dir, "towns.json");
  const towns: TownFile[] = fs.existsSync(townsFile) ? JSON.parse(fs.readFileSync(townsFile, "utf8")) : [];
  const knownTowns = new Set(towns.map((t) => t.id));

  const counts = { new: 0, "price-change": 0, seen: 0, older: 0, skipped: 0 };
  const lastSearched = new Map<string, string>();

  const incoming = csvs.flatMap((file) => {
    const rows = parseCsv(fs.readFileSync(file, "utf8"));
    console.log(`  ${path.basename(file)}: ${rows.length} rows`);
    return rows.map(rowToListing);
  });

  for (const l of incoming) {
    if (!l) continue;
    if (!knownTowns.has(l.townId)) {
      // A town that only appears in the CSV still gets a record.
      towns.push({ id: l.townId, town: l.townId.replace(/-/g, " "), station: "Unknown" });
      knownTowns.add(l.townId);
    }
    const prev = lastSearched.get(l.townId);
    if (!prev || l.lastSeenAt > prev) lastSearched.set(l.townId, l.lastSeenAt);
  }
  // Every town in towns.json was searched on the latest pass date.
  const passDate = [...lastSearched.values()].sort().at(-1) ?? null;

  for (const t of towns) {
    await saveTown(prisma, {
      id: t.id,
      town: t.town,
      station: t.station,
      searched: t.searched ?? null,
      gap: t.gap ?? null,
      policy: t.policy ?? null,
      nextAction: t.nextAction ?? null,
      leads: t.leads ?? [],
      lastSearchedAt: lastSearched.get(t.id) ?? passDate,
    });
  }

  for (const l of incoming) {
    if (!l) { counts.skipped++; continue; }
    counts[await trackListing(prisma, l)]++;
  }

  const total = await prisma.homeListing.count();
  console.log(
    `Towns: ${towns.length} · listings in store: ${total}\n` +
      `  this run: ${counts.new} new · ${counts["price-change"]} price changes · ${counts.seen} re-seen` +
      `${counts.older ? ` · ${counts.older} from an older pass` : ""}` +
      `${counts.skipped ? ` · ${counts.skipped} skipped (no URL or price)` : ""}`,
  );
}

if (require.main === module) {
  main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
