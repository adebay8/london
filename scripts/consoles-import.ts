// Import the TV console research CSV into the `tv_consoles` collection in
// MongoDB. The CSV is the research artefact; the DB is what /consoles reads.
// Idempotent — re-running upserts by id and leaves want/reject prefs intact.
//
//   npx tsx scripts/consoles-import.ts [path/to/tv-consoles.csv]
//
// Default path: ~/Documents/console-search/tv-consoles.csv
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "../app/generated/prisma/client";
import { saveConsole } from "../lib/consoles/store";
import { NO_FINANCE, type Assembly, type BackPanel, type Bay, type BayKind, type TvConsole } from "../lib/consoles/types";
import { BUDGET_CAP_GBP } from "../lib/consoles/types";

const prisma = new PrismaClient();

const DEFAULT_CSV = path.join(os.homedir(), "Documents", "console-search", "tv-consoles.csv");

// Research scratchpad — holds rows/finance.jsonl (retailer-level finance
// policy). Override with CONSOLES_SCRATCH if the research moves.
const SCRATCH = process.env.CONSOLES_SCRATCH ?? path.join(os.homedir(), "Documents", "console-search");

// The columns promoted to real Prisma fields. Everything else in the CSV is
// kept verbatim in `extra` and surfaced in the detail drawer.
const PROMOTED = new Set([
  "retailer", "brand", "model", "product_url", "colourway_shown", "colourways_available",
  "price_gbp", "delivery_cost_gbp", "assembly_cost_gbp", "landed_cost_gbp", "over_budget",
  "arrives_assembled", "mounting",
  "top_width_cm", "top_depth_cm", "top_load_kg",
  "overall_width_cm", "overall_depth_cm", "overall_height_cm",
  "bays_json", "back_panel", "cable_management",
  "frame_material", "finish_material", "leg_style",
  "warranty", "spare_parts_available", "returns_window", "delivery_lead_time",
  "review_score", "review_count", "image_url", "notes",
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
  return s === "" || /^(n\/a|na|unknown|-|none|null)$/i.test(s) ? null : s;
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

const BAY_KINDS: BayKind[] = ["open", "door", "glass-door", "drawer"];
const BACK_PANELS: BackPanel[] = ["open", "ported", "solid"];

/** A dimension is a number or it is unpublished. Zero and empty both mean
 *  unknown here — a literal 0 would read as a real measurement and fail the
 *  fit gate rather than registering as "not published". */
function bayDim(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** One malformed cell must not abandon the whole import — warn and treat the
 *  unit as having no recorded bays, which the fit engine reports as unknown
 *  rather than as a failure. */
function parseBaysCell(raw: string | undefined, id: string): Bay[] {
  const s = str(raw);
  if (s == null) return [];
  try {
    const v = JSON.parse(s) as unknown;
    if (!Array.isArray(v)) {
      console.warn(`  ${id}: bays_json is not an array — treated as no recorded bays`);
      return [];
    }
    return v
      .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
      .map((b): Bay => {
        const kind = String(b.kind ?? "open") as BayKind;
        const count = Number(b.count);
        return {
          kind: BAY_KINDS.includes(kind) ? kind : "open",
          count: Number.isFinite(count) && count > 0 ? Math.round(count) : 1,
          widthCm: bayDim(b.widthCm),
          heightCm: bayDim(b.heightCm),
          depthCm: bayDim(b.depthCm),
        };
      });
  } catch {
    console.warn(`  ${id}: unparseable bays_json — treated as no recorded bays`);
    return [];
  }
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

/** R8: floor-standing only. A blank is treated as floor-standing, since that
 *  is the overwhelming default for this product category and the research
 *  brief filtered at source. */
function isFloorStanding(v: string | undefined): boolean {
  const s = (v ?? "").toLowerCase().trim();
  if (s === "") return true;
  return !/wall|float|hang|mount/.test(s);
}

function toConsole(r: Record<string, string>): TvConsole | null {
  const retailer = str(r.retailer);
  const model = str(r.model);
  const url = str(r.product_url);
  const price = num(r.price_gbp);
  const landed = num(r.landed_cost_gbp);
  if (!retailer || !model || !url || price == null || landed == null) return null;

  const id = makeId(retailer, model);

  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    if (!PROMOTED.has(k) && str(v) != null) extra[k] = v;
  }

  const backRaw = (str(r.back_panel) ?? "").toLowerCase();
  const backPanel = BACK_PANELS.find((b) => backRaw.includes(b)) ?? null;

  return {
    id,
    retailer,
    brand: str(r.brand) ?? retailer,
    model,
    productUrl: url,
    colourwayShown: str(r.colourway_shown),
    colourwaysAvailable: str(r.colourways_available),

    priceGbp: price,
    deliveryCostGbp: isIncluded(r.delivery_cost_gbp) ? null : num(r.delivery_cost_gbp),
    deliveryIncluded: isIncluded(r.delivery_cost_gbp),
    assemblyCostGbp: isIncluded(r.assembly_cost_gbp) ? null : num(r.assembly_cost_gbp),
    assemblyIncluded: isIncluded(r.assembly_cost_gbp),
    landedCostGbp: landed,
    // Trust the researcher's flag when present, otherwise derive it.
    overBudget: str(r.over_budget) ? /^yes$/i.test(r.over_budget.trim()) : landed > BUDGET_CAP_GBP,

    arrivesAssembled: assemblyMode(r.arrives_assembled),
    mounting: str(r.mounting) ?? "floor",

    topWidthCm: num(r.top_width_cm),
    topDepthCm: num(r.top_depth_cm),
    topLoadKg: num(r.top_load_kg),

    overallWidthCm: num(r.overall_width_cm),
    overallDepthCm: num(r.overall_depth_cm),
    overallHeightCm: num(r.overall_height_cm),

    bays: parseBaysCell(r.bays_json, id),
    backPanel,
    cableManagement: str(r.cable_management),

    frameMaterial: str(r.frame_material),
    finishMaterial: str(r.finish_material),
    legStyle: str(r.leg_style),

    warranty: str(r.warranty),
    sparePartsAvailable: str(r.spare_parts_available),
    returnsWindow: str(r.returns_window),
    deliveryLeadTime: str(r.delivery_lead_time),
    reviewScore: num(r.review_score),
    reviewCount: num(r.review_count),
    imageUrl: str(r.image_url),

    // Filled from rows/finance.jsonl after parsing — retailer policy, not
    // per-product.
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
 *  and stamped onto every one of that retailer's consoles. */
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

function applyFinance(c: TvConsole, f: FinanceRow | undefined): void {
  if (!f) return;
  const yes = (v: unknown) => v === true || /^(yes|true)$/i.test(String(v ?? ""));
  const n = (v: unknown) => {
    if (v == null || v === "") return null;
    const m = /(-?\d+(?:\.\d+)?)/.exec(String(v).replace(/,/g, ""));
    return m ? Number(m[1]) : null;
  };
  c.finance = {
    available: yes(f.financeAvailable) && f.financeType !== "none",
    type: (f.financeType as TvConsole["finance"]["type"]) ?? null,
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

  const consoles: TvConsole[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let deduped = 0;
  let wallMounted = 0;

  for (const r of rows) {
    if (!isFloorStanding(r.mounting)) {
      wallMounted++;
      continue;
    }
    const c = toConsole(r);
    if (!c) {
      skipped++;
      continue;
    }
    if (seen.has(c.id)) {
      deduped++;
      continue;
    }
    seen.add(c.id);
    consoles.push(c);
  }

  const finance = loadFinance(path.join(SCRATCH, "rows", "finance.jsonl"));
  if (finance.size) {
    for (const c of consoles) applyFinance(c, finance.get(c.retailer.toLowerCase()));
    const covered = new Set(consoles.filter((c) => c.finance.type != null).map((c) => c.retailer));
    const missing = [...new Set(consoles.map((c) => c.retailer))].filter((r) => !covered.has(r));
    console.log(`Finance: ${finance.size} retailer policies, ${covered.size} matched`);
    if (missing.length) console.log(`  no finance data for: ${missing.join(", ")}`);
  } else {
    console.log("Finance: no rows/finance.jsonl found — finance fields left empty");
  }

  for (const c of consoles) await saveConsole(prisma, c);

  // Drop rows no longer in the CSV, but never touch prefs of survivors.
  const stale = await prisma.tvConsole.findMany({ where: { id: { notIn: [...seen] } }, select: { id: true } });
  if (stale.length) {
    await prisma.tvConsole.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }

  const withTop = consoles.filter((c) => c.topDepthCm != null).length;
  const withBays = consoles.filter((c) => c.bays.some((b) => b.widthCm != null)).length;
  console.log(
    `Imported ${consoles.length} consoles` +
      `${skipped ? ` (${skipped} skipped: missing retailer/model/url/price)` : ""}` +
      `${wallMounted ? ` (${wallMounted} dropped: not floor-standing)` : ""}` +
      `${deduped ? ` (${deduped} duplicate ids)` : ""}` +
      `${stale.length ? ` (${stale.length} stale removed)` : ""}`,
  );
  console.log(`  ${withTop} have a published top depth · ${withBays} have at least one measured bay`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
