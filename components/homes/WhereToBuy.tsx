"use client";

import { LONDON, STATIONS } from "@/lib/homes/stations";
import type { BuyTown, HomeListing } from "@/lib/homes/types";

// The decision a commuter-town buyer is making: how much home for how long a
// train. The map puts every town where it really is, with a spoke into London
// and a circle sized by how many homes we found. The list beside it ranks the
// same towns by commute so the price/time trade-off reads straight across.
// Both are controls: choosing a town filters the homes below.

const k = (p: number) => `£${Math.round(p / 1000)}k`;

export interface TownStat {
  town: BuyTown;
  homes: HomeListing[];
  mins: number | null;
  terminus: string | null;
  from: number | null;
  median: number | null;
}

export function townStats(towns: BuyTown[], homes: HomeListing[]): TownStat[] {
  return towns.map((town) => {
    const hs = homes.filter((h) => h.townId === town.id);
    const prices = hs.map((h) => h.priceGbp).sort((a, b) => a - b);
    const s = STATIONS[town.id];
    return {
      town,
      homes: hs,
      mins: s?.mins ?? null,
      terminus: s?.terminus ?? null,
      from: prices[0] ?? null,
      median: prices.length ? prices[Math.floor((prices.length - 1) / 2)] : null,
    };
  });
}

// Equirectangular projection, squashed by cos(latitude) so distances look right.
const W = 640;
const H = 540;
const LNG0 = -1.3;
const LAT1 = 52.24;
const SCALE = 500;
const X = (lng: number) => (lng - LNG0) * Math.cos((51.6 * Math.PI) / 180) * SCALE + 10;
const Y = (lat: number) => (LAT1 - lat) * SCALE;

