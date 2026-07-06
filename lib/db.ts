import { PrismaClient } from "@/app/generated/prisma/client";

// MongoDB (Atlas) — the connection string is read from MONGO_URI via the schema
// datasource; the MongoDB connector connects natively (no driver adapter).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
