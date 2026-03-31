"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ScoreBar from "@/components/ScoreBar";
import type { ResearchProfileRow } from "@/lib/types";
import { FIT_SCORE_WEIGHTS } from "@/lib/types";

function fitScoreBadgeColor(score: number): string {
  if (score >= 7.5) return "bg-[var(--score-good-bar)]";
  if (score >= 5) return "bg-[var(--score-mid-bar)]";
  return "bg-[var(--score-bad-bar)]";
}

function SourceList({ sources }: { sources: string[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <ul className="mt-2 space-y-0.5">
      {sources.map((src, i) => (
        <li key={i} className="truncate text-[11px] text-[var(--status-info)] underline underline-offset-2">
          <a href={src} target="_blank" rel="noopener noreferrer">{src}</a>
        </li>
      ))}
    </ul>
  );
}

export default function ResearchProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [profile, setProfile] = useState<ResearchProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reSearching, setReSearching] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/research/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  function handleReSearch() {
    if (!profile) return;
    setReSearching(true);
    fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neighbourhoodId: profile.neighbourhoodId }),
    })
      .then(() => {
        setTimeout(() => {
          router.refresh();
          setReSearching(false);
          // Re-fetch updated profile
          fetch(`/api/research/${id}`)
            .then((res) => res.json())
            .then(setProfile);
        }, 2000);
      })
      .catch(() => setReSearching(false));
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading research profile…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-6">
        <Link href="/research" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          ← Back to Research
        </Link>
        <p className="mt-4 text-[var(--status-no)]">{error ?? "Profile not found."}</p>
      </div>
    );
  }

  const n = profile.neighbourhood;
  const postcodes = n?.postcodes ?? "";

  return (
    <div className="p-6">
      {/* Back link */}
      <Link href="/research" className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
        ← Back to Research
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{n?.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
            <span>{n?.borough}</span>
            <span className="text-[var(--text-muted)]">·</span>
            <span>Zone {n?.zone}</span>
            {postcodes && (
              <>
                <span className="text-[var(--text-muted)]">·</span>
                <span className="font-mono text-xs text-[var(--text-muted)]">{postcodes}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`rounded-xl px-4 py-2 text-2xl font-bold text-[var(--text-on-accent)] ${fitScoreBadgeColor(profile.fitScore)}`}>
            {profile.fitScore.toFixed(1)}
            <span className="ml-1 text-sm font-normal opacity-80">fit</span>
          </div>
          <button
            onClick={handleReSearch}
            disabled={reSearching}
            className="rounded-lg bg-[var(--bg-secondary)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            {reSearching ? "Re-researching…" : "Re-research"}
          </button>
        </div>
      </div>

      {/* Overview */}
      <section className="mb-8 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Overview</h2>
        <p className="leading-relaxed text-[var(--text-secondary)]">{profile.overview}</p>
      </section>

      {/* Score detail panels — 2-col grid */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Score Breakdown</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          {/* Transport */}
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-5">
            <h3 className="mb-3 font-semibold text-[var(--text-primary)]">Transport</h3>
            <ScoreBar
              label="Transport score"
              score={profile.transport.score}
              weight={`Weight: ${Math.round(FIT_SCORE_WEIGHTS.transport * 100)}%`}
            />
            <div className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
              {profile.transport.stations.length > 0 && (
                <p><span className="text-[var(--text-muted)]">Stations:</span> {profile.transport.stations.join(", ")}</p>
              )}
              {profile.transport.lines.length > 0 && (
                <p><span className="text-[var(--text-muted)]">Lines:</span> {profile.transport.lines.join(", ")}</p>
              )}
              <p><span className="text-[var(--text-muted)]">Commute:</span> {profile.transport.commuteMins} min</p>
              {profile.transport.frequency && (
                <p><span className="text-[var(--text-muted)]">Frequency:</span> {profile.transport.frequency}</p>
              )}
            </div>
            <SourceList sources={profile.transport.sources} />
          </div>

          {/* Safety */}
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-5">
            <h3 className="mb-3 font-semibold text-[var(--text-primary)]">Safety</h3>
            <ScoreBar
              label="Safety score"
              score={profile.safety.score}
              weight={`Weight: ${Math.round(FIT_SCORE_WEIGHTS.safety * 100)}%`}
            />
            <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">{profile.safety.evidence}</p>
            <SourceList sources={profile.safety.sources} />
          </div>

          {/* Rent */}
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-5">
            <h3 className="mb-3 font-semibold text-[var(--text-primary)]">Rent Value</h3>
            <ScoreBar
              label="Rent value score"
              score={profile.rentValue.score}
              weight={`Weight: ${Math.round(FIT_SCORE_WEIGHTS.rentValue * 100)}%`}
            />
            <div className="mt-3 text-xs text-[var(--text-secondary)]">
              <p className="mb-1">
                <span className="text-[var(--text-muted)]">Range:</span>{" "}
                £{profile.rentValue.rangeLow.toLocaleString()}–£{profile.rentValue.rangeHigh.toLocaleString()} /mo
              </p>
              <p className="leading-relaxed">{profile.rentValue.analysis}</p>
            </div>
            <SourceList sources={profile.rentValue.sources} />
          </div>

          {/* New Builds */}
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-5">
            <h3 className="mb-3 font-semibold text-[var(--text-primary)]">New Builds</h3>
            <ScoreBar
              label="New builds score"
              score={profile.newBuilds.score}
              weight={`Weight: ${Math.round(FIT_SCORE_WEIGHTS.newBuilds * 100)}%`}
            />
            {profile.newBuilds.developments.length > 0 && (
              <ul className="mt-3 space-y-2">
                {profile.newBuilds.developments.map((dev, i) => (
                  <li key={i} className="text-xs text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text-primary)]">
                      {dev.url ? (
                        <a href={dev.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--accent)]">{dev.name} ↗</a>
                      ) : dev.name}
                    </span>
                    {dev.priceRange && <span className="ml-1 text-[var(--text-muted)]">({dev.priceRange})</span>}
                    {dev.features.length > 0 && (
                      <span className="ml-1 text-[var(--text-muted)]">— {dev.features.join(", ")}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <SourceList sources={profile.newBuilds.sources} />
          </div>

          {/* Amenities */}
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-5">
            <h3 className="mb-3 font-semibold text-[var(--text-primary)]">Amenities</h3>
            <ScoreBar
              label="Amenities score"
              score={profile.amenities.score}
              weight={`Weight: ${Math.round(FIT_SCORE_WEIGHTS.amenities * 100)}%`}
            />
            <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">{profile.amenities.details}</p>
            <SourceList sources={profile.amenities.sources} />
          </div>

          {/* Area Quality */}
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-5">
            <h3 className="mb-3 font-semibold text-[var(--text-primary)]">Area Quality</h3>
            <ScoreBar
              label="Area quality score"
              score={profile.areaQuality.score}
              weight={`Weight: ${Math.round(FIT_SCORE_WEIGHTS.areaQuality * 100)}%`}
            />
            <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">{profile.areaQuality.evidence}</p>
            <SourceList sources={profile.areaQuality.sources} />
          </div>

        </div>
      </section>

      {/* Pros / Cons */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Pros &amp; Cons</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--status-yes)] bg-[var(--status-yes-bg)] p-5">
            <h3 className="mb-3 font-semibold text-[var(--status-yes)]">Pros</h3>
            <ul className="space-y-1.5">
              {profile.pros.map((pro, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="mt-0.5 shrink-0 text-[var(--status-yes)]">+</span>
                  {pro}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--status-no)] bg-[var(--status-no-bg)] p-5">
            <h3 className="mb-3 font-semibold text-[var(--status-no)]">Cons</h3>
            <ul className="space-y-1.5">
              {profile.cons.map((con, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="mt-0.5 shrink-0 text-[var(--status-no)]">−</span>
                  {con}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Metadata footer */}
      <footer className="border-t border-[var(--border-primary)] pt-4 text-xs text-[var(--text-muted)]">
        <span>Researched: {new Date(profile.researchedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
        <span className="mx-2">·</span>
        <span>Model: {profile.modelUsed}</span>
      </footer>
    </div>
  );
}