function Map({ stats, selected, onSelect }: { stats: TownStat[]; selected: string | null; onSelect: (id: string | null) => void }) {
  const lx = X(LONDON.lng);
  const ly = Y(LONDON.lat);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Map of the station towns around London">
      {/* Greater London, roughly: a soft disc so the eye finds the centre. */}
      <circle cx={lx} cy={ly} r={78} fill="var(--sunk)" />
      <text x={lx} y={ly + 4} textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--ink-3)" letterSpacing="0.08em">
        LONDON
      </text>

      {stats.map((s) => {
        const p = STATIONS[s.town.id];
        if (!p) return null;
        return <line key={`spoke-${s.town.id}`} x1={lx} y1={ly} x2={X(p.lng)} y2={Y(p.lat)} stroke="var(--line)" strokeWidth={1.5} />;
      })}

      {stats.map((s) => {
        const p = STATIONS[s.town.id];
        if (!p) return null;
        const x = X(p.lng);
        const y = Y(p.lat);
        const n = s.homes.length;
        const r = n ? 6 + Math.sqrt(n) * 2.6 : 5;
        const sel = selected === s.town.id;
        const saved = s.homes.some((h) => h.pref === "want");
        const gap = r + 6;
        const pos =
          p.label === "left"
            ? { x: x - gap, y: y - 2, anchor: "end" as const }
            : p.label === "right"
              ? { x: x + gap, y: y - 2, anchor: "start" as const }
              : p.label === "above"
                ? { x, y: y - gap - (n ? 18 : 2), anchor: "middle" as const }
                : { x, y: y + gap + 12, anchor: "middle" as const };
        return (
          <g
            key={s.town.id}
            role="button"
            tabIndex={0}
            aria-pressed={sel}
            aria-label={`${s.town.town}: ${p.mins} minutes to ${p.terminus}, ${n ? `${n} homes from ${k(s.from!)}` : "no homes captured yet"}`}
            onClick={() => onSelect(sel ? null : s.town.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(sel ? null : s.town.id);
              }
            }}
            className="cursor-pointer outline-none [&:focus-visible>circle.dot]:stroke-[var(--focus)]"
          >
            {/* Generous invisible hit area. */}
            <circle cx={x} cy={y} r={Math.max(r + 8, 18)} fill="transparent" />
            <circle
              className="dot"
              cx={x}
              cy={y}
              r={r}
              fill={n ? (sel ? "var(--focus)" : "var(--ink)") : "var(--surface)"}
              stroke={n ? (saved && !sel ? "var(--focus)" : "var(--surface)") : sel ? "var(--focus)" : "var(--line-control)"}
              strokeWidth={n ? (saved && !sel ? 3 : 2) : 1.5}
            />
            {n > 0 && (
              <text x={x} y={y + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--paper)" pointerEvents="none">
                {n}
              </text>
            )}
            <text x={pos.x} y={pos.y} textAnchor={pos.anchor} pointerEvents="none">
              <tspan fontSize="14" fontWeight={n ? 700 : 500} fill={n ? "var(--ink)" : "var(--ink-3)"}>
                {s.town.town}
              </tspan>
              {n > 0 && (
                <tspan fontSize="14" fill="var(--ink-2)">
                  {" "}
                  · {p.mins} min
                </tspan>
              )}
              {n > 0 && (
                <tspan x={pos.x} dy="17" fontSize="13" fill="var(--ink-2)">
                  from {k(s.from!)}
                </tspan>
              )}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function WhereToBuy({
  stats,
  selected,
  onSelect,
}: {
  stats: TownStat[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const live = stats
    .filter((s) => s.homes.length > 0)
    .sort((a, b) => (a.mins ?? 99) - (b.mins ?? 99) || (a.from ?? 0) - (b.from ?? 0));
  const empty = stats.filter((s) => s.homes.length === 0).sort((a, b) => a.town.town.localeCompare(b.town.town));

  return (
    <div className="grid gap-6 rounded-xl bg-[var(--surface)] p-4 sm:p-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <figure>
        <Map stats={stats} selected={selected} onSelect={onSelect} />
        <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-3)]">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded-full bg-[var(--ink)]" /> Homes found (number inside)
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full border-[1.5px] border-[var(--line-control)]" /> Nothing yet
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded-full border-[3px] border-[var(--focus)] bg-[var(--ink)]" /> Has a saved home
          </span>
        </figcaption>
      </figure>

      <div className="min-w-0">
        <table className="w-full text-sm">
          <caption className="mb-2 text-left text-xs text-[var(--ink-3)]">
            Ranked by train time to London. Times are approximate fastest trains.
          </caption>
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-xs text-[var(--ink-3)]">
              <th scope="col" className="py-2 pr-2 font-medium">Town</th>
              <th scope="col" className="py-2 pr-2 text-right font-medium">Train</th>
              <th scope="col" className="py-2 pr-2 text-right font-medium">Homes</th>
              <th scope="col" className="py-2 pr-2 text-right font-medium">From</th>
              <th scope="col" className="py-2 text-right font-medium">Typical</th>
            </tr>
          </thead>
          <tbody>
            {live.map((s) => {
              const sel = selected === s.town.id;
              return (
                <tr
                  key={s.town.id}
                  onClick={() => onSelect(sel ? null : s.town.id)}
                  className={`cursor-pointer border-b border-[var(--line)] tabular transition-colors ${sel ? "bg-[var(--focus-wash)]" : "hover:bg-[var(--sunk)]"}`}
                >
                  <th scope="row" className="py-2 pr-2 text-left font-normal">
                    <button
                      type="button"
                      aria-pressed={sel}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(sel ? null : s.town.id);
                      }}
                      className="text-left"
                    >
                      <span className="block font-semibold text-[var(--ink)]">{s.town.town}</span>
                      <span className="block text-xs text-[var(--ink-3)]">to {s.terminus}</span>
                    </button>
                  </th>
                  <td className="py-2 pr-2 text-right font-semibold text-[var(--ink)]">{s.mins} min</td>
                  <td className="py-2 pr-2 text-right text-[var(--ink-2)]">{s.homes.length}</td>
                  <td className="py-2 pr-2 text-right font-semibold text-[var(--ink)]">{k(s.from!)}</td>
                  <td className="py-2 text-right text-[var(--ink-2)]">{k(s.median!)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {empty.length > 0 && (
          <p className="mt-3 text-xs leading-relaxed text-[var(--ink-3)]">
            <span className="font-medium text-[var(--ink-2)]">Nothing captured yet in {empty.length} towns: </span>
            {empty.map((s, i) => (
              <span key={s.town.id}>
                <button type="button" onClick={() => onSelect(s.town.id)} className="underline-offset-2 hover:text-[var(--ink)] hover:underline">
                  {s.town.town}
                </button>
                {i < empty.length - 1 ? ", " : "."}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
