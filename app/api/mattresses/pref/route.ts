import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setMattressPref } from "@/lib/mattresses/store";

// POST /api/mattresses/pref { mattressId, pref } — set/clear a want/reject.
export async function POST(request: Request) {
  const { mattressId, pref } = await request.json();
  if (!mattressId || typeof mattressId !== "string") {
    return NextResponse.json({ error: "mattressId is required" }, { status: 400 });
  }
  if (pref != null && pref !== "want" && pref !== "reject") {
    return NextResponse.json({ error: "pref must be 'want', 'reject', or null" }, { status: 400 });
  }
  await setMattressPref(prisma, mattressId, pref ?? null);
  return NextResponse.json({ ok: true, pref: pref ?? null });
}

export async function DELETE(request: Request) {
  const { mattressId } = await request.json();
  if (!mattressId) return NextResponse.json({ error: "mattressId is required" }, { status: 400 });
  await setMattressPref(prisma, mattressId, null);
  return NextResponse.json({ ok: true });
}
