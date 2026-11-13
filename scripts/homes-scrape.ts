// Scrape a buying research pass from the portals that allow a plain fetch.
//
//   npx tsx scripts/homes-scrape.ts [--towns woking,reading] [--sources rightmove,onthemarket]
//                                   [--no-details] [--no-recheck] [--today YYYY-MM-DD]
//
// For every town in docs/home-buying/towns.json it searches around the
// station (BRIEF: 2–3 beds, £200k–£500k, 1 mile), reads each new Rightmove
// listing page for tenure, lease, service charge, council tax, garden and
// parking, and writes docs/home-buying/<date>-scrape.csv in the same format
// as a hand-researched pass. Then run scripts/homes-import.ts to load it.
//
// It also re-checks listings already in the store that this pass didn't see
// (sold, withdrawn, or just missed) and records definite answers only.
//
// Zoopla and PrimeLocation block scripted requests; the home-buying-search
// skill covers them through the browser. Requests are sequential with a
// pause between them, so a full pass takes a while: run it in the background.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { STATIONS } from "../lib/homes/stations";
import { setListingStatus } from "../lib/homes/store";
import { BRIEF, type ListingStatus } from "../lib/homes/types";

const DIR = path.join(process.cwd(), "docs", "home-buying");
const TOWNS_FILE = path.join(DIR, "towns.json");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const PAUSE_MS = 900;

const HEADER = [
  "town", "listing_url", "source", "agent", "price_gbp", "price_qualifier", "address", "property_type", "new_build",
  "tenure", "lease_years_remaining", "service_charge_pa", "ground_rent_pa", "beds", "baths", "floor_area", "council_tax",
  "epc", "date_listed_or_changed", "distance_to_station", "key_features", "photo_1", "photo_2", "photo_3", "checked",
  "garden", "parking", "lat", "lng",
] as const;
type Row = Partial<Record<(typeof HEADER)[number], string>>;

interface TownFile {
  id: string;
  town: string;
  station: string;
  searched?: string;
  rightmoveStationId?: string;
  onthemarketSlug?: string;
  [k: string]: unknown;
}

// ---------- small helpers ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastRequest = 0;

/** One polite GET. Returns null on a block or network error, so callers can
 *  tell "couldn't check" apart from "checked and it's gone" (status 404/410). */
async function get(url: string): Promise<{ status: number; body: string } | null> {
  const wait = lastRequest + PAUSE_MS + Math.random() * 400 - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-GB,en;q=0.9" }, redirect: "follow" });
    return { status: res.status, body: await res.text() };
  } catch {
    return null;
  }
}

