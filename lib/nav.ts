// The app's information architecture, in one place.
//
// Everything is either a PROJECT or a SHARED TOOL:
//
//   Projects     — a piece of research with an end: renting a flat, furnishing
//                  it, and later perhaps buying a home. Each owns its pages.
//   Shared tools — reference material more than one project leans on (areas,
//                  your journal). They sit outside the projects so a new
//                  project can use them without copying them.
//
// The sidebar and the home page both read this file, so they always agree.
// To add a project: add an entry to PROJECTS with its
// pages. That's it for navigation; give the home page counts for it in
// /api/summary when there is data to count.

/** The app's name. It started as a London flat search; it now covers renting,
 *  buying and furnishing anywhere, so the name says what it's for, not where. */
export const APP_NAME = "Home research";

export interface NavPage {
  href: string;
  label: string;
  /** Other routes that count as being "on" this page (e.g. the Areas tabs). */
  also?: string[];
}

export interface NavProject {
  id: string;
  label: string;
  /** One line on the home page saying what this project is deciding. */
  question: string;
  pages: NavPage[];
}

export const PROJECTS: NavProject[] = [
  {
    id: "renting",
    label: "Renting",
    question: "Which flat, and when to move",
    pages: [
      { href: "/flats", label: "Flats" },
      { href: "/apartments", label: "Buildings" },
    ],
  },
  {
    id: "buying",
    label: "Buying",
    question: "Where a 2-bed near a good station is affordable",
    pages: [{ href: "/buying", label: "Homes for sale" }],
  },
  {
    id: "furnishing",
    label: "Furnishing",
    question: "What goes in it, and what it all costs",
    pages: [
      { href: "/beds", label: "Beds" },
      { href: "/mattresses", label: "Mattresses" },
      { href: "/sofas", label: "Sofas" },
      { href: "/sofa-beds", label: "Sofa beds" },
      { href: "/consoles", label: "TV units" },
    ],
  },
];

/** The Areas tool is several views of the same neighbourhoods, shown as tabs. */
export const AREA_TABS: NavPage[] = [
  { href: "/map", label: "Map" },
  { href: "/research", label: "Profiles" },
  { href: "/rankings", label: "Rankings" },
  { href: "/compare", label: "Compare" },
];

export const SHARED: NavPage[] = [
  { href: "/map", label: "Areas", also: AREA_TABS.map((t) => t.href) },
  { href: "/journal", label: "Journal" },
];

export const SETTINGS: NavPage = { href: "/settings", label: "Settings" };

function matches(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isPageActive(pathname: string, page: NavPage) {
  return [page.href, ...(page.also ?? [])].some((h) => matches(pathname, h));
}

export function projectFor(pathname: string): NavProject | undefined {
  return PROJECTS.find((p) => p.pages.some((page) => isPageActive(pathname, page)));
}

/** The label of whatever page you're on, for the mobile breadcrumb. */
export function currentLabel(pathname: string): string | null {
  if (pathname === "/") return null;
  for (const p of PROJECTS) {
    const page = p.pages.find((pg) => isPageActive(pathname, pg));
    if (page) return `${p.label} / ${page.label}`;
  }
  const shared = [...SHARED, SETTINGS].find((pg) => isPageActive(pathname, pg));
  return shared?.label ?? null;
}
