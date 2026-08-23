// DB <-> plain-object mapping for the TV console store. The TvConsole and
// ConsolePref Prisma models are the source of truth; the page, the API routes
// and the import script all read/write through here. The three JSON-string
// columns (`bays`, `finance`, `extra`) are parsed/serialised at this boundary,
// exactly as the bed store does for its own.
import type { PrismaClient } from "@/app/generated/prisma/client";
import { NO_FINANCE, type FinancePolicy } from "@/lib/retail/finance";
import type { Assembly, BackPanel, Bay, BayKind, Pref, TvConsole } from "./types";

type PC = PrismaClient;

const BAY_KINDS: BayKind[] = ["open", "door", "glass-door", "drawer"];
const BACK_PANELS: BackPanel[] = ["open", "ported", "solid"];

function parseExtra(s: string | null | undefined): Record<string, string> {
  if (!s) return {};
  try {
    const v = JSON.parse(s) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** A dimension is a number or it is unpublished. Anything else — a string, a
 *  zero standing in for "don't know", NaN — becomes null, because the fit
 *  engine treats null as unknown and 0 as a real measurement that fails. */
function dim(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function parseBays(s: string | null | undefined): Bay[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
      .map((b): Bay => {
        const kind = String(b.kind ?? "open") as BayKind;
        const count = Number(b.count);
        return {
          kind: BAY_KINDS.includes(kind) ? kind : "open",
          count: Number.isFinite(count) && count > 0 ? Math.round(count) : 1,
          widthCm: dim(b.widthCm),
          heightCm: dim(b.heightCm),
          depthCm: dim(b.depthCm),
        };
      });
  } catch {
    return [];
  }
}

function parseFinance(s: string | null | undefined): FinancePolicy {
  if (!s) return { ...NO_FINANCE };
  try {
    const v = JSON.parse(s) as Partial<FinancePolicy>;
    if (!v || typeof v !== "object") return { ...NO_FINANCE };
    return {
      ...NO_FINANCE,
      ...v,
      tiers: Array.isArray(v.tiers) ? v.tiers.filter((t) => t && typeof t.minSpend === "number") : [],
    };
  } catch {
    return { ...NO_FINANCE };
  }
}

export async function loadConsoles(prisma: PC): Promise<TvConsole[]> {
  const rows = await prisma.tvConsole.findMany({ include: { pref: true }, orderBy: { landedCostGbp: "asc" } });
  return rows.map(
    (c): TvConsole => ({
      id: c.id,
      retailer: c.retailer,
      brand: c.brand,
      model: c.model,
      productUrl: c.productUrl,
      colourwayShown: c.colourwayShown,
      colourwaysAvailable: c.colourwaysAvailable,

      priceGbp: c.priceGbp,
      deliveryCostGbp: c.deliveryCostGbp,
      deliveryIncluded: c.deliveryIncluded,
      assemblyCostGbp: c.assemblyCostGbp,
      assemblyIncluded: c.assemblyIncluded,
      landedCostGbp: c.landedCostGbp,
      overBudget: c.overBudget,
      arrivesAssembled: c.arrivesAssembled as Assembly,

      mounting: c.mounting,

      topWidthCm: c.topWidthCm,
      topDepthCm: c.topDepthCm,
      topLoadKg: c.topLoadKg,

      overallWidthCm: c.overallWidthCm,
      overallDepthCm: c.overallDepthCm,
      overallHeightCm: c.overallHeightCm,

      bays: parseBays(c.bays),
      backPanel: BACK_PANELS.includes(c.backPanel as BackPanel) ? (c.backPanel as BackPanel) : null,
      cableManagement: c.cableManagement,

      frameMaterial: c.frameMaterial,
      finishMaterial: c.finishMaterial,
      legStyle: c.legStyle,

      warranty: c.warranty,
      sparePartsAvailable: c.sparePartsAvailable,
      returnsWindow: c.returnsWindow,
      deliveryLeadTime: c.deliveryLeadTime,
      reviewScore: c.reviewScore,
      reviewCount: c.reviewCount,
      imageUrl: c.imageUrl,

      finance: parseFinance(c.finance),

      notes: c.notes,
      extra: parseExtra(c.extra),
      pref: (c.pref?.pref as Pref | undefined) ?? null,
    }),
  );
}

export async function saveConsole(prisma: PC, c: TvConsole): Promise<void> {
  const data = {
    retailer: c.retailer,
    brand: c.brand,
    model: c.model,
    productUrl: c.productUrl,
    colourwayShown: c.colourwayShown ?? null,
    colourwaysAvailable: c.colourwaysAvailable ?? null,

    priceGbp: c.priceGbp,
    deliveryCostGbp: c.deliveryCostGbp ?? null,
    deliveryIncluded: c.deliveryIncluded,
    assemblyCostGbp: c.assemblyCostGbp ?? null,
    assemblyIncluded: c.assemblyIncluded,
    landedCostGbp: c.landedCostGbp,
    overBudget: c.overBudget,
    arrivesAssembled: c.arrivesAssembled,

    mounting: c.mounting ?? null,

    topWidthCm: c.topWidthCm ?? null,
    topDepthCm: c.topDepthCm ?? null,
    topLoadKg: c.topLoadKg ?? null,

    overallWidthCm: c.overallWidthCm ?? null,
    overallDepthCm: c.overallDepthCm ?? null,
    overallHeightCm: c.overallHeightCm ?? null,

    bays: JSON.stringify(c.bays ?? []),
    backPanel: c.backPanel ?? null,
    cableManagement: c.cableManagement ?? null,

    frameMaterial: c.frameMaterial ?? null,
    finishMaterial: c.finishMaterial ?? null,
    legStyle: c.legStyle ?? null,

    warranty: c.warranty ?? null,
    sparePartsAvailable: c.sparePartsAvailable ?? null,
    returnsWindow: c.returnsWindow ?? null,
    deliveryLeadTime: c.deliveryLeadTime ?? null,
    reviewScore: c.reviewScore ?? null,
    reviewCount: c.reviewCount ?? null,
    imageUrl: c.imageUrl ?? null,

    finance: JSON.stringify(c.finance ?? NO_FINANCE),

    notes: c.notes ?? null,
    extra: JSON.stringify(c.extra ?? {}),
  };
  // NOT prisma.tvConsole.upsert(): on MongoDB, Prisma compiles upsert into an
  // aggregation-pipeline update with roughly one stage per field, and Atlas
  // rejects pipelines longer than 50 stages (error 8000). This model is wider
  // than that, so do the branch explicitly — a plain update/create uses a
  // simple $set instead. Same reason as lib/beds/store.ts.
  const existing = await prisma.tvConsole.findUnique({ where: { id: c.id }, select: { id: true } });
  if (existing) await prisma.tvConsole.update({ where: { id: c.id }, data });
  else await prisma.tvConsole.create({ data: { id: c.id, ...data } });
}

export async function saveConsoles(prisma: PC, consoles: TvConsole[]): Promise<void> {
  for (const c of consoles) await saveConsole(prisma, c);
}

/** null clears the preference. Mirrors the bed and flat pref endpoints. */
export async function setConsolePref(prisma: PC, consoleId: string, pref: Pref | null): Promise<void> {
  if (pref == null) {
    await prisma.consolePref.deleteMany({ where: { consoleId } });
    return;
  }
  await prisma.consolePref.upsert({
    where: { consoleId },
    create: { consoleId, pref },
    update: { pref },
  });
}
