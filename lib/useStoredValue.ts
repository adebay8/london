"use client";

import { useCallback, useSyncExternalStore } from "react";

// A localStorage value React can read during render without an effect, and
// that stays in sync across components and tabs. The server snapshot is the
// fallback, so the first paint matches the server and hydration is clean.

const EVENT = "stored-value-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useStoredValue(key: string): [string | null, (v: string) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key), () => null);
  const set = useCallback(
    (v: string) => {
      try {
        localStorage.setItem(key, v);
      } catch {
        // storage unavailable — the change lasts until reload
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, set];
}

/** Live `prefers-color-scheme: dark`, false on the server. */
export function usePrefersDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
}
