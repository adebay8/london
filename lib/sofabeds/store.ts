// DB <-> plain-object mapping for the sofa bed store. Same boundary discipline
// as lib/sofas/store.ts: the JSON-string columns are parsed and serialised
// here, and nothing derived is ever persisted.
import type { PrismaClient } from "@prisma/client";
import { NO_FINANCE, type FinancePolicy } from "@/lib/retail/finance";
import type {
  ChaiseSide, Condition, Filling, LegRest, MattressType, Mechanism, Pref, SofaBed,
} from "./types";

type PC = PrismaClient;

const CONDITIONS: Condition[] = ["new", "ex-display", "clearance", "second-hand"];
const MECHANISMS: Mechanism[] = ["fold-out", "pull-out", "click-clack", "futon"];
const LEG_RESTS: LegRest[] = ["chaise", "storage-chaise", "footstool", "both", "none"];
const SIDES: ChaiseSide[] = ["left", "right", "reversible"];
const MATTRESS_TYPES: MattressType[] = ["pocket-sprung", "sprung", "memory", "foam", "fibre"];
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

export async function loadSofaBeds(prisma: PC): Promise<SofaBed[]> {
  const rows = await prisma.sofaBed.findMany({ include: { pref: true }, orderBy: { landedCostGbp: "asc" } });
  return rows.map(
    (s): SofaBed => ({
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
      seatCushions: s.seatCushions,

      mechanism: oneOf(MECHANISMS, s.mechanism),
      separateMattress: s.separateMattress,

      bedWidthCm: s.bedWidthCm,
      bedLengthCm: s.bedLengthCm,
      mattressType: oneOf(MATTRESS_TYPES, s.mattressType),
      mattressThicknessCm: s.mattressThicknessCm,
      beddingStorage: s.beddingStorage,

      legRest: oneOf(LEG_RESTS, s.legRest),
      chaiseSide: oneOf(SIDES, s.chaiseSide),
      modular: s.modular,

      overallWidthCm: s.overallWidthCm,
      overallDepthCm: s.overallDepthCm,
      overallHeightCm: s.overallHeightCm,
      extendedDepthCm: s.extendedDepthCm,
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

export async function saveSofaBed(prisma: PC, s: SofaBed): Promise<void> {
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
    seatCushions: s.seatCushions ?? null,

    mechanism: s.mechanism ?? null,
    separateMattress: s.separateMattress ?? null,

    bedWidthCm: s.bedWidthCm ?? null,
    bedLengthCm: s.bedLengthCm ?? null,
    mattressType: s.mattressType ?? null,
    mattressThicknessCm: s.mattressThicknessCm ?? null,
    beddingStorage: s.beddingStorage ?? null,

    legRest: s.legRest ?? null,
    chaiseSide: s.chaiseSide ?? null,
    modular: s.modular ?? null,

    overallWidthCm: s.overallWidthCm ?? null,
    overallDepthCm: s.overallDepthCm ?? null,
    overallHeightCm: s.overallHeightCm ?? null,
    extendedDepthCm: s.extendedDepthCm ?? null,
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
  const existing = await prisma.sofaBed.findUnique({ where: { id: s.id }, select: { id: true } });
  if (existing) await prisma.sofaBed.update({ where: { id: s.id }, data });
  else await prisma.sofaBed.create({ data: { id: s.id, ...data } });
}

export async function setSofaBedPref(prisma: PC, sofaBedId: string, pref: Pref | null): Promise<void> {
  if (pref == null) {
    await prisma.sofaBedPref.deleteMany({ where: { sofaBedId } });
    return;
  }
  await prisma.sofaBedPref.upsert({ where: { sofaBedId }, create: { sofaBedId, pref }, update: { pref } });
}
