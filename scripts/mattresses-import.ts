// Import the mattress research CSVs into the `mattresses` collection in
// MongoDB. Idempotent — re-running upserts by id and leaves want/reject prefs
// intact.
//
//   npx tsx scripts/mattresses-import.ts [dir-or-file]
//
// Default: every .csv under ~/Documents/mattress-search/rows/, because the
// research is split across retailer groups and each group writes its own file.
//
// The column contract is docs/mattress-search/COLUMNS.md. The one rule worth
// repeating here: an empty cell means "the retailer does not publish this",
// and it must survive as null all the way to the scorer.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "../app/generated/prisma/client";
import { saveMattress } from "../lib/mattresses/store";
import {
  BUDGET_CAP_GBP,
  NO_FINANCE,
  type Condition,
  type Firmness,
  type Mattress,
  type MattressType,
  type RrpEvidence,
  type SpringType,
} from "../lib/mattresses/types";

const prisma = new PrismaClient();
const DEFAULT_DIR = path.join(os.homedir(), "Documents", "mattress-search", "rows");

const PROMOTED = new Set([
  "retailer", "brand", "model", "product_url", "image_url",
  "price_gbp", "rrp_gbp", "rrp_evidence", "price_floor_gbp",
  "delivery_cost_gbp", "disposal_cost_gbp", "landed_cost_gbp", "over_budget",
  "condition", "in_stock", "size", "width_cm", "length_cm", "depth_cm",
  "type", "spring_type", "spring_count", "zoned", "turn_required",
  "firmness_label", "firmness_scale", "firmness",
  "comfort_layer", "comfort_layer_depth_cm", "weight_kg",
  "slatted_base_ok", "platform_base_ok", "ottoman_ok",
  "cover_removable", "cover_washable",
  "trial_nights", "trial_free_returns", "warranty_years", "returns_window", "delivery_lead_time",
  "review_score", "review_count", "tested_by", "test_score", "notes",
]);

/** Minimal RFC4180 parser — research CSVs carry quoted fields with commas. */
function parseCsv(text: string): Record<string, string>[] {
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

const CONDITIONS = ["new", "clearance"] as const;
const TYPES = ["pocket-sprung", "hybrid", "memory-foam", "foam", "open-coil", "latex", "natural"] as const;
const SPRING_TYPES = ["pocket", "open-coil", "continuous", "none"] as const;
const FIRMNESS = ["soft", "medium-soft", "medium", "medium-firm", "firm"] as const;
const EVIDENCE = ["verified-higher", "permanent-sale", "single-observation"] as const;

function makeId(retailer: string, brand: string, model: string): string {
  return `${retailer}-${brand === retailer ? "" : brand}-${model}`
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110);
}

