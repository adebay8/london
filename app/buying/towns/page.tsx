"use client";

import { useMemo, useRef, useState } from "react";
import Pick from "@/components/homes/Pick";
import TownPanel from "@/components/homes/TownPanel";
import WeightsPanel from "@/components/homes/WeightsPanel";
import WhereToBuy, { type TownScore } from "@/components/homes/WhereToBuy";
import { CRITERIA, explain, homeFactors, scoreFactors, townFactors, whyLine, type CriterionId } from "@/lib/homes/score";
import { BRIEF, homeKind } from "@/lib/homes/types";
import { useHomes } from "@/lib/homes/useHomes";
import { useWeights } from "@/lib/homes/useWeights";

// Which town to focus on. The starting point of the buying search: the three
// standout answers, then every town ranked by the user's own weights (the
// same weights the Homes page ranks by), the map, and each town's research
// state. Choosing a town here leads to its homes.

const k = (p: number) => `£${Math.round(p / 1000)}k`;
const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
/** Below this, a town's averages say more about luck than about the town. */
const MIN_TO_JUDGE = 5;

export default function TownsPage() {
  const { towns, listings, error, retry, live, stats, townById, checked } = useHomes();
  const [weights, setWeights] = useWeights();
  const [selected, setSelected] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const coverage = useMemo(() => {
    const out: Partial<Record<CriterionId, number>> = {};
    if (!live.length) return out;
    const each = live.map(homeFactors);
    for (const c of CRITERIA) out[c.id] = each.filter((f) => f[c.id] != null).length / each.length;
    return out;
  }, [live]);

  const scores = useMemo(() => {
    const m = new Map<string, TownScore>();
    for (const s of stats) {
      if (!s.homes.length) continue;
      const f = townFactors(s.town.id, s.homes);
      m.set(s.town.id, { score: scoreFactors(f, weights), why: whyLine(explain(f, weights, undefined, s.town.id, s.homes)), thin: s.homes.length < MIN_TO_JUDGE });
    }
    return m;
  }, [stats, weights]);

  // Choosing a town brings its panel into view, so the click visibly does something.
  function choose(id: string | null) {
    setSelected(id);
    if (!id) return;
    requestAnimationFrame(() => {
      const box = scroller.current;
      const target = panel.current;
      if (!box || !target) return;
      const top = target.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 16;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      box.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    });
  }

  const withStock = stats.filter((s) => s.homes.length > 0);
  const quickest = [...withStock].sort((a, b) => (a.mins ?? 99) - (b.mins ?? 99) || a.from! - b.from!)[0];
  const cheapestHouse = live.filter((l) => homeKind(l) === "house").sort((a, b) => a.priceGbp - b.priceGbp)[0];
  const mostHouses = [...withStock].sort((a, b) => b.houses - a.houses)[0];
  const statOf = (id: string) => stats.find((s) => s.town.id === id)!;
  const selectedTown = selected ? townById.get(selected) : undefined;
  const toDo = stats.filter((s) => s.town.nextAction).sort((a, b) => a.town.town.localeCompare(b.town.town));

  return (
    <div ref={scroller} className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1200px] px-4 pb-24 pt-6 sm:px-8 lg:pb-12">
        <header>
          <p className="text-sm text-[var(--ink-3)]">Buying · Towns</p>
          <h1 className="mt-1 max-w-[24ch] text-3xl font-bold leading-tight tracking-[-0.025em] text-[var(--ink)] sm:text-4xl">
            Where a 2–3 bed near a good station is affordable
          </h1>
          {listings && towns && (
            <p className="mt-3 max-w-[68ch] font-serif text-lg leading-relaxed text-[var(--ink-2)]">
              {withStock.length} of {towns.length} station towns have homes for sale, £{BRIEF.minPriceGbp / 1000}k–£{BRIEF.maxPriceGbp / 1000}k, within a
              mile of the station ({live.length} homes){checked && `, last checked ${shortDate(checked)}`}.
            </p>
          )}
        </header>

        {error && (
          <div role="alert" className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border-l-4 border-[var(--bad)] bg-[var(--bad-wash)] p-4 text-sm">
            <span className="mr-auto">Couldn&apos;t load the towns. ({error})</span>
            <button type="button" onClick={retry} className="h-10 rounded-full border border-[var(--line-control)] bg-[var(--surface)] px-4 font-semibold">
              Try again
            </button>
          </div>
        )}

        {!listings && !error && (
          <div aria-busy="true" aria-label="Loading" className="mt-8 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl bg-[var(--sunk)]" />
              ))}
            </div>
            <div className="h-96 animate-pulse rounded-xl bg-[var(--sunk)]" />
          </div>
        )}

        {listings && towns && (
          <>
            {withStock.length > 0 && (
              <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Standout options">
                <Pick
                  label="Quickest train"
                  title={`${quickest.town.town}, ${quickest.mins} min`}
                  detail={`To ${quickest.terminus}. ${quickest.homes.length} homes, typically ${k(quickest.median!)}${quickest.houseMedian ? `; houses ${k(quickest.houseMedian)}` : ""}`}
                  href={`/buying?town=${quickest.town.id}`}
                />
                {cheapestHouse ? (
                  <Pick
                    label="Cheapest house"
                    title={`${townById.get(cheapestHouse.townId)?.town}, ${k(cheapestHouse.priceGbp)}`}
                    detail={`${cheapestHouse.beds}-bed ${(cheapestHouse.propertyType ?? "house").toLowerCase()}, ${statOf(cheapestHouse.townId).mins} min to ${statOf(cheapestHouse.townId).terminus}`}
                    href={`/buying?town=${cheapestHouse.townId}&kind=house`}
                  />
                ) : (
                  <Pick label="Cheapest house" title="None found yet" detail="Every home in this pass is a flat or maisonette." href="/buying" />
                )}
                {mostHouses && mostHouses.houses > 0 ? (
                  <Pick
                    label="Most houses"
                    title={`${mostHouses.town.town}, ${mostHouses.houses} houses`}
                    detail={`${mostHouses.mins} min to ${mostHouses.terminus}. Typical house ${k(mostHouses.houseMedian!)}`}
                    href={`/buying?town=${mostHouses.town.id}&kind=house`}
                  />
                ) : (
                  <Pick label="Most houses" title="None found yet" detail="Run a wider pass to bring in houses." href="/buying" />
                )}
              </section>
            )}

            <section className="mt-8" aria-labelledby="weights-heading">
              <h2 id="weights-heading" className="mb-3 text-lg font-semibold text-[var(--ink)]">
                What matters to you
              </h2>
              <WeightsPanel weights={weights} onChange={setWeights} coverage={coverage} />
              <p className="mt-2 text-xs text-[var(--ink-3)]">The Homes page ranks by these same weights.</p>
            </section>

            <section className="mt-8" aria-labelledby="where-heading">
              <h2 id="where-heading" className="mb-3 text-lg font-semibold text-[var(--ink)]">
                Towns, ranked
              </h2>
              <WhereToBuy stats={stats} selected={selected} onSelect={choose} scores={scores} />
            </section>

            <div ref={panel} />
            {selectedTown && (
              <div className="mt-6">
                <TownPanel
                  town={selectedTown}
                  count={statOf(selectedTown.id)?.homes.length ?? 0}
                  onClear={() => setSelected(null)}
                  clearLabel="Close"
                  homesHref={`/buying?town=${selectedTown.id}`}
                />
              </div>
            )}

            {toDo.length > 0 && (
              <details className="group mt-12 rounded-xl bg-[var(--surface)] p-5">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-lg font-semibold text-[var(--ink)]">
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="text-[var(--ink-3)] transition-transform group-open:rotate-90">
                    <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Research for the next pass
                  <span className="text-sm font-normal text-[var(--ink-3)]">· {toDo.length} towns</span>
                </summary>
                <ul className="mt-3 divide-y divide-[var(--line)]">
                  {toDo.map(({ town, homes }) => (
                    <li key={town.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-sm">
                      <button type="button" onClick={() => choose(town.id)} className="w-32 shrink-0 text-left font-semibold text-[var(--ink)] hover:underline">
                        {town.town}
                      </button>
                      <span className="w-16 shrink-0 text-xs text-[var(--ink-3)]">{homes.length ? `${homes.length} homes` : "empty"}</span>
                      <span className="min-w-0 flex-1 text-[var(--ink-2)]">
                        {town.policy ? <span className="font-medium text-[var(--warn)]">Decide: </span> : null}
                        {town.nextAction}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
