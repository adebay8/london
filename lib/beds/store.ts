// DB <-> plain-object mapping for the bed store. The Bed/BedPref Prisma models
// are the source of truth; the page, the API routes and the import script all
// read/write through here. The `extra` JSON-string column (the long-tail spec
// columns) is parsed/serialised at this boundary, exactly as the flat store
// does for its roster/config columns.
import type { PrismaClient } from "@/app/generated/prisma/client";
import { NO_FINANCE, type Assembly, type Bed, type FinancePolicy, type Opening, type OttomanType, type Pref } from "./types";

type PC = PrismaClient;

function parseExtra(s: string | null | undefined): Record<string, string> {
  if (!s) return {};
  try {
    const v = JSON.parse(s) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {};
  } catch {
    return {};
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

export async function loadBeds(prisma: PC): Promise<Bed[]> {
  const rows = await prisma.bed.findMany({ include: { pref: true }, orderBy: { landedCostGbp: "asc" } });
  return rows.map(
    (b): Bed => ({
      id: b.id,
      retailer: b.retailer,
      brand: b.brand,
      model: b.model,
      productUrl: b.productUrl,
      colourwayShown: b.colourwayShown,
      colourwaysAvailable: b.colourwaysAvailable,

      doublePriceGbp: b.doublePriceGbp,
      deliveryCostGbp: b.deliveryCostGbp,
      deliveryIncluded: b.deliveryIncluded,
      assemblyCostGbp: b.assemblyCostGbp,
      assemblyIncluded: b.assemblyIncluded,
      landedCostGbp: b.landedCostGbp,
      extraMembershipCost: b.extraMembershipCost,
      overBudget: b.overBudget,

      arrivesAssembled: b.arrivesAssembled as Assembly,

      openingDirection: (b.openingDirection as Opening | null) ?? null,
      liftMechanism: b.liftMechanism,
      gasStrutRating: b.gasStrutRating,
      strutCount: b.strutCount,
      frameMaterial: b.frameMaterial,
      fixingType: b.fixingType,
      storageDepthCm: b.storageDepthCm,
      ottomanType: b.ottomanType as OttomanType,
      maxMattressWeightKg: b.maxMattressWeightKg,
      minMattressWeightKg: b.minMattressWeightKg,
      baseType: b.baseType,
      slatGapCm: b.slatGapCm,

      overallWidthCm: b.overallWidthCm,
      overallLengthCm: b.overallLengthCm,
      overallHeightCm: b.overallHeightCm,
      overhangCm: b.overhangCm,
      longestBoxCm: b.longestBoxCm,

      upholsteryMaterial: b.upholsteryMaterial,
      headboardStyle: b.headboardStyle,

      warranty: b.warranty,
      warrantyCoversMechanism: b.warrantyCoversMechanism,
      sparePartsAvailable: b.sparePartsAvailable,
      returnsWindow: b.returnsWindow,
      deliveryLeadTime: b.deliveryLeadTime,
      reviewScore: b.reviewScore,
      reviewCount: b.reviewCount,

      finance: parseFinance(b.finance),

      notes: b.notes,
      extra: parseExtra(b.extra),
      pref: (b.pref?.pref as Pref | undefined) ?? null,
    }),
  );
}

export async function saveBed(prisma: PC, b: Bed): Promise<void> {
  const data = {
    retailer: b.retailer,
    brand: b.brand,
    model: b.model,
    productUrl: b.productUrl,
    colourwayShown: b.colourwayShown ?? null,
    colourwaysAvailable: b.colourwaysAvailable ?? null,

    doublePriceGbp: b.doublePriceGbp,
    deliveryCostGbp: b.deliveryCostGbp ?? null,
    deliveryIncluded: b.deliveryIncluded,
    assemblyCostGbp: b.assemblyCostGbp ?? null,
    assemblyIncluded: b.assemblyIncluded,
    landedCostGbp: b.landedCostGbp,
    extraMembershipCost: b.extraMembershipCost ?? null,
    overBudget: b.overBudget,

    arrivesAssembled: b.arrivesAssembled,

    openingDirection: b.openingDirection ?? null,
    liftMechanism: b.liftMechanism ?? null,
    gasStrutRating: b.gasStrutRating ?? null,
    strutCount: b.strutCount ?? null,
    frameMaterial: b.frameMaterial ?? null,
    fixingType: b.fixingType ?? null,
    storageDepthCm: b.storageDepthCm ?? null,
    ottomanType: b.ottomanType,
    maxMattressWeightKg: b.maxMattressWeightKg ?? null,
    minMattressWeightKg: b.minMattressWeightKg ?? null,
    baseType: b.baseType ?? null,
    slatGapCm: b.slatGapCm ?? null,

    overallWidthCm: b.overallWidthCm ?? null,
    overallLengthCm: b.overallLengthCm ?? null,
    overallHeightCm: b.overallHeightCm ?? null,
    overhangCm: b.overhangCm ?? null,
    longestBoxCm: b.longestBoxCm ?? null,

    upholsteryMaterial: b.upholsteryMaterial ?? null,
    headboardStyle: b.headboardStyle ?? null,

    warranty: b.warranty ?? null,
    warrantyCoversMechanism: b.warrantyCoversMechanism ?? null,
    sparePartsAvailable: b.sparePartsAvailable ?? null,
    returnsWindow: b.returnsWindow ?? null,
    deliveryLeadTime: b.deliveryLeadTime ?? null,
    reviewScore: b.reviewScore ?? null,
    reviewCount: b.reviewCount ?? null,

    finance: JSON.stringify(b.finance ?? NO_FINANCE),

    notes: b.notes ?? null,
    extra: JSON.stringify(b.extra ?? {}),
  };
  // NOT prisma.bed.upsert(): on MongoDB, Prisma compiles upsert into an
  // aggregation-pipeline update with roughly one stage per field, and Atlas
  // rejects pipelines longer than 50 stages (error 8000). The Bed model is
  // wider than that, so do the branch explicitly — a plain update/create uses
  // a simple $set instead.
  const existing = await prisma.bed.findUnique({ where: { id: b.id }, select: { id: true } });
  if (existing) await prisma.bed.update({ where: { id: b.id }, data });
  else await prisma.bed.create({ data: { id: b.id, ...data } });
}

export async function saveBeds(prisma: PC, beds: Bed[]): Promise<void> {
  for (const b of beds) await saveBed(prisma, b);
}

/** null clears the preference. Mirrors the flat-search pref endpoint. */
export async function setBedPref(prisma: PC, bedId: string, pref: Pref | null): Promise<void> {
  if (pref == null) {
    await prisma.bedPref.deleteMany({ where: { bedId } });
    return;
  }
  await prisma.bedPref.upsert({
    where: { bedId },
    create: { bedId, pref },
    update: { pref },
  });
}
