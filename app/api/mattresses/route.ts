import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadBedConstraints, loadMattresses } from "@/lib/mattresses/store";

// GET /api/mattresses — the whole mattress store, plus the constraints of the
// beds shortlisted on /beds. The /mattresses page recomputes the fit verdict,
// the deal assessment and the score live (lib/mattresses/{fit,deal,score}.ts),
// so nothing derived is sent.
//
// The beds ride along because bed compatibility is the one question neither
// search can answer alone: whether an ottoman's gas struts can lift the bed
// with this mattress on it.
export async function GET() {
  const [mattresses, beds] = await Promise.all([loadMattresses(prisma), loadBedConstraints(prisma)]);
  return NextResponse.json({ mattresses, beds });
}
