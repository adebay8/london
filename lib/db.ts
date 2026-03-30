import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/app/generated/prisma/client";

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./london.db";
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
