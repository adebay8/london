"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DepartmentTile from "@/components/home/DepartmentTile";
import ProductCard from "@/components/home/ProductCard";
import Shelf from "@/components/home/Shelf";
import type { Product } from "@/app/api/summary/route";

// The shop floor.
//
// This replaced a counter dashboard, which told you how much data existed but
// never what you were buying. A home store answers three questions in order:
// what have I chosen so far and what does it come to, which department do I
// need, and what's good in it right now. The layout follows that order.

interface Summary {
  room: {
    depts: RoomDept[];
    total: number;
    min: number;
    max: number;
    shortlisted: number;
    outstanding: string[];
  };
  departments: {
    flats: { count: number; isNew: number; gone: number; saved: number; areas: number; lastRun: string | null };
    areas: { count: number; yes: number; maybe: number; undecided: number; ranked: number; apartments: number };
    sofas: { count: number; saved: number; confirmed: number; deep: number; inBudgetFits: number };
    beds: { count: number; saved: number; assembled: number };
    mattresses: {
      count: number; saved: number; inBand: number; inBudgetFits: number;
      claimedDeals: number; verifiedDeals: number;
    };
    consoles: { count: number; saved: number; confirmed: number; inBudgetFits: number; withBay: number };
  };
  shelves: { sofas: Product[]; beds: Product[]; mattresses: Product[]; consoles: Product[]; flats: Product[] };
  journal: { total: number; recent: JournalEntry[] };
}

interface RoomDept {
  label: string;
  href: string;
  chosen: Product | null;
  items: Product[];
  alternatives: number;
  min: number;
  max: number;
}

interface JournalEntry {
  id: string;
  content: string;
  decision: string | null;
  createdAt: string;
  neighbourhood: string | null;
}

function relative(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days)) return "";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

/** The basket.
 *
 *  A home store's most useful screen is the one saying what the room costs and
 *  what it still needs. The subtlety is that saving five beds does not mean
 *  buying five beds — the shortlist is a choice, not a cart. So the headline is
 *  the best-scoring pick per department, and the shortlist's spread is shown
 *  next to it rather than added up. */
