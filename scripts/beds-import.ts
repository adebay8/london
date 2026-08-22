// Import the ottoman-bed research CSV into the `beds` collection in MongoDB.
// The CSV is the research artefact; the DB is what the /beds page reads.
// Idempotent — re-running upserts by id and leaves want/reject prefs intact.
//
//   npx tsx scripts/beds-import.ts [path/to/ottoman-beds-double.csv]
//
// Default path: ~/Documents/bed-search/ottoman-beds-double.csv
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "../app/generated/prisma/client";
import { saveBed } from "../lib/beds/store";
import { MATTRESS_WIDTH_CM, NO_FINANCE, type Assembly, type Bed, type Opening, type OttomanType } from "../lib/beds/types";

const prisma = new PrismaClient();

const DEFAULT_CSV = path.join(os.homedir(), "Documents", "bed-search", "ottoman-beds-double.csv");

// Research scratchpad — holds rows/finance.jsonl (retailer-level finance policy).
// Override with BEDS_SCRATCH if the research moves.
const SCRATCH =
  process.env.BEDS_SCRATCH ??
  "/private/tmp/claude-501/-Users-onuchukwu-Documents-Projects-london/c6bb67c4-4aaa-404e-b24e-ad8a92ec20b3/scratchpad";

// The columns promoted to real Prisma fields. Everything else in the CSV is
// kept verbatim in `extra` and surfaced in the detail drawer.
const PROMOTED = new Set([
  "retailer", "brand", "model", "product_url", "colourway_shown", "colourways_available",
  "double_price_gbp", "delivery_cost_gbp", "assembly_cost_gbp", "landed_cost_gbp",
  "extra_membership_cost", "over_budget", "arrives_assembled",
  "opening_direction", "lift_mechanism", "gas_strut_rating", "strut_count",
  "frame_material", "fixing_type", "storage_depth_cm", "ottoman_type",
  "max_mattress_weight_kg", "min_mattress_weight_kg", "base_type", "slat_gap_cm",
  "overall_width_cm", "overall_length_cm", "overall_height_cm", "footprint_overhang_cm",
  "longest_box_cm", "upholstery_material", "headboard_style",
  "warranty", "warranty_covers_mechanism", "spare_parts_available",
  "returns_window", "delivery_lead_time", "review_score", "review_count", "notes",
  // derived in the CSV, recomputed live in score.ts — do not persist
  "clears_32cm_suitcase", "slat_gap_ok_7cm",
]);

/** Minimal RFC4180 CSV parser — the research CSV has quoted fields containing
 *  commas and newlines, so splitting on "," is not enough. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  const header = (rows.shift() ?? []).map((h) => h.replace(/^﻿/, "").trim());
  return rows
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const str = (v: string | undefined): string | null => {
  const s = (v ?? "").trim();
  return s === "" || /^(n\/a|na|unknown|-|none)$/i.test(s) ? null : s;
};

function num(v: string | undefined): number | null {
  const s = str(v);
  if (s == null) return null;
  const m = /(-?\d+(?:\.\d+)?)/.exec(s.replace(/,/g, ""));
  return m ? Number(m[1]) : null;
}

const isIncluded = (v: string | undefined) => /^(included|incl|inc|free)$/i.test((v ?? "").trim());

function assemblyMode(v: string | undefined): Assembly {
  const s = (v ?? "").toLowerCase();
  if (s.startsWith("yes")) return "included";
  if (s.startsWith("paid") || s.startsWith("varies")) return "paid";
  return "self";
}

function opening(v: string | undefined): Opening | null {
  const s = (v ?? "").toLowerCase();
  if (!s) return null;
  if (s.includes("either") || s.includes("buyer choice") || s.includes("both")) return "either";
  if (s.includes("side")) return "side";
  if (s.includes("end") || s.includes("foot")) return "end";
  return null;
}

function ottoman(v: string | undefined): OttomanType {
  const s = (v ?? "").toLowerCase();
  if (s.includes("half") || s.includes("conti")) return "half";
  if (s.includes("side-only")) return "side-only";
  return "full";
}

/** Stable, readable id so re-imports upsert rather than duplicate. */
function makeId(retailer: string, model: string): string {
  return `${retailer}-${model}`
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110);
}

