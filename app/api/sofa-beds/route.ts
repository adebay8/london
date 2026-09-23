import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadSofaBeds } from "@/lib/sofabeds/store";

// GET /api/sofa-beds — the whole sofa bed store. The /sofa-beds page recomputes
// the fit verdict, style match and score live (lib/sofabeds/{fit,score}.ts), so
// nothing derived is sent.
export async function GET() {
  const sofaBeds = await loadSofaBeds(prisma);
  return NextResponse.json({ sofaBeds });
}
