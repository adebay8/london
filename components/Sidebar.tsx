"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./ThemeProvider";

const NAV_ITEMS = [
  { href: "/map", label: "Map", icon: "🗺️" },
  { href: "/research", label: "Research", icon: "🔬" },
  { href: "/apartments", label: "Apartments", icon: "🏢" },
  { href: "/compare", label: "Compare", icon: "⚖️" },
  { href: "/rankings", label: "Rankings", icon: "🏆" },
  { href: "/journal", label: "Journal", icon: "📓" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  function navClass(href: string) {
    const isActive = pathname.startsWith(href);
    return `flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-center transition-colors ${
      isActive
        ? "bg-[var(--bg-sidebar-item-active)] text-white"
        : "text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-sidebar-hover)]"
    }`;
  }

  return (
    <nav className="flex h-screen w-20 flex-col items-center gap-1 border-r border-[var(--border-sidebar)] bg-[var(--bg-sidebar)] px-1 py-3">
      {NAV_ITEMS.map((item) => (
        <Link key={item.href} href={item.href} title={item.label} className={navClass(item.href)}>
          <span className="text-lg">{item.icon}</span>
          <span className="text-[10px] font-medium leading-tight">{item.label}</span>
        </Link>
      ))}

      <div className="flex-1" />

      <Link href="/settings" title="Settings" className={navClass("/settings")}>
        <span className="text-lg">⚙️</span>
        <span className="text-[10px] font-medium leading-tight">Settings</span>
      </Link>

      <button
        onClick={toggle}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-center transition-colors text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-sidebar-hover)]"
      >
        <span className="text-lg">{theme === "dark" ? "☀️" : "🌙"}</span>
        <span className="text-[10px] font-medium leading-tight">{theme === "dark" ? "Light" : "Dark"}</span>
      </button>
    </nav>
  );
}
