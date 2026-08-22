"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HomeCard from "@/components/home/HomeCard";

// The landing surface. Every vertical in this app used to be a flat peer in
// the sidebar with nothing above it, so there was no place that answered
// "where does the decision actually stand?". This is that place: one card per
// workstream, grouped the same way the sidebar is, reading a single aggregated
// endpoint rather than pulling each vertical's full payload.

interface Summary {
  flats: { active: number; isNew: number; gone: number; saved: number; areas: number; lastRun: string | null };
  neighbourhoods: { total: number; yes: number; maybe: number; no: number; undecided: number; ranked: number };
  apartments: { total: number };
  beds: { total: number; saved: number; top: TopPick | null };
  consoles: { total: number; saved: number; confirmedFit: number; unconfirmed: number; top: TopPick | null };
  journal: { total: number; recent: JournalEntry[] };
}

interface TopPick {
  label: string;
  score: number;
  price: number;
  note: string | null;
}

interface JournalEntry {
  id: string;
  content: string;
  decision: string | null;
  createdAt: string;
  neighbourhood: string | null;
}

function Band({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-[var(--text-primary)]">{title}</h2>
        <p className="text-xs text-[var(--text-secondary)]">{hint}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

const pick = (t: TopPick | null) =>
  t ? { label: t.label, detail: `£${t.price.toLocaleString()} · scores ${t.score}${t.note ? ` · ${t.note}` : ""}` } : null;

function relative(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days)) return "";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
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

  const loading = s == null && !error;

  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b border-[var(--border-primary)] bg-[var(--bg-app)]/95 px-6 py-5 backdrop-blur">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">London</h1>
        <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
          {error
            ? "Couldn't load the summary."
            : loading
              ? "Loading…"
              : `${s!.flats.active} flats on the board across ${s!.flats.areas} areas · ` +
                `${s!.flats.saved + s!.beds.saved + s!.consoles.saved} things saved · ` +
                `${s!.neighbourhoods.undecided} areas still undecided`}
        </p>
        {s?.flats.lastRun && (
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">Flat search last run {relative(s.flats.lastRun)}</p>
        )}
      </header>

      <div className="p-6">
        {error && (
          <div className="mb-6 rounded-xl border border-[var(--status-no)] bg-[var(--status-no-bg)] p-4 text-sm text-[var(--status-no)]">
            {error}
          </div>
        )}

        <Band title="Which flat" hint="The live search, and the tools for choosing between what it finds.">
          <HomeCard
            href="/flats"
            icon="🔑"
            title="Flats"
            headline={s?.flats.active}
            headlineLabel="active listings"
            loading={loading}
            stats={[
              { label: "new", value: s?.flats.isNew ?? 0, tone: (s?.flats.isNew ?? 0) > 0 ? "good" : "muted" },
              { label: "saved", value: s?.flats.saved ?? 0, tone: "good" },
              { label: "gone", value: s?.flats.gone ?? 0, tone: "muted" },
            ]}
          />
          <HomeCard
            href="/compare"
            icon="⚖️"
            title="Compare"
            headline={s?.flats.saved}
            headlineLabel="saved to weigh up"
            loading={loading}
          />
          <HomeCard
            href="/apartments"
            icon="🏢"
            title="Buildings"
            headline={s?.apartments.total}
            headlineLabel="researched"
            loading={loading}
          />
          <HomeCard
            href="/map"
            icon="🗺️"
            title="Map"
            headline={s?.flats.areas}
            headlineLabel="search areas"
            loading={loading}
          />
        </Band>

        <Band title="Where to live" hint="Area research and how the shortlist is ordered.">
          <HomeCard
            href="/research"
            icon="🔬"
            title="Research"
            headline={s?.neighbourhoods.total}
            headlineLabel="neighbourhoods"
            loading={loading}
            stats={[
              { label: "yes", value: s?.neighbourhoods.yes ?? 0, tone: "good" },
              { label: "maybe", value: s?.neighbourhoods.maybe ?? 0, tone: "maybe" },
              { label: "no", value: s?.neighbourhoods.no ?? 0, tone: "bad" },
            ]}
          />
          <HomeCard
            href="/rankings"
            icon="🏆"
            title="Rankings"
            headline={s?.neighbourhoods.ranked}
            headlineLabel="areas ranked"
            loading={loading}
            stats={[{ label: "still undecided", value: s?.neighbourhoods.undecided ?? 0, tone: "maybe" }]}
          />
        </Band>

        <Band title="What goes in it" hint="Furniture searches, each ranked on its own criteria.">
          <HomeCard
            href="/beds"
            icon="🛏️"
            title="Beds"
            headline={s?.beds.total}
            headlineLabel="double ottomans"
            loading={loading}
            stats={[{ label: "saved", value: s?.beds.saved ?? 0, tone: "good" }]}
            footer={pick(s?.beds.top ?? null)}
          />
          <HomeCard
            href="/consoles"
            icon="📺"
            title="TV unit"
            headline={s?.consoles.total}
            headlineLabel="units researched"
            loading={loading}
            stats={[
              {
                label: "confirmed to fit",
                value: s?.consoles.confirmedFit ?? 0,
                tone: (s?.consoles.confirmedFit ?? 0) > 0 ? "good" : "bad",
              },
              { label: "unconfirmed", value: s?.consoles.unconfirmed ?? 0, tone: "maybe" },
              { label: "saved", value: s?.consoles.saved ?? 0, tone: "good" },
            ]}
            footer={pick(s?.consoles.top ?? null)}
          />
        </Band>

        <section className="mt-8">
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Latest from the journal</h2>
            <Link href="/journal" className="text-xs text-[var(--accent)] hover:underline">
              all {s?.journal.total ?? 0} entries →
            </Link>
          </div>
          {loading && <div className="text-sm text-[var(--text-secondary)]">Loading…</div>}
          {s && s.journal.recent.length === 0 && (
            <p className="rounded-xl border border-dashed border-[var(--border-primary)] p-6 text-center text-sm text-[var(--text-muted)]">
              Nothing written down yet.
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {s?.journal.recent.map((e) => (
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
        </section>
      </div>
    </div>
  );
}