const ukDate = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const miles = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const searchName = (station: string) => station.replace(/\s*\(.*\)/, "").trim();
const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const csvCell = (v: string | undefined) => {
  const s = v ?? "n/c";
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const nextData = (html: string): unknown => {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  return m ? JSON.parse(m[1]) : null;
};

/** Words that mean a listing isn't a normal open-market sale. */
const EXCLUDE = /shared ownership|retirement|over 55s?|over-55|park home|auction|cash buyers only|houseboat|plot\b|land for sale/i;

// ---------- Rightmove ----------

/** Rightmove's station id. Its names don't always match the railway's
 *  ("St Albans City" is "St. Albans Station"), so fall back to the town name
 *  and pick the station whose name shares the town's words. */
async function rightmoveStationId(name: string, town: string): Promise<string | null> {
  const norm = (s: string) => s.toLowerCase().replace(/\bst\.?\s/g, "st ").replace(/[^a-z ]/g, "").trim();
  for (const q of [`${name} station`, name, town]) {
    const r = await get(`https://los.rightmove.co.uk/typeahead?query=${encodeURIComponent(q)}&limit=10&exclude=STREET`);
    if (!r || r.status !== 200) continue;
    const stations = ((JSON.parse(r.body).matches ?? []) as { id: string; type: string; displayName: string }[]).filter((m) => m.type === "STATION");
    const exact = stations.find((m) => norm(m.displayName) === norm(`${name} station`));
    const townWords = norm(town).split(" ");
    const near = stations.find((m) => townWords.every((w) => norm(m.displayName).includes(w)));
    const hit = exact ?? near;
    if (hit) return hit.id;
  }
  return null;
}

interface RmResult {
  id: number;
  bedrooms: number;
  bathrooms: number | null;
  displayAddress: string;
  location: { latitude: number; longitude: number };
  propertySubType: string;
  displayStatus: string;
  distance: number;
  displaySize: string;
  development: boolean;
  auction: boolean;
  summary: string;
  keyFeatures?: { description: string }[];
  tenure?: { tenureType: string } | null;
  price: { amount: number; displayPrices: { displayPriceQualifier: string }[] };
  listingUpdate?: { listingUpdateReason: string; listingUpdateDate: string };
  firstVisibleDate?: string;
  customer: { branchDisplayName: string };
  images: { srcUrl: string }[];
}

async function rightmoveSearch(stationId: string): Promise<RmResult[] | null> {
  const out: RmResult[] = [];
  for (let index = 0; index < 1000; index += 24) {
    const url =
      `https://www.rightmove.co.uk/property-for-sale/find.html?locationIdentifier=STATION%5E${stationId}` +
      `&radius=${BRIEF.searchRadiusMiles}&minBedrooms=${BRIEF.minBeds}&maxBedrooms=${BRIEF.maxBeds}` +
      `&minPrice=${BRIEF.minPriceGbp}&maxPrice=${BRIEF.maxPriceGbp}&dontShow=sharedOwnership%2Cretirement&index=${index}`;
    const r = await get(url);
    if (!r || r.status !== 200) return out.length ? out : null;
    const d = nextData(r.body) as { props?: { pageProps?: { searchResults?: { properties: RmResult[]; pagination: { next?: string } } } } } | null;
    const sr = d?.props?.pageProps?.searchResults;
    if (!sr) return out.length ? out : null;
    out.push(...sr.properties);
    if (!sr.pagination?.next) break;
  }
  // Featured listings repeat across pages.
  return [...new Map(out.map((p) => [p.id, p])).values()];
}

/** Rightmove's listing page keeps its data in window.__PAGE_MODEL, flattened:
 *  one array of values where objects and arrays hold indexes into it. */
function decodePageModel(html: string): Record<string, unknown> | null {
  const marker = "window.__PAGE_MODEL = ";
  const i = html.indexOf(marker);
  if (i < 0) return null;
  // Other statements follow in the same <script>, so take one balanced JSON object.
  const start = html.indexOf("{", i + marker.length);
  let depth = 0;
  let end = -1;
  let inStr = false;
  for (let j = start; j < html.length; j++) {
    const ch = html[j];
    if (inStr) {
      if (ch === "\\") j++;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      end = j + 1;
      break;
    }
  }
  if (end < 0) return null;
  let text = html.slice(start, end);
  try {
    let model = JSON.parse(text) as { data?: string; encoding?: string } & Record<string, unknown>;
    if (typeof model.data === "string") {
      const arr = JSON.parse(model.data) as unknown[];
      const memo = new Map<number, unknown>();
      const r = (ix: number): unknown => {
        if (memo.has(ix)) return memo.get(ix);
        const v = arr[ix];
        if (Array.isArray(v)) {
          const out: unknown[] = [];
          memo.set(ix, out);
          for (const x of v) out.push(typeof x === "number" && x >= 0 ? r(x) : x);
          return out;
        }
        if (v && typeof v === "object") {
          const out: Record<string, unknown> = {};
          memo.set(ix, out);
          for (const [k, x] of Object.entries(v)) out[k] = typeof x === "number" && x >= 0 ? r(x) : x;
          return out;
        }
        return v;
      };
      model = r(0) as typeof model;
    }
    text = "";
    return (model.propertyData as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

interface RmDetail {
  tenure: string | null;
  leaseYears: number | null;
  serviceCharge: number | null;
  groundRent: number | null;
  councilTax: string | null;
  garden: boolean | null;
  parking: string | null;
  sqft: number | null;
  keyFeatures: string[];
  sharedOwnership: boolean;
  gone: boolean;
  tags: string[];
}

function readDetail(pd: Record<string, unknown>): RmDetail {
  const tenure = (pd.tenure ?? {}) as { tenureType?: string; yearsRemainingOnLease?: number | null };
  const costs = (pd.livingCosts ?? {}) as { annualServiceCharge?: number | null; annualGroundRent?: number | null; councilTaxBand?: string | null };
  const features = (pd.features ?? {}) as { garden?: { displayText: string }[]; parking?: { displayText: string }[] };
  const sizings = (pd.sizings ?? []) as { unit: string; maximumSize: number }[];
  const keyFeatures = ((pd.keyFeatures ?? []) as string[]).filter((x) => typeof x === "string");
  const status = (pd.status ?? {}) as { published?: boolean; archived?: boolean };
  const tags = ((pd.tags ?? []) as unknown[]).map(String);
  const gardenText = features.garden?.map((g) => g.displayText).join(", ") ?? "";
  const kf = keyFeatures.join(" ").toLowerCase();
  const garden = gardenText ? !/no garden/i.test(gardenText) : /garden/.test(kf) && !/no garden|communal garden/.test(kf) ? true : null;
  const sq = sizings.find((s) => s.unit === "sqft");
  return {
    tenure: tenure.tenureType ? tenure.tenureType.toLowerCase().replace(/_/g, " ") : null,
    leaseYears: tenure.yearsRemainingOnLease ?? null,
    serviceCharge: costs.annualServiceCharge ?? null,
    groundRent: costs.annualGroundRent ?? null,
    councilTax: costs.councilTaxBand ? `Band ${costs.councilTaxBand}` : null,
    garden,
    parking: features.parking?.map((p) => p.displayText).join(", ") || null,
    sqft: sq ? Math.round(sq.maximumSize) : null,
    keyFeatures,
    sharedOwnership: Boolean((pd.sharedOwnership as { sharedOwnershipFlag?: boolean } | undefined)?.sharedOwnershipFlag),
    gone: status.archived === true || status.published === false,
    tags,
  };
}

async function rightmoveDetail(id: string | number): Promise<{ detail: RmDetail | null; removed: boolean }> {
  const r = await get(`https://www.rightmove.co.uk/properties/${id}`);
  if (!r) return { detail: null, removed: false };
  if (r.status === 404 || r.status === 410) return { detail: null, removed: true };
  const pd = r.status === 200 ? decodePageModel(r.body) : null;
  return { detail: pd ? readDetail(pd) : null, removed: false };
}

function rightmoveRow(town: TownFile, p: RmResult, d: RmDetail | null, today: string): Row | null {
  if (p.auction) return null;
  const text = `${p.summary} ${p.propertySubType} ${(p.keyFeatures ?? []).map((k) => k.description).join(" ")} ${(d?.keyFeatures ?? []).join(" ")}`;
  if (EXCLUDE.test(text) || d?.sharedOwnership) return null;
  const qualifier = [p.price.displayPrices?.[0]?.displayPriceQualifier, p.displayStatus].filter(Boolean).join("; ");
  const upd = p.listingUpdate;
  const listed = upd?.listingUpdateDate
    ? `${upd.listingUpdateReason === "price_reduced" ? "Reduced" : "Added"} ${ukDate(upd.listingUpdateDate)}`
    : p.firstVisibleDate
      ? `Added ${ukDate(p.firstVisibleDate)}`
      : undefined;
  const features = d?.keyFeatures.length ? d.keyFeatures : (p.keyFeatures ?? []).map((k) => k.description);
  const sqft = d?.sqft ?? (/([\d,]+)\s*sq\.?\s*ft/i.exec(p.displaySize ?? "")?.[1]?.replace(/,/g, "") ?? null);
  const photos = p.images.map((i) => i.srcUrl).slice(0, 3);
  return {
    town: town.town,
    listing_url: `https://www.rightmove.co.uk/properties/${p.id}`,
    source: "Rightmove",
    agent: p.customer?.branchDisplayName,
    price_gbp: String(p.price.amount),
    price_qualifier: qualifier || undefined,
    address: p.displayAddress,
    property_type: p.propertySubType,
    new_build: p.development ? "yes" : "no",
    tenure: d?.tenure ?? p.tenure?.tenureType?.toLowerCase().replace(/_/g, " "),
    lease_years_remaining: d?.leaseYears != null ? String(d.leaseYears) : undefined,
    service_charge_pa: d?.serviceCharge != null ? String(d.serviceCharge) : undefined,
    ground_rent_pa: d?.groundRent != null ? String(d.groundRent) : undefined,
    beds: String(p.bedrooms),
    baths: p.bathrooms != null ? String(p.bathrooms) : undefined,
    floor_area: sqft ? `${sqft} sq ft` : undefined,
    council_tax: d?.councilTax ?? undefined,
    date_listed_or_changed: listed,
    distance_to_station: `${p.distance.toFixed(2)} mi (Rightmove)`,
    key_features: features.join("; ").replace(/\s+/g, " ") || undefined,
    photo_1: photos[0],
    photo_2: photos[1],
    photo_3: photos[2],
    checked: ukDate(today),
    garden: d?.garden == null ? undefined : d.garden ? "yes" : "no",
    parking: d?.parking ?? undefined,
    lat: String(p.location.latitude),
    lng: String(p.location.longitude),
  };
}

// ---------- OnTheMarket ----------

interface OtmResult {
  id: string;
  address: string;
  "humanised-property-type": string;
  "property-title": string;
  "price-qualifier": string | null;
  price: string;
  bedrooms: number;
  bathrooms: number | null;
  agent?: { name: string };
  features?: string[];
  "days-since-added-reduced"?: string;
  location?: { lat: number; lon: number };
  "cover-image"?: { default: string };
  images?: { default: string }[];
}

async function otmPage(slugName: string, page: number) {
  const url =
    `https://www.onthemarket.com/for-sale/property/${slugName}/?min-bedrooms=${BRIEF.minBeds}&max-bedrooms=${BRIEF.maxBeds}` +
    `&min-price=${BRIEF.minPriceGbp}&max-price=${BRIEF.maxPriceGbp}&radius=${BRIEF.searchRadiusMiles.toFixed(1)}` +
    `&shared-ownership=false&retirement=false${page > 1 ? `&page=${page}` : ""}`;
  const r = await get(url);
  if (!r || r.status !== 200) return null;
  const d = nextData(r.body) as { props?: { pageProps?: { initialReduxState?: { results?: { list: OtmResult[]; totalResults: number } } } } } | null;
  return d?.props?.pageProps?.initialReduxState?.results ?? null;
}

/** Find OnTheMarket's slug for a station: try the obvious names and keep the
 *  one whose results actually sit near the station. */
async function otmSlug(town: TownFile, lat: number, lng: number): Promise<string | null> {
  const name = searchName(town.station);
  for (const candidate of [...new Set([`${slug(name)}-station`, `${slug(town.town)}-station`, slug(name)])]) {
    // A town-wide page (no station page exists) is fine: results are filtered
    // by distance afterwards. It just has to contain homes near the station.
    const res = await otmPage(candidate, 1);
    const near = res?.list.some((x) => x.location && miles(lat, lng, x.location.lat, x.location.lon) <= BRIEF.searchRadiusMiles + 0.5);
    if (near) return candidate;
  }
  return null;
}

async function onthemarketSearch(slugName: string, lat: number, lng: number): Promise<{ r: OtmResult; dist: number }[] | null> {
  const out: { r: OtmResult; dist: number }[] = [];
  for (let page = 1; page < 40; page++) {
    const res = await otmPage(slugName, page);
    if (!res) return out.length ? out : null;
    for (const r of res.list) {
      if (!r.location) continue;
      const dist = miles(lat, lng, r.location.lat, r.location.lon);
      if (dist <= BRIEF.searchRadiusMiles) out.push({ r, dist });
    }
    if (!res.list.length || page * 30 >= res.totalResults) break;
  }
  return [...new Map(out.map((x) => [x.r.id, x])).values()];
}

function otmRow(town: TownFile, { r, dist }: { r: OtmResult; dist: number }, today: string): Row | null {
  const price = Number((r.price ?? "").replace(/[^\d]/g, ""));
  if (!price || price < BRIEF.minPriceGbp || price > BRIEF.maxPriceGbp) return null;
  if (r.bedrooms < BRIEF.minBeds || r.bedrooms > BRIEF.maxBeds) return null;
  const feats = r.features ?? [];
  if (EXCLUDE.test(`${r["property-title"]} ${r["humanised-property-type"]} ${feats.join(" ")}`)) return null;
  const kf = feats.join(" ").toLowerCase();
  const added = r["days-since-added-reduced"] ?? "";
  return {
    town: town.town,
    listing_url: `https://www.onthemarket.com/details/${r.id}/`,
    source: "OnTheMarket",
    agent: r.agent?.name,
    price_gbp: String(price),
    price_qualifier: r["price-qualifier"] ?? undefined,
    address: r.address,
    property_type: r["humanised-property-type"],
    new_build: /new build|new home|brand new/i.test(`${r["property-title"]} ${kf}`) ? "yes" : "no",
    tenure: /share of freehold/.test(kf) ? "share of freehold" : /\bfreehold\b/.test(kf) ? "freehold" : /leasehold/.test(kf) ? "leasehold" : undefined,
    beds: String(r.bedrooms),
    baths: r.bathrooms != null ? String(r.bathrooms) : undefined,
    // OnTheMarket only gives "Added > 14 days"; keep it as a note, not a date.
    date_listed_or_changed: added ? `${added} (OnTheMarket)` : undefined,
    distance_to_station: `${dist.toFixed(2)} mi (straight line from map pin)`,
    key_features: feats.join("; ") || undefined,
    photo_1: r["cover-image"]?.default,
    checked: ukDate(today),
    garden: /garden/.test(kf) && !/communal garden|no garden/.test(kf) ? "yes" : undefined,
    parking: /parking|garage|driveway/.test(kf) ? feats.find((f) => /parking|garage|driveway/i.test(f)) : undefined,
    lat: r.location ? String(r.location.lat) : undefined,
    lng: r.location ? String(r.location.lon) : undefined,
  };
}

// ---------- main ----------

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? "") : null;
}

async function main() {
  const today = arg("today") ?? new Date().toISOString().slice(0, 10);
  const onlyTowns = arg("towns")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
  const sources = new Set((arg("sources") ?? "rightmove,onthemarket").split(","));
  const withDetails = !process.argv.includes("--no-details");
  const recheck = !process.argv.includes("--no-recheck");

  const towns: TownFile[] = JSON.parse(fs.readFileSync(TOWNS_FILE, "utf8"));
  const targets = towns.filter((t) => !onlyTowns || onlyTowns.includes(t.id));
  const prisma = new PrismaClient();

  // Listings whose detail page we already read: don't fetch them again.
  const known = new Map(
    (await prisma.homeListing.findMany({ select: { id: true, townId: true, status: true, tenure: true, councilTax: true, raw: true } })).map((l) => [l.id, l]),
  );

  const rows: Row[] = [];
  const seen = new Set<string>();
  const report: string[] = [];

  for (const town of targets) {
    const st = STATIONS[town.id];
    const name = searchName(town.station);
    const found: Record<string, number> = {};
    const notes: string[] = [];

    if (sources.has("rightmove")) {
      town.rightmoveStationId ||= (await rightmoveStationId(name, town.town)) ?? undefined;
      if (!town.rightmoveStationId) notes.push("Rightmove station id not found");
      else {
        const results = await rightmoveSearch(town.rightmoveStationId);
        if (!results) notes.push("Rightmove search blocked or failed");
        let n = 0;
        for (const p of results ?? []) {
          const id = `rightmove-${p.id}`;
          const prior = known.get(id);
          const needDetail = withDetails && !(prior && prior.councilTax != null);
          const d = needDetail ? (await rightmoveDetail(p.id)).detail : null;
          const row = rightmoveRow(town, p, d, today);
          if (!row) continue;
          // Keep what an earlier pass read from the detail page.
          if (!d && prior) {
            const raw = JSON.parse(prior.raw || "{}") as Record<string, string>;
            if (raw.garden) row.garden = raw.garden;
          }
          rows.push(row);
          seen.add(id);
          n++;
        }
        found.Rightmove = n;
      }
    }

    if (sources.has("onthemarket") && st) {
      town.onthemarketSlug ||= (await otmSlug(town, st.lat, st.lng)) ?? undefined;
      if (!town.onthemarketSlug) notes.push("OnTheMarket station page not found");
      else {
        const results = await onthemarketSearch(town.onthemarketSlug, st.lat, st.lng);
        if (!results) notes.push("OnTheMarket search blocked or failed");
        let n = 0;
        for (const x of results ?? []) {
          const row = otmRow(town, x, today);
          if (!row) continue;
          rows.push(row);
          seen.add(`onthemarket-${x.r.id}`);
          n++;
        }
        found.OnTheMarket = n;
      }
    }

    const parts = Object.entries(found).map(([k, v]) => `${k} ${v}`);
    town.searched =
      `Scraped ${ukDate(today)}: ${parts.join(", ") || "nothing"} within ${BRIEF.searchRadiusMiles} mi of ${name}, ` +
      `${BRIEF.minBeds}–${BRIEF.maxBeds} bed, £${BRIEF.minPriceGbp / 1000}k–£${BRIEF.maxPriceGbp / 1000}k` +
      `${notes.length ? `. ${notes.join("; ")}` : ""}`;
    report.push(`${town.town.padEnd(14)} ${parts.join(" · ") || "—"}${notes.length ? `  (${notes.join("; ")})` : ""}`);
    console.log(report.at(-1));
  }

  // Re-check listings this pass didn't see, in the towns it covered.
  const statusChanges: string[] = [];
  if (recheck) {
    const covered = new Set(targets.map((t) => t.id));
    const missing = [...known.values()].filter(
      (l) => covered.has(l.townId) && !seen.has(l.id) && !["sold-stc", "withdrawn"].includes(l.status),
    );
    for (const l of missing) {
      let verdict: ListingStatus | null = null;
      if (l.id.startsWith("rightmove-")) {
        const { detail, removed } = await rightmoveDetail(l.id.slice("rightmove-".length));
        if (removed || detail?.gone) verdict = "withdrawn";
        else if (detail?.tags.some((t) => /SOLD/i.test(t))) verdict = "sold-stc";
        else if (detail?.tags.some((t) => /UNDER_OFFER/i.test(t))) verdict = "under-offer";
        else if (detail) verdict = "available"; // live, just outside this search
      } else if (l.id.startsWith("onthemarket-")) {
        const r = await get(`https://www.onthemarket.com/details/${l.id.slice("onthemarket-".length)}/`);
        if (r && (r.status === 404 || r.status === 410)) verdict = "withdrawn";
        else if (r?.status === 200 && /"sold-stc\?":\s*true|>Sold STC</i.test(r.body)) verdict = "sold-stc";
        else if (r?.status === 200) verdict = "available";
      }
      // Anything else (Zoopla, blocked, unclear): leave it alone.
      if (verdict && verdict !== l.status) {
        await setListingStatus(prisma, l.id, verdict, today);
        statusChanges.push(`${l.id}: ${l.status} → ${verdict}`);
      }
    }
    console.log(`Re-checked ${missing.length} listings not seen this pass; ${statusChanges.length} changed status.`);
    statusChanges.forEach((s) => console.log(`  ${s}`));
  }

  // A partial run gets its own file, so it never overwrites the full pass.
  const out = path.join(DIR, `${today}-scrape${onlyTowns ? `-${onlyTowns.join("-")}` : ""}.csv`);
  const lines = [HEADER.join(","), ...rows.map((r) => HEADER.map((h) => csvCell(r[h])).join(","))];
  fs.writeFileSync(out, lines.join("\n") + "\n");
  fs.writeFileSync(TOWNS_FILE, JSON.stringify(towns, null, 2) + "\n");
  console.log(`\nWrote ${rows.length} rows to ${path.relative(process.cwd(), out)}. Next: npx tsx scripts/homes-import.ts`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
