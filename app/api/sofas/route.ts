import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadSofas } from "@/lib/sofas/store";

// GET /api/sofas — the whole sofa store. The /sofas page recomputes the fit
// verdict, style match and score live (lib/sofas/{fit,score}.ts), so nothing
// derived is sent.
export async function GET() {
  const sofas = await loadSofas(prisma);
  return NextResponse.json({ sofas });
}
