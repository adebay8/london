// DB <-> plain-object mapping for the sofa store. Same boundary discipline as
// the bed and console stores: the JSON-string columns are parsed and
// serialised here, and nothing derived is ever persisted.
import type { PrismaClient } from "@/app/generated/prisma/client";
import { NO_FINANCE, type FinancePolicy } from "@/lib/retail/finance";
import type { ChaiseSide, Condition, Filling, LegRest, Pref, Sofa } from "./types";

type PC = PrismaClient;

const CONDITIONS: Condition[] = ["new", "ex-display", "clearance", "second-hand"];
const LEG_RESTS: LegRest[] = ["chaise", "footstool", "both", "none"];
const SIDES: ChaiseSide[] = ["left", "right", "reversible"];
const FILLINGS: Filling[] = ["feather", "feather-blend", "foam", "fibre", "mixed"];

const oneOf = <T extends string>(allowed: T[], v: string | null): T | null =>
  v != null && (allowed as string[]).includes(v) ? (v as T) : null;

function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    const v = JSON.parse(s) as unknown;
    return v && typeof v === "object" ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function parseFinance(s: string | null | undefined): FinancePolicy {
  const v = parseJson<Partial<FinancePolicy>>(s, {});
  return {
    ...NO_FINANCE,
    ...v,
    tiers: Array.isArray(v.tiers) ? v.tiers.filter((t) => t && typeof t.minSpend === "number") : [],
  };
}

export async function loadSofas(prisma: PC): Promise<Sofa[]> {
  const rows = await prisma.sofa.findMany({ include: { pref: true }, orderBy: { landedCostGbp: "asc" } });
  return rows.map(
    (s): Sofa => ({
      id: s.id,
      retailer: s.retailer,
      brand: s.brand,
      model: s.model,
      productUrl: s.productUrl,
      imageUrl: s.imageUrl,
      colourwayShown: s.colourwayShown,

      priceGbp: s.priceGbp,
      rrpGbp: s.rrpGbp,
      deliveryCostGbp: s.deliveryCostGbp,
      deliveryIncluded: s.deliveryIncluded,
      landedCostGbp: s.landedCostGbp,
      overBudget: s.overBudget,

      condition: (oneOf(CONDITIONS, s.condition) ?? "new") as Condition,
      inStock: s.inStock,
      oneOff: s.oneOff,

      seats: s.seats,
      legRest: oneOf(LEG_RESTS, s.legRest),
      chaiseSide: oneOf(SIDES, s.chaiseSide),
      modular: s.modular,

      overallWidthCm: s.overallWidthCm,
      overallDepthCm: s.overallDepthCm,
      overallHeightCm: s.overallHeightCm,
      seatDepthCm: s.seatDepthCm,
      seatHeightCm: s.seatHeightCm,

      armStyle: s.armStyle,
      fabric: s.fabric,
      easyClean: s.easyClean,
      removableCovers: s.removableCovers,
      seatFilling: oneOf(FILLINGS, s.seatFilling),
      frameMaterial: s.frameMaterial,

      warranty: s.warranty,
      returnsWindow: s.returnsWindow,
      deliveryLeadTime: s.deliveryLeadTime,
      reviewScore: s.reviewScore,
      reviewCount: s.reviewCount,

      finance: parseFinance(s.finance),

      notes: s.notes,
      extra: parseJson<Record<string, string>>(s.extra, {}),
      pref: (s.pref?.pref as Pref | undefined) ?? null,
    }),
  );
}

export async function saveSofa(prisma: PC, s: Sofa): Promise<void> {
  const data = {
    retailer: s.retailer,
    brand: s.brand,
    model: s.model,
    productUrl: s.productUrl,
    imageUrl: s.imageUrl ?? null,
    colourwayShown: s.colourwayShown ?? null,

    priceGbp: s.priceGbp,
    rrpGbp: s.rrpGbp ?? null,
    deliveryCostGbp: s.deliveryCostGbp ?? null,
    deliveryIncluded: s.deliveryIncluded,
    landedCostGbp: s.landedCostGbp,
    overBudget: s.overBudget,

    condition: s.condition,
    inStock: s.inStock ?? null,
    oneOff: s.oneOff,

    seats: s.seats ?? null,
    legRest: s.legRest ?? null,
    chaiseSide: s.chaiseSide ?? null,
    modular: s.modular ?? null,

    overallWidthCm: s.overallWidthCm ?? null,
    overallDepthCm: s.overallDepthCm ?? null,
    overallHeightCm: s.overallHeightCm ?? null,
    seatDepthCm: s.seatDepthCm ?? null,
    seatHeightCm: s.seatHeightCm ?? null,

    armStyle: s.armStyle ?? null,
    fabric: s.fabric ?? null,
    easyClean: s.easyClean ?? null,
    removableCovers: s.removableCovers ?? null,
    seatFilling: s.seatFilling ?? null,
    frameMaterial: s.frameMaterial ?? null,

    warranty: s.warranty ?? null,
    returnsWindow: s.returnsWindow ?? null,
    deliveryLeadTime: s.deliveryLeadTime ?? null,
    reviewScore: s.reviewScore ?? null,
    reviewCount: s.reviewCount ?? null,

    finance: JSON.stringify(s.finance ?? NO_FINANCE),

    notes: s.notes ?? null,
    extra: JSON.stringify(s.extra ?? {}),
  };
  // Explicit branch rather than upsert — Atlas rejects the long aggregation
  // pipeline Prisma compiles an upsert into on a model this wide. See
  // lib/beds/store.ts for the full note.
  const existing = await prisma.sofa.findUnique({ where: { id: s.id }, select: { id: true } });
  if (existing) await prisma.sofa.update({ where: { id: s.id }, data });
  else await prisma.sofa.create({ data: { id: s.id, ...data } });
}

export async function setSofaPref(prisma: PC, sofaId: string, pref: Pref | null): Promise<void> {
  if (pref == null) {
    await prisma.sofaPref.deleteMany({ where: { sofaId } });
    return;
  }
  await prisma.sofaPref.upsert({ where: { sofaId }, create: { sofaId, pref }, update: { pref } });
}
