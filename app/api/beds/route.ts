import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadBeds } from "@/lib/beds/store";

// GET /api/beds — the whole bed store. The /beds page recomputes the
// recommendation score and every derived flag live from this (see
// lib/beds/score.ts), so nothing derived is sent.
export async function GET() {
  const beds = await loadBeds(prisma);
  return NextResponse.json({ beds });
}
