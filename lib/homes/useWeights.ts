"use client";

import { useCallback, useSyncExternalStore } from "react";
import { BALANCED, readWeights, type Weights } from "./score";

// One set of weights shared by the Towns and Homes pages, kept in this
// browser. The server render uses Balanced; the stored value takes over on
// the client without a flash of the wrong order.

const KEY = "buying.weights";
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Weights } | null = null;

function snapshot(): Weights {
  const raw = localStorage.getItem(KEY);
  if (!cache || cache.raw !== raw) cache = { raw, value: readWeights(raw) };
  return cache.value;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

export function useWeights(): [Weights, (w: Weights) => void] {
  const weights = useSyncExternalStore(subscribe, snapshot, () => BALANCED);
  const set = useCallback((w: Weights) => {
    localStorage.setItem(KEY, JSON.stringify(w));
    listeners.forEach((fn) => fn());
  }, []);
  return [weights, set];
}
