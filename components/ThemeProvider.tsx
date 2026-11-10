"use client";

import { createContext, useContext, useEffect } from "react";
import { usePrefersDark, useStoredValue } from "@/lib/useStoredValue";

// Throughline: "A piece follows the reader's system setting." System is the
// default; Day and Night are explicit overrides the user can pick.
export type ThemeChoice = "system" | "light" | "dark";

interface ThemeContextValue {
  choice: ThemeChoice;
  /** What is actually showing right now. */
  theme: "light" | "dark";
  setChoice: (c: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  choice: "system",
  theme: "light",
  setChoice: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [stored, store] = useStoredValue("theme");
  const prefersDark = usePrefersDark();
  const choice: ThemeChoice = stored === "light" || stored === "dark" ? stored : "system";
  const theme: "light" | "dark" = choice === "system" ? (prefersDark ? "dark" : "light") : choice;

  // Syncing the <html> class is a side effect on the DOM outside React.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ choice, theme, setChoice: store }}>{children}</ThemeContext.Provider>
  );
}
