"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./ThemeProvider";

// Grouped rather than one flat list. Every vertical used to be added as a peer
// of every other, so by the time there were nine the rail read as an
// undifferentiated stack and had no room left. The groups match the bands on
// the home page, so the two navigation surfaces tell the same story.
//
// Kept as a divider between groups rather than a text caption: at 80px wide a
// caption costs a whole row of vertical space, which is the thing in short
// supply. The rail also scrolls now, so adding a tenth destination degrades
// gracefully instead of pushing Settings off the bottom.

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_GROUPS: NavItem[][] = [
  [{ href: "/flats", label: "Flats", icon: "🔑" }, { href: "/compare", label: "Compare", icon: "⚖️" }],
  [
    { href: "/map", label: "Map", icon: "🗺️" },
    { href: "/research", label: "Research", icon: "🔬" },
    { href: "/rankings", label: "Rankings", icon: "🏆" },
    { href: "/apartments", label: "Buildings", icon: "🏢" },
  ],
  [
    { href: "/beds", label: "Beds", icon: "🛏️" },
    { href: "/consoles", label: "TV unit", icon: "📺" },
    { href: "/sofas", label: "Sofas", icon: "🛋️" },
  ],
  [{ href: "/journal", label: "Journal", icon: "📓" }],
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  function navClass(href: string, exact = false) {
    const isActive = exact ? pathname === href : pathname.startsWith(href);
    return `flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-center transition-colors ${
      isActive
        ? "bg-[var(--bg-sidebar-item-active)] text-white"
        : "text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-sidebar-hover)]"
    }`;
  }

  return (
    <nav className="flex h-screen w-20 flex-col items-center gap-1 border-r border-[var(--border-sidebar)] bg-[var(--bg-sidebar)] px-1 py-3">
      {/* Home is matched exactly — every other route would match a "/" prefix. */}
      <Link href="/" title="Home" className={navClass("/", true)}>
        <span className="text-lg">🏠</span>
        <span className="text-[10px] font-medium leading-tight">Home</span>
      </Link>

      <div className="min-h-0 w-full flex-1 space-y-1 overflow-y-auto">
        {NAV_GROUPS.map((group, i) => (
          <div key={group[0].href} className="space-y-1">
            {i > 0 && <div className="mx-2 my-1.5 border-t border-[var(--border-sidebar)]" />}
            {group.map((item) => (
              <Link key={item.href} href={item.href} title={item.label} className={navClass(item.href)}>
                <span className="text-lg">{item.icon}</span>
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="mx-2 w-full border-t border-[var(--border-sidebar)]" />

      <Link href="/settings" title="Settings" className={navClass("/settings")}>
        <span className="text-lg">⚙️</span>
        <span className="text-[10px] font-medium leading-tight">Settings</span>
      </Link>

      <button
        onClick={toggle}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-center text-[var(--text-sidebar)] transition-colors hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-sidebar-hover)]"
      >
        <span className="text-lg">{theme === "dark" ? "☀️" : "🌙"}</span>
        <span className="text-[10px] font-medium leading-tight">{theme === "dark" ? "Light" : "Dark"}</span>
      </button>
    </nav>
  );
}
