import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadConsoles } from "@/lib/consoles/store";

// GET /api/consoles — the whole console store. The /consoles page recomputes
// the fit verdict and the recommendation score live from this (see
// lib/consoles/fit.ts and score.ts), so nothing derived is sent.
export async function GET() {
  const consoles = await loadConsoles(prisma);
  return NextResponse.json({ consoles });
}
