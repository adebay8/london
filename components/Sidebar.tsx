"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme, type ThemeChoice } from "./ThemeProvider";
import { useStoredValue } from "@/lib/useStoredValue";

import { APP_NAME, PROJECTS, SETTINGS, SHARED, currentLabel, isPageActive, projectFor, type NavPage, type NavProject } from "@/lib/nav";

// The app's map, built from lib/nav.ts so it always matches the home page.
//
// Two kinds of thing live here: PROJECTS (renting, furnishing — research
// with an end) and SHARED TOOLS (areas, journal). Projects collapse: only the
// one you're in opens by default, so the rail stays short however many
// projects exist, and the full set is always one click away rather than
// hidden in a menu (NN/g, "Progressive disclosure"). Labels are words, not
// emoji, and the current page carries a focus bar plus aria-current.
//
// Wide screens: a 200px rail (Throughline's `rail` size). Narrow screens: a
// top bar whose menu button is labelled "Menu" — a bare hamburger is found
// less often than one with a word beside it.

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Day" },
  { value: "dark", label: "Night" },
];

function NavLink({ item, pathname, indent = false }: { item: NavPage; pathname: string; indent?: boolean }) {
  const active = isPageActive(pathname, item);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-10 items-center rounded-lg text-sm transition-colors ${indent ? "pl-6 pr-3" : "px-3"} ${
        active
          ? "bg-[var(--focus-wash)] font-semibold text-[var(--ink)]"
          : "text-[var(--ink-2)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--ink)]"
      }`}
    >
      {active && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[var(--focus)]" />}
      {item.label}
    </Link>
  );
}

function ThemeSwitch() {
  const { choice, setChoice } = useTheme();
  return (
    <div role="group" aria-label="Colour theme" className="flex rounded-full border border-[var(--line-control)] p-[3px]">
      {THEMES.map((t) => (
        <button
          key={t.value}
          type="button"
          aria-pressed={choice === t.value}
          onClick={() => setChoice(t.value)}
          className={`h-8 flex-1 rounded-full text-xs font-semibold transition-colors ${
            choice === t.value ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--ink-2)] hover:text-[var(--ink)]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

const OPEN_KEY = "nav-open-projects";

function parseOpened(raw: string | null): string[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function ProjectGroup({
  project,
  pathname,
  open,
  onToggle,
}: {
  project: NavProject;
  pathname: string;
  open: boolean;
  onToggle: () => void;
}) {
  const id = `nav-project-${project.id}`;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id}
        className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-[var(--ink)] hover:bg-[var(--bg-sidebar-hover)]"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden
          className={`shrink-0 text-[var(--ink-3)] transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="flex-1">{project.label}</span>
        {!open && <span className="text-xs font-normal text-[var(--ink-3)]">{project.pages.length}</span>}
      </button>
      {open && (
        <div id={id} className="mt-0.5 space-y-0.5">
          {project.pages.map((page) => (
            <NavLink key={page.href} item={page} pathname={pathname} indent />
          ))}
        </div>
      )}
    </div>
  );
}

function NavBody({ pathname }: { pathname: string }) {
  const current = projectFor(pathname)?.id;
  // Projects the user has opened by hand, remembered between visits. The one
  // you're in is always open on top of these.
  const [raw, store] = useStoredValue(OPEN_KEY);
  const opened = parseOpened(raw);
  // Closing the project you're in lasts only while you stay on that page.
  const [closedAt, setClosedAt] = useState<string | null>(null);
  const closedHere = closedAt === pathname ? current : null;

  function toggle(id: string, isOpen: boolean) {
    if (id === current) {
      setClosedAt(isOpen ? pathname : null);
      return;
    }
    store(JSON.stringify(isOpen ? opened.filter((x) => x !== id) : [...opened, id]));
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <NavLink item={{ href: "/", label: "Home" }} pathname={pathname} />

        <h2 className="mb-1 mt-6 px-3 text-xs font-normal text-[var(--ink-3)]">Projects</h2>
        <div className="space-y-1">
          {PROJECTS.map((project) => {
            const isOpen = (project.id === current && closedHere !== project.id) || opened.includes(project.id);
            return (
              <ProjectGroup
                key={project.id}
                project={project}
                pathname={pathname}
                open={isOpen}
                onToggle={() => toggle(project.id, isOpen)}
              />
            );
          })}
        </div>

        <h2 className="mb-1 mt-6 px-3 text-xs font-normal text-[var(--ink-3)]">Tools</h2>
        <div className="space-y-0.5">
          {SHARED.map((page) => (
            <NavLink key={page.href} item={page} pathname={pathname} />
          ))}
        </div>
      </div>
      <div className="space-y-3 border-t border-[var(--line)] px-3 py-3">
        <NavLink item={SETTINGS} pathname={pathname} />
        <div className="px-1">
          <ThemeSwitch />
        </div>
      </div>
    </>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  // The mobile menu remembers which page it was opened on, so navigating
  // closes it without an effect.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (v: boolean) => setOpenedOn(v ? pathname : null);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenedOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const current = currentLabel(pathname);

  return (
    <>
      {/* Wide screens: the rail. */}
      <nav
        aria-label="Main"
        className="hidden h-dvh w-[200px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--paper)] md:flex"
      >
        <Link href="/" className="block px-6 pb-4 pt-5 text-lg font-bold tracking-tight text-[var(--ink)]">
          {APP_NAME}
        </Link>
        <NavBody pathname={pathname} />
      </nav>

      {/* Narrow screens: a top bar with a labelled menu button. */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--line)] bg-[var(--paper)] px-4 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="flex h-10 items-center gap-2 rounded-full border border-[var(--line-control)] px-4 text-sm font-semibold text-[var(--ink)]"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />
          </svg>
          Menu
        </button>
        <Link href="/" className="shrink-0 font-bold text-[var(--ink)]">
          {APP_NAME}
        </Link>
        {current && <span className="truncate text-sm text-[var(--ink-3)]">/ {current}</span>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <nav
            id="mobile-nav"
            aria-label="Main"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-[var(--paper)] shadow-xl"
          >
            <div className="flex items-center justify-between px-6 pb-3 pt-4">
              <span className="text-lg font-bold text-[var(--ink)]">{APP_NAME}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 rounded-full border border-[var(--line-control)] px-4 text-sm font-semibold text-[var(--ink)]"
              >
                Close
              </button>
            </div>
            <NavBody pathname={pathname} />
          </nav>
        </div>
      )}
    </>
  );
}
