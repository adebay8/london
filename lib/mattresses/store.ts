// DB <-> plain-object mapping for the mattress store. Same boundary discipline
// as the bed, console and sofa stores: the JSON-string columns are parsed and
// serialised here, and nothing derived is ever persisted.
import type { PrismaClient } from "@prisma/client";
import { NO_FINANCE, type FinancePolicy } from "@/lib/retail/finance";
import { ventilatedBase, type BedConstraint } from "./compat";
import type { Condition, Firmness, Mattress, MattressType, Pref, RrpEvidence, SpringType } from "./types";

type PC = PrismaClient;

const CONDITIONS: Condition[] = ["new", "clearance"];
const TYPES: MattressType[] = ["pocket-sprung", "hybrid", "memory-foam", "foam", "open-coil", "latex", "natural"];
const SPRING_TYPES: SpringType[] = ["pocket", "open-coil", "continuous", "none"];
const FIRMNESS: Firmness[] = ["soft", "medium-soft", "medium", "medium-firm", "firm"];
const EVIDENCE: RrpEvidence[] = ["verified-higher", "permanent-sale", "single-observation"];

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

export async function loadMattresses(prisma: PC): Promise<Mattress[]> {
  const rows = await prisma.mattress.findMany({ include: { pref: true }, orderBy: { landedCostGbp: "asc" } });
  return rows.map(
    (m): Mattress => ({
      id: m.id,
      retailer: m.retailer,
      brand: m.brand,
      model: m.model,
      productUrl: m.productUrl,
      imageUrl: m.imageUrl,

      priceGbp: m.priceGbp,
      rrpGbp: m.rrpGbp,
      deliveryCostGbp: m.deliveryCostGbp,
      deliveryIncluded: m.deliveryIncluded,
      disposalCostGbp: m.disposalCostGbp,
      landedCostGbp: m.landedCostGbp,
      overBudget: m.overBudget,

      condition: (oneOf(CONDITIONS, m.condition) ?? "new") as Condition,
      inStock: m.inStock,
      rrpEvidence: oneOf(EVIDENCE, m.rrpEvidence),
      priceFloorGbp: m.priceFloorGbp,

      size: m.size,
      widthCm: m.widthCm,
      lengthCm: m.lengthCm,
      depthCm: m.depthCm,

      type: oneOf(TYPES, m.type),
      springType: oneOf(SPRING_TYPES, m.springType),
      springCount: m.springCount,
      zoned: m.zoned,
      turnRequired: m.turnRequired,

      firmnessLabel: m.firmnessLabel,
      firmnessScale: m.firmnessScale,
      firmness: oneOf(FIRMNESS, m.firmness),

      comfortLayer: m.comfortLayer,
      comfortLayerDepthCm: m.comfortLayerDepthCm,
      weightKg: m.weightKg,

      slattedBaseOk: m.slattedBaseOk,
      platformBaseOk: m.platformBaseOk,
      ottomanOk: m.ottomanOk,

      coverRemovable: m.coverRemovable,
      coverWashable: m.coverWashable,

      trialNights: m.trialNights,
      trialFreeReturns: m.trialFreeReturns,
      warrantyYears: m.warrantyYears,
      returnsWindow: m.returnsWindow,
      deliveryLeadTime: m.deliveryLeadTime,

      reviewScore: m.reviewScore,
      reviewCount: m.reviewCount,
      testedBy: m.testedBy,
      testScore: m.testScore,

      finance: parseFinance(m.finance),

      notes: m.notes,
      extra: parseJson<Record<string, string>>(m.extra, {}),
      pref: (m.pref?.pref as Pref | undefined) ?? null,
    }),
  );
}

/** The shortlisted beds, as the two constraints a mattress has to clear to go
 *  in one. Only "want" beds — the badge is about YOUR shortlist, not about
 *  every ottoman on the market. */
export async function loadBedConstraints(prisma: PC): Promise<BedConstraint[]> {
  const rows = await prisma.bed.findMany({
    where: { pref: { pref: "want" } },
    select: { id: true, retailer: true, model: true, maxMattressWeightKg: true, baseType: true },
    orderBy: { landedCostGbp: "asc" },
  });
  return rows.map((b) => ({
    id: b.id,
    retailer: b.retailer,
    model: b.model,
    maxMattressWeightKg: b.maxMattressWeightKg,
    baseType: b.baseType,
  }));
}

export { ventilatedBase };

export async function saveMattress(prisma: PC, m: Mattress): Promise<void> {
  const data = {
    retailer: m.retailer,
    brand: m.brand,
    model: m.model,
    productUrl: m.productUrl,
    imageUrl: m.imageUrl ?? null,

    priceGbp: m.priceGbp,
    rrpGbp: m.rrpGbp ?? null,
    deliveryCostGbp: m.deliveryCostGbp ?? null,
    deliveryIncluded: m.deliveryIncluded,
    disposalCostGbp: m.disposalCostGbp ?? null,
    landedCostGbp: m.landedCostGbp,
    overBudget: m.overBudget,

    condition: m.condition,
    inStock: m.inStock ?? null,
    rrpEvidence: m.rrpEvidence ?? null,
    priceFloorGbp: m.priceFloorGbp ?? null,

    size: m.size ?? null,
    widthCm: m.widthCm ?? null,
    lengthCm: m.lengthCm ?? null,
    depthCm: m.depthCm ?? null,

    type: m.type ?? null,
    springType: m.springType ?? null,
    springCount: m.springCount ?? null,
    zoned: m.zoned ?? null,
    turnRequired: m.turnRequired ?? null,

    firmnessLabel: m.firmnessLabel ?? null,
    firmnessScale: m.firmnessScale ?? null,
    firmness: m.firmness ?? null,

    comfortLayer: m.comfortLayer ?? null,
    comfortLayerDepthCm: m.comfortLayerDepthCm ?? null,
    weightKg: m.weightKg ?? null,

    slattedBaseOk: m.slattedBaseOk ?? null,
    platformBaseOk: m.platformBaseOk ?? null,
    ottomanOk: m.ottomanOk ?? null,

    coverRemovable: m.coverRemovable ?? null,
    coverWashable: m.coverWashable ?? null,

    trialNights: m.trialNights ?? null,
    trialFreeReturns: m.trialFreeReturns ?? null,
    warrantyYears: m.warrantyYears ?? null,
    returnsWindow: m.returnsWindow ?? null,
    deliveryLeadTime: m.deliveryLeadTime ?? null,

    reviewScore: m.reviewScore ?? null,
    reviewCount: m.reviewCount ?? null,
    testedBy: m.testedBy ?? null,
    testScore: m.testScore ?? null,

    finance: JSON.stringify(m.finance ?? NO_FINANCE),

    notes: m.notes ?? null,
    extra: JSON.stringify(m.extra ?? {}),
  };
  // Explicit branch rather than upsert — Atlas rejects the long aggregation
  // pipeline Prisma compiles an upsert into on a model this wide. See
  // lib/beds/store.ts for the full note.
  const existing = await prisma.mattress.findUnique({ where: { id: m.id }, select: { id: true } });
  if (existing) await prisma.mattress.update({ where: { id: m.id }, data });
  else await prisma.mattress.create({ data: { id: m.id, ...data } });
}

export async function setMattressPref(prisma: PC, mattressId: string, pref: Pref | null): Promise<void> {
  if (pref == null) {
    await prisma.mattressPref.deleteMany({ where: { mattressId } });
    return;
  }
  await prisma.mattressPref.upsert({ where: { mattressId }, create: { mattressId, pref }, update: { pref } });
}