function Room({ s }: { s: Summary }) {
  const { depts, total, min, max, shortlisted, outstanding } = s.room;
  const chosen = depts.filter((d) => d.chosen);
  const spread = max > min;

  return (
    <section className="grid items-center gap-6 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Your room so far
        </h2>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-4xl font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
            £{total.toLocaleString()}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          {chosen.length ? "top pick in each department, landed" : "nothing shortlisted yet"}
        </p>
        {spread && (
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            £{min.toLocaleString()}–£{max.toLocaleString()} depending which of your {shortlisted} shortlisted items you
            go with.
          </p>
        )}
        {outstanding.length > 0 && (
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            Still to choose: <span className="font-medium text-[var(--status-maybe)]">{outstanding.join(" · ")}</span>
          </p>
        )}
        {!chosen.length && (
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-[var(--text-secondary)]">
            Save a bed and a TV unit and they land here with a running total. The shelves below are what each
            department currently recommends.
          </p>
        )}
      </div>

      {/* The whole shortlist, not just the two picks — it fills the band and it
          is what you actually want to look at when deciding. */}
      {chosen.length > 0 && (
        <div className="flex snap-x items-start gap-3 overflow-x-auto pb-1">
          {chosen.flatMap((dept) =>
            dept.items.map((p, i) => (
              <div key={`${p.dept}-${p.id}`} className="shrink-0">
                <div className="mb-1 flex items-baseline gap-1.5 text-[10px] uppercase tracking-wide">
                  <span className="text-[var(--text-muted)]">{dept.label}</span>
                  {i === 0 && <span className="font-semibold text-[var(--status-yes)]">top pick</span>}
                </div>
                <ProductCard p={p} width="w-36" tone="sunken" />
              </div>
            )),
          )}
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const [s, setS] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/summary")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Summary) => !cancelled && setS(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const d = s?.departments;

  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b border-[var(--border-primary)] bg-[var(--bg-app)]/95 px-6 py-4 backdrop-blur">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">London</h1>
        <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
          {error
            ? "Couldn't load the shop."
            : !d
              ? "Opening up…"
              : `${d.flats.count} flats on the board · ${d.beds.count} beds, ${d.mattresses.count} mattresses and ${d.consoles.count} TV units researched`}
          {s?.departments.flats.lastRun && ` · flat search ran ${relative(s.departments.flats.lastRun)}`}
        </p>
      </header>

      <div className="p-6">
        {error && (
          <div className="mb-6 rounded-xl border border-[var(--status-no)] bg-[var(--status-no-bg)] p-4 text-sm text-[var(--status-no)]">
            {error}
          </div>
        )}
        {!s && !error && <div className="text-sm text-[var(--text-secondary)]">Loading…</div>}

        {s && d && (
          <>
            <Room s={s} />

            <section className="mt-8">
              <h2 className="mb-2 text-sm font-bold text-[var(--text-primary)]">Departments</h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
                <DepartmentTile
                  href="/flats" icon="🔑" title="Flats"
                  count={d.flats.count} countLabel="on the board"
                  line={`${d.flats.isNew} new · ${d.flats.saved} saved · ${d.flats.areas} areas`}
                  accent={d.flats.isNew > 0}
                />
                <DepartmentTile
                  href="/research" icon="🔬" title="Areas"
                  count={d.areas.undecided} countLabel="still undecided"
                  line={`${d.areas.yes} yes · ${d.areas.maybe} maybe · ${d.areas.ranked} ranked`}
                />
                <DepartmentTile
                  href="/sofas" icon="🛋️" title="Sofas"
                  count={d.sofas.inBudgetFits} countLabel="meet the brief"
                  line={`of ${d.sofas.count} researched · ${d.sofas.deep} at 112cm deep`}
                />
                <DepartmentTile
                  href="/beds" icon="🛏️" title="Beds"
                  count={d.beds.count} countLabel="double ottomans"
                  line={`${d.beds.assembled} arrive assembled · ${d.beds.saved} saved`}
                />
                <DepartmentTile
                  href="/mattresses" icon="💤" title="Mattress"
                  count={d.mattresses.inBand} countLabel="in your firmness band"
                  line={`of ${d.mattresses.count} researched · ${d.mattresses.verifiedDeals} of ${d.mattresses.claimedDeals} “sales” are real`}
                />
                <DepartmentTile
                  href="/consoles" icon="📺" title="TV units"
                  count={d.consoles.inBudgetFits} countLabel="fit, in budget"
                  line={`of ${d.consoles.count} researched · ${d.consoles.withBay} hide the PS5 in a bay`}
                />
              </div>
            </section>

            <Shelf
              title="Sofas with two seats and somewhere for your legs"
              hint="Ranked on depth first — the 112cm on the Raft is what you liked."
              href="/sofas" hrefLabel="Browse all sofas"
              items={s.shelves.sofas}
              empty="No sofas researched yet."
            />

            <Shelf
              title="TV units that take the whole setup"
              hint="Confirmed to hold the 55&quot; LG on its stand, the soundbar in front, and a PS5 — within budget."
              href="/consoles" hrefLabel="Browse all TV units"
              items={s.shelves.consoles}
              empty="Nothing confirmed to fit yet."
            />

            <Shelf
              title="Best of the bed department"
              hint="Ranked on landed cost, storage depth, mechanism and build."
              href="/beds" hrefLabel="Browse all beds"
              items={s.shelves.beds}
            />

            <Shelf
              title="Mattresses that suit how you sleep"
              hint="Ranked on firmness first, then sharing, then the sleep trial. Never on the size of the discount."
              href="/mattresses" hrefLabel="Browse all mattresses"
              items={s.shelves.mattresses}
              empty="No mattresses researched yet."
            />

            <Shelf
              title={s.shelves.flats.some((f) => f.saved) ? "Flats you're weighing up" : "New on the board"}
              href="/flats" hrefLabel="Browse all flats"
              items={s.shelves.flats}
              empty="No new listings since the last run."
            />

            <section className="mt-8">
              <div className="mb-2 flex items-baseline gap-3">
                <h2 className="text-sm font-bold text-[var(--text-primary)]">Notes to self</h2>
                <Link href="/journal" className="text-xs text-[var(--accent)] hover:underline">
                  all {s.journal.total} →
                </Link>
              </div>
              {s.journal.recent.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--border-primary)] p-5 text-center text-xs text-[var(--text-muted)]">
                  Nothing written down yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  {s.journal.recent.map((e) => (
                    <Link
                      key={e.id}
                      href="/journal"
                      className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                        <span>{relative(e.createdAt)}</span>
                        {e.neighbourhood && <span>· {e.neighbourhood}</span>}
                        {e.decision && <span className="text-[var(--accent)]">· {e.decision}</span>}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{e.content}</p>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
