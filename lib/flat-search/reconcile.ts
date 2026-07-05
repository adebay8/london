// Pure reconciliation core for the flat-search. Given the current listings, the
// area roster, the budget, and a run's per-area agent results, it returns the new
// listing set plus a change log. No DB access — the sync script loads/saves; tests
// exercise this directly. Mirrors the skill's step-5 reconcile rules.
import { budgetTier } from "./view-logic";
import type { Area, Budget, Listing, Scheme, Source } from "./types";

export interface ReconfirmResult {
  id: string;
  verdict: "live" | "removed" | "let-agreed" | "blocked";
  newPrice?: number;
  note?: string;
}

export interface CandidateResult {
  building: string;
  street?: string | null;
  price: number;
  furnished?: boolean;
  scheme?: Scheme;
  operator?: string | null;
  schemeConfidence?: string;
  schemeSource?: string | null;
  available?: string | null;
  availableNow?: boolean;
  availableDate?: string | null;
  listedDate?: string | null;
  epc?: string | null;
  sizeSqft?: number | null;
  reduced?: boolean;
  note?: string;
  sources?: Source[];
  imageUrl?: string | null;
}

export interface AreaResult {
  area: string;
  reconfirm?: ReconfirmResult[];
  candidates?: CandidateResult[];
}

export interface ReconcileInput {
  listings: Listing[];
  areas: Area[];
  budget: Budget;
  today: string; // ISO date
  results: AreaResult[];
}

export interface ReconcileOutput {
  listings: Listing[];
  log: string[];
}

export function kebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function listingId(areaId: string, building: string, price: number): string {
  return `${areaId}-${kebab(building)}-${price}`;
}

export function reconcile({ listings, areas, budget, today, results }: ReconcileInput): ReconcileOutput {
  // deep clone so the function is side-effect free
  const store: Listing[] = JSON.parse(JSON.stringify(listings));
  const byId = new Map(store.map((l) => [l.id, l]));
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const log: string[] = [];

  // default: nothing is new this run
  for (const l of store) l.isNew = false;

  for (const r of results) {
    const area = areaById.get(r.area);

    // --- reconfirm ---
    for (const rc of r.reconfirm ?? []) {
      const l = byId.get(rc.id);
      if (!l) {
        log.push(`WARN reconfirm unknown id ${rc.id}`);
        continue;
      }
      if (rc.verdict === "live") {
        l.status = "active";
        l.lastSeen = today;
        l.lastConfirmed = today;
        l.unconfirmed = false;
        l.goneReason = null;
        if (rc.newPrice && rc.newPrice !== l.price) {
          log.push(`PRICE ${rc.id}: ${l.price} -> ${rc.newPrice}`);
          l.price = rc.newPrice;
          l.budgetTier = budgetTier(rc.newPrice, budget, l.scheme);
        }
        if (rc.note) l.note = rc.note;
      } else if (rc.verdict === "removed") {
        l.status = "gone";
        l.goneReason = "removed";
        l.lastConfirmed = today;
        l.unconfirmed = false;
        if (rc.note) l.note = rc.note;
        log.push(`GONE-removed ${rc.id}`);
      } else if (rc.verdict === "let-agreed") {
        l.status = "gone";
        l.goneReason = "let-agreed";
        l.lastConfirmed = today;
        l.unconfirmed = false;
        if (rc.note) l.note = rc.note;
        log.push(`GONE-let ${rc.id}`);
      } else {
        // blocked / ambiguous → keep active, mark unconfirmed, leave lastSeen unchanged
        l.status = "active";
        l.unconfirmed = true;
        if (rc.note) l.note = rc.note;
        log.push(`UNCONFIRMED ${rc.id}`);
      }
    }

    // --- candidates ---
    for (const c of r.candidates ?? []) {
      if (!c.building || !c.price) {
        log.push(`WARN bad candidate ${JSON.stringify(c).slice(0, 80)}`);
        continue;
      }
      const scheme: Scheme = c.scheme ?? "unknown";
      const id = listingId(r.area, c.building, c.price);
      const phaseYear = area?.phaseYears?.[c.building] ?? null;
      const existing = byId.get(id);

      if (existing) {
        // same flat re-seen (or a revival of a gone one) → confirm live, merge sources
        existing.status = "active";
        existing.lastSeen = today;
        existing.lastConfirmed = today;
        existing.unconfirmed = false;
        existing.goneReason = null;
        const seen = new Set(existing.sources.map((s) => s.url));
        for (const s of c.sources ?? []) {
          if (!seen.has(s.url)) {
            existing.sources.push(s);
            seen.add(s.url);
          }
        }
        if (c.availableDate !== undefined) existing.availableDate = c.availableDate;
        if (c.availableNow !== undefined) existing.availableNow = !!c.availableNow;
        if (c.available !== undefined) existing.available = c.available;
        if (c.listedDate) existing.listedDate = c.listedDate;
        if (c.imageUrl && !existing.imageUrl) existing.imageUrl = c.imageUrl;
        if (c.note) existing.note = c.note;
        log.push(`UPDATE existing ${id}`);
        continue;
      }

      const listing: Listing = {
        id,
        areaId: r.area,
        building: c.building,
        street: c.street ?? null,
        phaseYear,
        phaseLabel: phaseYear ? `Completed ~${phaseYear}` : null,
        price: c.price,
        budgetTier: budgetTier(c.price, budget, scheme),
        furnished: c.furnished !== false,
        available: c.available ?? null,
        availableNow: !!c.availableNow,
        availableDate: c.availableDate ?? null,
        listedDate: c.listedDate ?? today,
        epc: c.epc ?? null,
        sizeSqft: c.sizeSqft ?? null,
        scheme,
        operator: c.operator ?? null,
        schemeConfidence: c.schemeConfidence ?? "unverified",
        schemeSource: c.schemeSource ?? "live-listing",
        firstSeen: today,
        lastSeen: today,
        lastConfirmed: today,
        status: "active",
        goneReason: null,
        unconfirmed: false,
        isNew: true,
        imageUrl: c.imageUrl ?? null,
        note: c.note ?? null,
        sources: c.sources ?? [],
      };
      store.push(listing);
      byId.set(id, listing);
      log.push(`NEW ${id} (${scheme}, £${c.price}, tier=${listing.budgetTier})`);
    }
  }

  return { listings: store, log };
}
