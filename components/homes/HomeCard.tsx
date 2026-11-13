"use client";

import NoPhoto from "@/components/NoPhoto";
import type { Flag } from "@/lib/homes/flags";
import { priceChange } from "@/lib/homes/track";
import type { HomeListing, Pref } from "@/lib/homes/types";

// A home for sale. Photo first, price loud, then the three things that decide
// whether it's worth a viewing: how far from the station, what kind of home,
// and what still needs checking. Flags say what to do in words — colour backs
// them up, never carries them alone.

const TONE: Record<Flag["tone"], string> = {
  verify: "bg-[var(--sunk)] text-[var(--ink-2)]",
  warn: "bg-[var(--bad-wash)] text-[var(--ink)]",
  info: "bg-[var(--focus-wash)] text-[var(--ink)]",
};

const TENURE: Record<string, string> = {
  leasehold: "Leasehold",
  freehold: "Freehold",
  "share-of-freehold": "Share of freehold",
};

const k = (p: number) => `£${Math.round(p / 1000)}k`;

export default function HomeCard({
  home,
  townName,
  commute,
  flags,
  isNew = false,
  score = null,
  why,
  onPref,
}: {
  home: HomeListing;
  townName: string;
  commute: string | null;
  isNew?: boolean;
  /** 0–100 by the user's weights; null when nothing is weighted. */
  score?: number | null;
  /** What helps and hurts this home's score, in words. */
  why?: string;
  flags: Flag[];
  onPref: (id: string, pref: Pref | null) => void;
}) {
  const wanted = home.pref === "want";
  const rejected = home.pref === "reject";
  const change = priceChange(home.priceHistory);
  const facts = [
    home.baths ? `${home.beds} bed · ${home.baths} bath` : `${home.beds} bed`,
    home.propertyType?.replace(/\s*\(.*\)$/, ""),
    home.floorAreaSqFt && home.floorAreaSqFt >= 200 ? `${home.floorAreaSqFt.toLocaleString()} sq ft` : null,
    home.newBuild ? "New build" : null,
    home.garden ? "Garden" : null,
    home.parking ? `Parking: ${home.parking.toLowerCase()}` : null,
  ].filter(Boolean);
  const verify = flags.find((f) => f.id === "verify");
  const others = flags.filter((f) => f.id !== "verify");

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-[var(--surface)] transition-colors ${
        wanted ? "border-[var(--focus)]" : "border-[var(--line)] hover:border-[var(--line-control)]"
      } ${rejected ? "opacity-60" : ""}`}
    >
      <div className="relative aspect-[3/2] bg-[var(--sunk)]">
        {home.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={home.photos[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <NoPhoto label="The portal page showed no photo" />
        )}
        {(home.photoCount ?? home.photos.length) > 1 && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium text-white">
            {home.photoCount ?? home.photos.length} photos
          </span>
        )}
        {isNew && home.status !== "coming-soon" && (
          <span className="absolute left-2 top-2 rounded-full bg-[var(--focus)] px-2.5 py-0.5 text-xs font-semibold text-[var(--on-action)]">
            New this pass
          </span>
        )}
        {home.status === "coming-soon" && (
          <span className="absolute left-2 top-2 rounded-full bg-[var(--action)] px-2.5 py-0.5 text-xs font-semibold text-[var(--on-action)]">
            Coming soon
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-[-0.02em] text-[var(--ink)]">£{home.priceGbp.toLocaleString()}</span>
          {change && (
            <span className={`text-xs font-semibold ${change.amount < 0 ? "text-[var(--good)]" : "text-[var(--warn)]"}`}>
              {change.amount < 0 ? "↓" : "↑"} {k(Math.abs(change.amount))} since {home.priceHistory[0].date.slice(5).split("-").reverse().join("/")}
            </span>
          )}
          {home.priceQualifier && !change && (
            <span className="truncate text-xs text-[var(--ink-3)]">{home.priceQualifier}</span>
          )}
        </div>

        <div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--ink)]">{home.address}</h3>
          <p className="mt-0.5 text-xs text-[var(--ink-2)]">
            {townName}
            {" · "}
            {home.distanceMiles != null ? (
              <span className="font-medium text-[var(--ink)]">{home.distanceMiles} mi to the station</span>
            ) : (
              "distance not stated"
            )}
          </p>
          {commute && <p className="text-xs text-[var(--ink-2)]">Train: {commute}</p>}
        </div>

        {score != null && (
          <p className="flex items-start gap-2 text-xs text-[var(--ink-2)]">
            <span
              title="How well this home fits your weights, 0–100"
              className="shrink-0 rounded bg-[var(--sunk)] px-1.5 py-0.5 font-semibold tabular text-[var(--ink)]"
            >
              {score}
              <span className="sr-only"> out of 100 for your weights</span>
            </span>
            {why && <span className="pt-0.5 leading-snug">{why}</span>}
          </p>
        )}

        <p className="text-xs text-[var(--ink-2)]">
          {facts.join(" · ")}
          {home.tenure && ` · ${TENURE[home.tenure]}`}
        </p>

        {home.keyFeatures.length > 0 && (
          <p className="line-clamp-2 font-serif text-sm leading-snug text-[var(--ink-2)]">
            {home.keyFeatures.filter((f) => !/possible duplicate/i.test(f)).join(" · ")}
          </p>
        )}

        {(others.length > 0 || verify) && (
          <ul className="flex flex-wrap gap-1" aria-label="Things to check">
            {others.map((f) => (
              <li key={f.id} title={f.detail} className={`rounded px-1.5 py-0.5 text-xs font-medium ${TONE[f.tone]}`}>
                {f.label}
              </li>
            ))}
            {verify && (
              <li title={verify.detail} className={`rounded px-1.5 py-0.5 text-xs font-medium ${TONE.verify}`}>
                Check {verify.detail.replace(/^Not on the results page: /, "").replace(/\.$/, "").split(", ").length} details
              </li>
            )}
          </ul>
        )}

        {home.agent && <p className="mt-auto truncate pt-1 text-xs text-[var(--ink-3)]">Marketed by {home.agent}</p>}

        <div className={`${home.agent ? "" : "mt-auto "}flex items-center gap-2 border-t border-[var(--line)] pt-3`}>
          <a
            href={home.listingUrl}
            target="_blank"
            rel="noreferrer"
            className="mr-auto inline-flex items-center gap-1 text-sm font-medium text-[var(--focus)] underline-offset-2 hover:underline"
          >
            View on {home.source}
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M6 3H3v10h10v-3M9 3h4v4M13 3 7 9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <button
            type="button"
            onClick={() => onPref(home.id, wanted ? null : "want")}
            aria-pressed={wanted}
            aria-label={wanted ? `Unsave ${home.address}` : `Save ${home.address}`}
            className={`h-9 rounded-full px-3 text-sm font-semibold transition-colors ${
              wanted ? "bg-[var(--action)] text-[var(--on-action)]" : "border border-[var(--line-control)] text-[var(--ink)] hover:bg-[var(--sunk)]"
            }`}
          >
            {wanted ? "♥ Saved" : "♡ Save"}
          </button>
          <button
            type="button"
            onClick={() => onPref(home.id, rejected ? null : "reject")}
            aria-pressed={rejected}
            aria-label={rejected ? `Restore ${home.address}` : `Hide ${home.address}`}
            className="h-9 rounded-full px-3 text-sm text-[var(--ink-2)] hover:bg-[var(--sunk)] hover:text-[var(--ink)]"
          >
            {rejected ? "Undo" : "Hide"}
          </button>
        </div>
      </div>
    </article>
  );
}