function toMattress(r: Record<string, string>): Mattress | null {
  const retailer = str(r.retailer);
  const model = str(r.model);
  const url = str(r.product_url);
  const price = num(r.price_gbp);
  if (!retailer || !model || !url || price == null) return null;

  const brand = str(r.brand) ?? retailer;

  const deliveryIncluded = isIncluded(r.delivery_cost_gbp);
  const delivery = deliveryIncluded ? null : num(r.delivery_cost_gbp);
  const disposal = isIncluded(r.disposal_cost_gbp) ? null : num(r.disposal_cost_gbp);
  const landed = num(r.landed_cost_gbp) ?? price + (delivery ?? 0) + (disposal ?? 0);

  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    if (!PROMOTED.has(k) && str(v) != null) extra[k] = v;
  }

  const rrp = num(r.rrp_gbp);

  return {
    id: makeId(retailer, brand, model),
    retailer,
    brand,
    model,
    productUrl: url,
    imageUrl: str(r.image_url),

    priceGbp: price,
    rrpGbp: rrp,
    deliveryCostGbp: delivery,
    deliveryIncluded,
    disposalCostGbp: disposal,
    landedCostGbp: landed,
    overBudget: str(r.over_budget) ? /^yes$/i.test(r.over_budget.trim()) : landed > BUDGET_CAP_GBP,

    condition: (pick(CONDITIONS, r.condition) ?? "new") as Condition,
    inStock:
      yes(r.in_stock) ??
      (/(sold\s*out|out of stock|no longer available|outofstock)/i.test(`${r.notes ?? ""}`) ? false : null),

    // A "was" price with no stated evidence is one observation, not a saving.
    // Defaulting it to single-observation rather than null is the honest
    // reading and keeps deal.ts from having to guess.
    rrpEvidence: (pick(EVIDENCE, r.rrp_evidence) ?? (rrp != null ? "single-observation" : null)) as RrpEvidence | null,
    priceFloorGbp: num(r.price_floor_gbp) ?? price,

    size: str(r.size),
    widthCm: num(r.width_cm),
    lengthCm: num(r.length_cm),
    depthCm: num(r.depth_cm),

    type: pick(TYPES, r.type) as MattressType | null,
    // An all-foam mattress has no springs. Saying so is a fact about the
    // product, not an inference about an unpublished spec.
    springType:
      (pick(SPRING_TYPES, r.spring_type) as SpringType | null) ??
      (/^(memory-foam|foam|latex)$/.test(str(r.type) ?? "") ? "none" : null),
    springCount: num(r.spring_count),
    zoned: yes(r.zoned),
    turnRequired: yes(r.turn_required),

    firmnessLabel: str(r.firmness_label),
    firmnessScale: str(r.firmness_scale),
    firmness: pick(FIRMNESS, r.firmness) as Firmness | null,

    comfortLayer: str(r.comfort_layer),
    comfortLayerDepthCm: num(r.comfort_layer_depth_cm),
    weightKg: num(r.weight_kg),

    slattedBaseOk: yes(r.slatted_base_ok),
    platformBaseOk: yes(r.platform_base_ok),
    ottomanOk: yes(r.ottoman_ok),

    coverRemovable: yes(r.cover_removable),
    coverWashable: yes(r.cover_washable),

    trialNights: num(r.trial_nights),
    trialFreeReturns: yes(r.trial_free_returns),
    warrantyYears: num(r.warranty_years),
    returnsWindow: str(r.returns_window),
    deliveryLeadTime: str(r.delivery_lead_time),

    reviewScore: num(r.review_score),
    reviewCount: num(r.review_count),
    testedBy: str(r.tested_by),
    testScore: num(r.test_score),

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

  const mattresses: Mattress[] = [];
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
      const m = toMattress(r);
      if (!m) { skipped++; continue; }
      if (seen.has(m.id)) { deduped++; continue; }
      // Carry forward the lowest price ever observed. This is what gives the
      // permanent-sale guard its teeth on the second and later runs: a "sale"
      // that never dips below its own floor was never a sale.
      const prev = await prisma.mattress.findUnique({ where: { id: m.id }, select: { priceFloorGbp: true } });
      if (prev?.priceFloorGbp != null) m.priceFloorGbp = Math.min(prev.priceFloorGbp, m.priceGbp);
      seen.add(m.id);
      mattresses.push(m);
      added++;
    }
    console.log(`  ${path.basename(file)}: ${rows.length} rows, ${added} kept`);
  }

  for (const m of mattresses) await saveMattress(prisma, m);

  const stale = await prisma.mattress.findMany({ where: { id: { notIn: [...seen] } }, select: { id: true } });
  if (stale.length) await prisma.mattress.deleteMany({ where: { id: { in: stale.map((x) => x.id) } } });

  const withFirmness = mattresses.filter((m) => m.firmness != null).length;
  const withWeight = mattresses.filter((m) => m.weightKg != null).length;
  const withTrial = mattresses.filter((m) => m.trialNights != null).length;
  const claims = mattresses.filter((m) => m.rrpGbp != null && m.rrpGbp > m.priceGbp);
  const verified = claims.filter((m) => m.rrpEvidence === "verified-higher").length;
  const anchored = claims.filter((m) => m.rrpEvidence === "permanent-sale").length;

  console.log(
    `Imported ${mattresses.length} mattresses` +
      `${skipped ? ` (${skipped} skipped: missing retailer/model/url/price)` : ""}` +
      `${deduped ? ` (${deduped} duplicate ids)` : ""}` +
      `${stale.length ? ` (${stale.length} stale removed)` : ""}`,
  );
  console.log(`  ${withFirmness} map to a firmness bucket · ${withWeight} publish a weight · ${withTrial} have a sleep trial`);
  console.log(`  ${claims.length} claim a discount — ${verified} verified, ${anchored} known permanent sales`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
