"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DepartmentTile from "@/components/home/DepartmentTile";
import ProductCard from "@/components/home/ProductCard";
import Shelf from "@/components/home/Shelf";
import { PROJECTS, SHARED } from "@/lib/nav";
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
    buying: { count: number; saved: number; towns: number; townsWithStock: number };
    flats: { count: number; isNew: number; gone: number; saved: number; areas: number; lastRun: string | null };
    areas: { count: number; yes: number; maybe: number; undecided: number; ranked: number; apartments: number };
    sofas: { count: number; saved: number; confirmed: number; deep: number; inBudgetFits: number };
    sofaBeds: { count: number; saved: number; fits: number; sleepsApart: number; double: number };
    beds: { count: number; saved: number; assembled: number };
    mattresses: {
      count: number; saved: number; inBand: number; inBudgetFits: number;
      claimedDeals: number; verifiedDeals: number;
    };
    consoles: { count: number; saved: number; confirmed: number; inBudgetFits: number; withBay: number };
  };
  shelves: {
    sofas: Product[]; sofaBeds: Product[]; beds: Product[]; mattresses: Product[]; consoles: Product[];
    flats: Product[];
  };
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
    <section aria-labelledby="room-heading" className="grid items-center gap-6 rounded-xl bg-[var(--surface)] p-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <div>
        <h2 id="room-heading" className="text-sm font-semibold text-[var(--ink-2)]">
          Your room so far
        </h2>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-6xl font-bold tracking-[-0.035em] text-[var(--ink)]">
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
                <div className="mb-1 flex items-baseline gap-1.5 text-xs">
                  <span className="text-[var(--text-muted)]">{dept.label}</span>
                  {i === 0 && <span className="font-semibold text-[var(--status-yes)]">Top pick</span>}
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

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/summary")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Summary) => !cancelled && setS(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    setError(null);
    setAttempt((n) => n + 1);
  }

  const d = s?.departments;

  // What each page's tile says on the home page. A page with no entry still
  // gets a tile — just its name and a door.
  const tiles: Record<string, { count: number; countLabel: string; line: string; accent?: boolean }> = d
    ? {
        "/flats": { count: d.flats.count, countLabel: "on the board", line: `${d.flats.isNew} new · ${d.flats.saved} saved · ${d.flats.areas} areas`, accent: d.flats.isNew > 0 },
        "/buying/towns": { count: d.buying.towns, countLabel: "station towns", line: `${d.buying.townsWithStock} with homes for sale, ranked your way` },
        "/buying": { count: d.buying.count, countLabel: "homes for sale", line: `near ${d.buying.townsWithStock} of ${d.buying.towns} stations · ${d.buying.saved} saved` },
        "/apartments": { count: d.areas.apartments, countLabel: "buildings tracked", line: "Developments near your shortlisted areas" },
        "/map": { count: d.areas.undecided, countLabel: "still undecided", line: `${d.areas.yes} yes · ${d.areas.maybe} maybe · ${d.areas.ranked} ranked` },
        "/sofas": { count: d.sofas.inBudgetFits, countLabel: "meet the brief", line: `of ${d.sofas.count} researched · ${d.sofas.deep} at 112cm deep` },
        "/sofa-beds": { count: d.sofaBeds.fits, countLabel: "meet the brief", line: `of ${d.sofaBeds.count} researched · ${d.sofaBeds.sleepsApart} sleep on their own mattress` },
        "/beds": { count: d.beds.count, countLabel: "double ottomans", line: `${d.beds.assembled} arrive assembled · ${d.beds.saved} saved` },
        "/mattresses": { count: d.mattresses.inBand, countLabel: "in your firmness band", line: `of ${d.mattresses.count} researched · ${d.mattresses.verifiedDeals} of ${d.mattresses.claimedDeals} “sales” are real` },
        "/consoles": { count: d.consoles.inBudgetFits, countLabel: "fit, in budget", line: `of ${d.consoles.count} researched · ${d.consoles.withBay} hide the PS5 in a bay` },
        "/journal": { count: s!.journal.total, countLabel: "notes", line: "Decisions and things to remember" },
      }
    : {};

  return (
    <div className="h-full overflow-y-auto">
      <header className="px-4 pb-2 pt-6 sm:px-8 sm:pt-8">
        <h1 className="text-4xl font-bold tracking-[-0.025em] text-[var(--ink)]">Home</h1>
        <p className="mt-2 max-w-[68ch] font-serif text-lg leading-relaxed text-[var(--ink-2)]">
          {error
            ? "Something went wrong loading the summary."
            : !d
              ? "Opening up…"
              : `${d.flats.count} flats on the board · ${d.beds.count} beds, ${d.mattresses.count} mattresses and ${d.consoles.count} TV units researched`}
          {s?.departments.flats.lastRun && ` · flat search ran ${relative(s.departments.flats.lastRun)}`}
        </p>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-4 sm:px-8">
        {error && (
          <div role="alert" className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border-l-4 border-[var(--bad)] bg-[var(--bad-wash)] p-4 text-sm text-[var(--ink)]">
            <span className="mr-auto">
              Couldn&apos;t load your summary. The database may be offline. <span className="text-[var(--ink-3)]">({error})</span>
            </span>
            <button
              type="button"
              onClick={retry}
              className="h-10 rounded-full border border-[var(--line-control)] bg-[var(--surface)] px-4 text-sm font-semibold"
            >
              Try again
            </button>
          </div>
        )}
        {!s && !error && (
          <div aria-busy="true" aria-label="Loading" className="space-y-6">
            <div className="h-40 animate-pulse rounded-xl bg-[var(--sunk)]" />
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-[var(--sunk)]" />
              ))}
            </div>
          </div>
        )}

        {s && d && (
          <>
            <Room s={s} />

            {/* Departments, grouped by project — read from lib/nav.ts, the same
                source as the sidebar, so a new project shows up in both. */}
            {[...PROJECTS.map((p) => ({ id: p.id, label: p.label, question: p.question, pages: p.pages })),
              { id: "tools", label: "Tools", question: "Shared across every project", pages: SHARED }].map((group) => (
              <section key={group.id} className="mt-10" aria-labelledby={`dept-${group.id}`}>
                <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
                  <h2 id={`dept-${group.id}`} className="text-lg font-semibold text-[var(--ink)]">{group.label}</h2>
                  <p className="text-sm text-[var(--ink-3)]">{group.question}</p>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-x-8 gap-y-6">
                  {group.pages.map((page) => {
                    const t = tiles[page.href];
                    return (
                      <DepartmentTile
                        key={page.href}
                        href={page.href}
                        title={page.label}
                        count={t?.count}
                        countLabel={t?.countLabel ?? ""}
                        line={t?.line}
                        accent={t?.accent}
                      />
                    );
                  })}
                </div>
              </section>
            ))}

            <Shelf
              title="Sofas with two seats and somewhere for your legs"
              hint="Ranked on depth first — the 112cm on the Raft is what you liked."
              href="/sofas" hrefLabel="Browse all sofas"
              items={s.shelves.sofas}
              empty="No sofas researched yet."
            />

            <Shelf
              title="Sofa beds that seat three and sleep two"
              hint="Ranked on sitting comfort first — whether you sleep on a separate mattress or the seat itself."
              href="/sofa-beds" hrefLabel="Browse all sofa beds"
              items={s.shelves.sofaBeds}
              empty="No sofa beds researched yet."
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
                <h2 className="text-lg font-semibold text-[var(--ink)]">Notes to self</h2>
                <Link href="/journal" className="text-xs text-[var(--accent)] hover:underline">
                  All {s.journal.total} notes →
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
                      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <span>{relative(e.createdAt)}</span>
                        {e.neighbourhood && <span>· {e.neighbourhood}</span>}
                        {e.decision && <span className="text-[var(--accent)]">· {e.decision}</span>}
                      </div>
                      <p className="mt-1 line-clamp-4 font-serif text-sm leading-relaxed text-[var(--ink)]">{e.content}</p>
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
