import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma/client";

const prisma = new PrismaClient();
const AREAS = process.argv.slice(2);

async function main() {
  if (!AREAS.length) throw new Error("pass area ids as args");
  const listings = await prisma.flatListing.findMany({
    where: { areaId: { in: AREAS } },
    select: { id: true },
  });
  const ids = listings.map((l) => l.id);
  console.log(`Areas to remove: ${AREAS.join(", ")}`);
  console.log(`Listings to remove: ${ids.length}`);
  if (ids.length) {
    const p = await prisma.flatPref.deleteMany({ where: { listingId: { in: ids } } });
    const s = await prisma.flatListingSource.deleteMany({ where: { listingId: { in: ids } } });
    const l = await prisma.flatListing.deleteMany({ where: { id: { in: ids } } });
    console.log(`Deleted prefs=${p.count} sources=${s.count} listings=${l.count}`);
  }
  const a = await prisma.flatArea.deleteMany({ where: { id: { in: AREAS } } });
  console.log(`Deleted areas=${a.count}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
