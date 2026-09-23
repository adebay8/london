// Import the sofa bed research CSVs into the `sofa_beds` collection.
// Idempotent — re-running upserts by id and leaves want/reject prefs intact.
//
//   npx tsx scripts/sofabeds-import.ts [dir-or-file]
//
// Default: every .csv under docs/sofa-bed-search/.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { saveSofaBed } from "../lib/sofabeds/store";
import {
  BUDGET_CAP_GBP,
  NO_FINANCE,
  type ChaiseSide,
  type Condition,
  type Filling,
  type LegRest,
  type MattressType,
  type Mechanism,
  type SofaBed,
} from "../lib/sofabeds/types";

const prisma = new PrismaClient();
const DEFAULT_DIR = path.join(process.cwd(), "docs", "sofa-bed-search");

const PROMOTED = new Set([
  "retailer", "brand", "model", "product_url", "image_url", "colourway_shown",
  "price_gbp", "rrp_gbp", "delivery_cost_gbp", "landed_cost_gbp", "over_budget",
  "condition", "one_off", "in_stock", "seats", "seat_cushions",
  "mechanism", "separate_mattress", "bed_width_cm", "bed_length_cm",
  "mattress_type", "mattress_thickness_cm", "bedding_storage",
  "leg_rest", "chaise_side", "modular",
  "overall_width_cm", "overall_depth_cm", "overall_height_cm", "extended_depth_cm",
  "seat_depth_cm", "seat_height_cm",
  "arm_style", "fabric", "easy_clean", "removable_covers", "seat_filling", "frame_material",
  "warranty", "returns_window", "delivery_lead_time", "review_score", "review_count", "notes",
]);