function toBed(r: Record<string, string>): Bed | null {
  const retailer = str(r.retailer);
  const model = str(r.model);
  const url = str(r.product_url);
  const landed = num(r.landed_cost_gbp);
  const price = num(r.double_price_gbp);
  if (!retailer || !model || !url || price == null || landed == null) return null;

  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    if (!PROMOTED.has(k) && str(v) != null) extra[k] = v;
  }

  const width = num(r.overall_width_cm);
  const overhang = num(r.footprint_overhang_cm) ?? (width != null ? width - MATTRESS_WIDTH_CM : null);

  return {
    id: makeId(retailer, model),
    retailer,
    brand: str(r.brand) ?? retailer,
    model,
    productUrl: url,
    colourwayShown: str(r.colourway_shown),
    colourwaysAvailable: str(r.colourways_available),

    doublePriceGbp: price,
    deliveryCostGbp: isIncluded(r.delivery_cost_gbp) ? null : num(r.delivery_cost_gbp),
    deliveryIncluded: isIncluded(r.delivery_cost_gbp),
    assemblyCostGbp: isIncluded(r.assembly_cost_gbp) ? null : num(r.assembly_cost_gbp),
    assemblyIncluded: isIncluded(r.assembly_cost_gbp),
    landedCostGbp: landed,
    extraMembershipCost: str(r.extra_membership_cost),
    overBudget: /^yes$/i.test((r.over_budget ?? "").trim()),

    arrivesAssembled: assemblyMode(r.arrives_assembled),

    openingDirection: opening(r.opening_direction),
    liftMechanism: str(r.lift_mechanism),
    gasStrutRating: str(r.gas_strut_rating),
    strutCount: num(r.strut_count),
    frameMaterial: str(r.frame_material),
    fixingType: str(r.fixing_type),
    storageDepthCm: num(r.storage_depth_cm),
    ottomanType: ottoman(r.ottoman_type),
    maxMattressWeightKg: num(r.max_mattress_weight_kg),
    minMattressWeightKg: num(r.min_mattress_weight_kg),
    baseType: str(r.base_type),
    slatGapCm: num(r.slat_gap_cm),

    overallWidthCm: width,
    overallLengthCm: num(r.overall_length_cm),
    overallHeightCm: num(r.overall_height_cm),
    overhangCm: overhang,
    longestBoxCm: num(r.longest_box_cm),

    upholsteryMaterial: str(r.upholstery_material),
    headboardStyle: str(r.headboard_style),

    warranty: str(r.warranty),
    warrantyCoversMechanism: str(r.warranty_covers_mechanism),
    sparePartsAvailable: str(r.spare_parts_available),
    returnsWindow: str(r.returns_window),
    deliveryLeadTime: str(r.delivery_lead_time),
    reviewScore: num(r.review_score),
    reviewCount: num(r.review_count),

    // Filled from rows/finance.jsonl after parsing — retailer policy, not per-product.
    finance: { ...NO_FINANCE },

    notes: str(r.notes),
    extra,
    pref: null,
  };
}

interface FinanceRow {
  retailer: string;
  financeAvailable?: boolean | string;
  financeType?: string;
  financeProvider?: string;
  financeApr?: number | string;
  financeMaxMonths?: number | string;
  financeMinSpend?: number | string;
  financeTiers?: { minSpend: number | string; months: number | string; apr: number | string }[];
  financeDeposit?: string;
  financeNotes?: string;
  financeUrl?: string;
}

/** Finance is a retailer-level policy, so it is researched once per retailer
 *  and stamped onto every one of that retailer's beds. */
function loadFinance(file: string): Map<string, FinanceRow> {
  const map = new Map<string, FinanceRow>();
  if (!fs.existsSync(file)) return map;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const r = JSON.parse(t) as FinanceRow;
      if (r.retailer) map.set(r.retailer.trim().toLowerCase(), r);
    } catch {
      console.warn(`  skipped unparseable finance line: ${t.slice(0, 80)}`);
    }
  }
  return map;
}

function applyFinance(b: Bed, f: FinanceRow | undefined): void {
  if (!f) return;
  const yes = (v: unknown) => v === true || /^(yes|true)$/i.test(String(v ?? ""));
  const n = (v: unknown) => {
    if (v == null || v === "") return null;
    const m = /(-?\d+(?:\.\d+)?)/.exec(String(v).replace(/,/g, ""));
    return m ? Number(m[1]) : null;
  };
  b.finance = {
    available: yes(f.financeAvailable) && f.financeType !== "none",
    type: (f.financeType as Bed["finance"]["type"]) ?? null,
    provider: f.financeProvider ?? null,
    apr: n(f.financeApr),
    maxMonths: n(f.financeMaxMonths),
    minSpend: n(f.financeMinSpend),
    tiers: Array.isArray(f.financeTiers)
      ? f.financeTiers
          .map((t) => ({ minSpend: Number(t.minSpend), months: Number(t.months), apr: Number(t.apr) }))
          .filter((t) => Number.isFinite(t.minSpend) && Number.isFinite(t.months))
      : [],
    deposit: f.financeDeposit ?? null,
    notes: f.financeNotes ?? null,
    url: f.financeUrl ?? null,
  };
}

async function main() {
  const csvPath = process.argv[2] ?? DEFAULT_CSV;
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  console.log(`Parsed ${rows.length} rows from ${csvPath}`);

  const beds: Bed[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let deduped = 0;

  for (const r of rows) {
    const b = toBed(r);
    if (!b) {
      skipped++;
      continue;
    }
    if (seen.has(b.id)) {
      deduped++;
      continue;
    }
    seen.add(b.id);
    beds.push(b);
  }

  const finance = loadFinance(path.join(SCRATCH, "rows", "finance.jsonl"));
  if (finance.size) {
    for (const b of beds) applyFinance(b, finance.get(b.retailer.toLowerCase()));
    const covered = new Set(beds.filter((b) => b.finance.type != null).map((b) => b.retailer));
    const missing = [...new Set(beds.map((b) => b.retailer))].filter((r) => !covered.has(r));
    console.log(`Finance: ${finance.size} retailer policies, ${covered.size} matched`);
    if (missing.length) console.log(`  no finance data for: ${missing.join(", ")}`);
  } else {
    console.log("Finance: no rows/finance.jsonl found — finance fields left empty");
  }

  for (const b of beds) await saveBed(prisma, b);

  // Drop rows that are no longer in the CSV, but never touch prefs of survivors.
  const stale = await prisma.bed.findMany({ where: { id: { notIn: [...seen] } }, select: { id: true } });
  if (stale.length) {
    await prisma.bed.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }

  const assembled = beds.filter((b) => b.arrivesAssembled === "included").length;
  const withDepth = beds.filter((b) => b.storageDepthCm != null).length;
  console.log(
    `Imported ${beds.length} beds` +
      `${skipped ? ` (${skipped} skipped: missing retailer/model/url/price)` : ""}` +
      `${deduped ? ` (${deduped} duplicate ids)` : ""}` +
      `${stale.length ? ` (${stale.length} stale removed)` : ""}`,
  );
  console.log(`  ${assembled} arrive assembled · ${withDepth} have a published storage depth`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
