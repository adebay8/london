import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setConsolePref } from "@/lib/consoles/store";

// POST /api/consoles/pref { consoleId, pref } — set/clear a want/reject
// preference. pref "want" | "reject" upserts; pref null (or DELETE) clears it.
export async function POST(request: Request) {
  const { consoleId, pref } = await request.json();
  if (!consoleId || typeof consoleId !== "string") {
    return NextResponse.json({ error: "consoleId is required" }, { status: 400 });
  }
  if (pref != null && pref !== "want" && pref !== "reject") {
    return NextResponse.json({ error: "pref must be 'want', 'reject', or null" }, { status: 400 });
  }
  await setConsolePref(prisma, consoleId, pref ?? null);
  return NextResponse.json({ ok: true, pref: pref ?? null });
}

export async function DELETE(request: Request) {
  const { consoleId } = await request.json();
  if (!consoleId) return NextResponse.json({ error: "consoleId is required" }, { status: 400 });
  await setConsolePref(prisma, consoleId, null);
  return NextResponse.json({ ok: true });
}