/** Minimal RFC4180 parser — research CSVs carry quoted fields with commas. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const header = (rows.shift() ?? []).map((h) => h.replace(/^﻿/, "").trim());
  return rows
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const str = (v: string | undefined): string | null => {
  const s = (v ?? "").trim();
  return s === "" || /^(n\/a|na|unknown|-|none|null|tbc)$/i.test(s) ? null : s;
};

function num(v: string | undefined): number | null {
  const s = str(v);
  if (s == null) return null;
  const m = /(-?\d+(?:\.\d+)?)/.exec(s.replace(/,/g, ""));
  return m ? Number(m[1]) : null;
}

const yes = (v: string | undefined): boolean | null => {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "") return null;
  return /^(y|yes|true|1)$/.test(s);
};

const isIncluded = (v: string | undefined) => /^(included|incl|inc|free|0)$/i.test((v ?? "").trim());

function pick<T extends string>(allowed: readonly T[], v: string | undefined): T | null {
  const s = (v ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  return (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

const CONDITIONS = ["new", "ex-display", "clearance", "second-hand"] as const;
const MECHANISMS = ["fold-out", "pull-out", "click-clack", "futon"] as const;
const LEG_RESTS = ["chaise", "storage-chaise", "footstool", "both", "none"] as const;
const SIDES = ["left", "right", "reversible"] as const;
const MATTRESS_TYPES = ["pocket-sprung", "sprung", "memory", "foam", "fibre"] as const;
const FILLINGS = ["feather", "feather-blend", "foam", "fibre", "mixed"] as const;

function makeId(retailer: string, model: string): string {
  return `${retailer}-${model}`
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110);
}

export function toSofaBed(r: Record<string, string>): SofaBed | null {
  const retailer = str(r.retailer);
  const model = str(r.model);
  const url = str(r.product_url);
  const price = num(r.price_gbp);
  if (!retailer || !model || !url || price == null) return null;

  const deliveryIncluded = isIncluded(r.delivery_cost_gbp);
  const delivery = deliveryIncluded ? null : num(r.delivery_cost_gbp);
  // When the retailer publishes no delivery charge (IKEA's is postcode-
  // dependent), `delivery ?? 0` makes this a FLOOR, not the price you pay.
  // The arithmetic stays as-is deliberately: the stored row still carries the
  // detector (deliveryIncluded === false && deliveryCostGbp == null), so the
  // app derives the caveat rather than pushing `number | null` through the
  // model, both store directions, the price sort and the `value` criterion.
  // See deliveryUnknown()/budgetVerdict() in lib/sofabeds/fit.ts — every
  // consumer that displays or counts this figure must go through them.
  const landed = num(r.landed_cost_gbp) ?? price + (delivery ?? 0);

  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    if (!PROMOTED.has(k) && str(v) != null) extra[k] = v;
  }

  return {
    id: makeId(retailer, model),
    retailer,
    brand: str(r.brand) ?? retailer,
    model,
    productUrl: url,
    imageUrl: str(r.image_url),
    colourwayShown: str(r.colourway_shown),

    priceGbp: price,
    rrpGbp: num(r.rrp_gbp),
    deliveryCostGbp: delivery,
    deliveryIncluded,
    landedCostGbp: landed,
    overBudget: landed > BUDGET_CAP_GBP,

    condition: (pick(CONDITIONS, r.condition) ?? "new") as Condition,
    inStock: yes(r.in_stock),
    oneOff: yes(r.one_off) ?? false,

    seats: num(r.seats),
    seatCushions: num(r.seat_cushions),

    mechanism: pick(MECHANISMS, r.mechanism) as Mechanism | null,
    // yes() already returns null for an empty cell — which is what an
    // unpublished mechanism must be. Never coerce it to false.
    separateMattress: yes(r.separate_mattress),

    bedWidthCm: num(r.bed_width_cm),
    bedLengthCm: num(r.bed_length_cm),
    mattressType: pick(MATTRESS_TYPES, r.mattress_type) as MattressType | null,
    mattressThicknessCm: num(r.mattress_thickness_cm),
    beddingStorage: yes(r.bedding_storage),

    legRest: pick(LEG_RESTS, r.leg_rest) as LegRest | null,
    chaiseSide: pick(SIDES, r.chaise_side) as ChaiseSide | null,
    modular: yes(r.modular),

    overallWidthCm: num(r.overall_width_cm),
    overallDepthCm: num(r.overall_depth_cm),
    overallHeightCm: num(r.overall_height_cm),
    extendedDepthCm: num(r.extended_depth_cm),
    seatDepthCm: num(r.seat_depth_cm),
    seatHeightCm: num(r.seat_height_cm),

    armStyle: str(r.arm_style),
    fabric: str(r.fabric),
    easyClean: yes(r.easy_clean),
    removableCovers: yes(r.removable_covers),
    seatFilling: pick(FILLINGS, r.seat_filling) as Filling | null,
    frameMaterial: str(r.frame_material),

    warranty: str(r.warranty),
    returnsWindow: str(r.returns_window),
    deliveryLeadTime: str(r.delivery_lead_time),
    reviewScore: num(r.review_score),
    reviewCount: num(r.review_count),

    finance: { ...NO_FINANCE },

    notes: str(r.notes),
    extra,
    pref: null,
  };
}

async function main() {
  const target = process.argv[2] ?? DEFAULT_DIR;
  const files = fs.existsSync(target) && fs.statSync(target).isDirectory()
    ? fs.readdirSync(target).filter((f) => f.endsWith(".csv")).map((f) => path.join(target, f))
    : [target];

  if (!files.length) {
    console.error(`No CSVs found at ${target}`);
    process.exit(1);
  }

  const sofaBeds: SofaBed[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let deduped = 0;

  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.warn(`  missing: ${file}`);
      continue;
    }
    const rows = parseCsv(fs.readFileSync(file, "utf8"));
    let added = 0;
    for (const r of rows) {
      const s = toSofaBed(r);
      if (!s) { skipped++; continue; }
      if (seen.has(s.id)) { deduped++; continue; }
      seen.add(s.id);
      sofaBeds.push(s);
      added++;
    }
    console.log(`  ${path.basename(file)}: ${rows.length} rows, ${added} kept`);
  }

  for (const s of sofaBeds) await saveSofaBed(prisma, s);

  const stale = await prisma.sofaBed.findMany({ where: { id: { notIn: [...seen] } }, select: { id: true } });
  if (stale.length) await prisma.sofaBed.deleteMany({ where: { id: { in: stale.map((x) => x.id) } } });

  const withDepth = sofaBeds.filter((s) => s.overallDepthCm != null).length;
  const withSeatDepth = sofaBeds.filter((s) => s.seatDepthCm != null).length;
  const deep = sofaBeds.filter((s) => (s.overallDepthCm ?? 0) >= 100).length;
  console.log(
    `Imported ${sofaBeds.length} sofa beds` +
      `${skipped ? ` (${skipped} skipped: missing retailer/model/url/price)` : ""}` +
      `${deduped ? ` (${deduped} duplicate ids)` : ""}` +
      `${stale.length ? ` (${stale.length} stale removed)` : ""}`,
  );
  console.log(`  ${withDepth} have a published depth · ${deep} are 100cm+ deep · ${withSeatDepth} publish seat depth`);
}

if (require.main === module) {
  main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
