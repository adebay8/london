"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./ThemeProvider";

const NAV_ITEMS = [
  { href: "/map", label: "Map & Select", icon: "🗺️" },
  { href: "/research", label: "Research", icon: "🔬" },
  { href: "/compare", label: "Compare", icon: "⚖️" },
  { href: "/journal", label: "Journal", icon: "📓" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  return (
    <nav className="flex h-screen w-16 flex-col items-center gap-2 border-r border-[var(--border-sidebar)] bg-[var(--bg-sidebar)] py-4">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg transition-colors ${
              isActive
                ? "bg-[var(--bg-sidebar-item-active)] text-white"
                : "bg-[var(--bg-sidebar-item)] text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-sidebar-hover)]"
            }`}
          >
            {item.icon}
          </Link>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings */}
      <Link
        href="/settings"
        title="Settings"
        className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg transition-colors ${
          pathname.startsWith("/settings")
            ? "bg-[var(--bg-sidebar-item-active)] text-white"
            : "bg-[var(--bg-sidebar-item)] text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-sidebar-hover)]"
        }`}
      >
        ⚙️
      </Link>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-lg transition-colors bg-[var(--bg-sidebar-item)] text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-sidebar-hover)]"
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>
    </nav>
  );
}
