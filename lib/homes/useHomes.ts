"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { townStats } from "@/components/homes/WhereToBuy";
import { duplicateGroups } from "./flags";
import type { BuyTown, HomeListing, Pref } from "./types";

// What both buying pages load: every town and every tracked home, with the
// duplicate copies worked out once.
export function useHomes() {
  const [towns, setTowns] = useState<BuyTown[] | null>(null);
  const [listings, setListings] = useState<HomeListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/homes")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { towns: BuyTown[]; listings: HomeListing[] }) => {
        if (cancelled) return;
        setTowns(d.towns);
        setListings(d.listings);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  const setPref = useCallback(async (id: string, pref: Pref | null) => {
    setListings((prev) => prev?.map((l) => (l.id === id ? { ...l, pref } : l)) ?? prev);
    try {
      await fetch("/api/homes/pref", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: id, pref }),
      });
    } catch {
      // the optimistic value stands until reload
    }
  }, []);

  const all = useMemo(() => listings ?? [], [listings]);
  const townById = useMemo(() => new Map((towns ?? []).map((t) => [t.id, t])), [towns]);
  const dupes = useMemo(() => duplicateGroups(all), [all]);

  // A duplicate group shows one card: the one with the most photos, then the lowest id.
  const hiddenDupes = useMemo(() => {
    const hide = new Set<string>();
    const byId = new Map(all.map((l) => [l.id, l]));
    for (const [id, others] of dupes) {
      const group = [id, ...others].map((x) => byId.get(x)!).filter(Boolean);
      const photos = (l: HomeListing) => l.photoCount ?? l.photos.length;
      group.sort((a, b) => photos(b) - photos(a) || a.id.localeCompare(b.id));
      group.slice(1).forEach((l) => hide.add(l.id));
    }
    return hide;
  }, [dupes, all]);

  // "Live" for overviews: not hidden by the user, not a duplicate copy.
  const live = useMemo(() => all.filter((l) => l.pref !== "reject" && !hiddenDupes.has(l.id)), [all, hiddenDupes]);
  const stats = useMemo(() => townStats(towns ?? [], live), [towns, live]);
  const checked = useMemo(() => all.reduce<string | null>((m, l) => (!m || l.lastSeenAt > m ? l.lastSeenAt : m), null), [all]);

  return { towns, listings, error, retry, setPref, all, townById, dupes, hiddenDupes, live, stats, checked };
}
