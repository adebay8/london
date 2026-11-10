import type { Metadata } from "next";
import { Literata, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import ThemeProvider from "@/components/ThemeProvider";

// Throughline's two voices: the grotesk for structure (titles, labels,
// numbers, controls) and Literata for anything you read as prose.
const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-schibsted",
  display: "swap",
});
const serif = Literata({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-literata",
  display: "swap",
});

export const metadata: Metadata = {
  title: "London Neighbourhood Research",
  description: "Research and compare London neighbourhoods for apartment hunting",
};

// Applies the saved theme (or the system one) before React hydrates, so the
// page never flashes the wrong colours.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||((t===null||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex h-dvh flex-col overflow-hidden bg-[var(--paper)] font-sans text-[var(--ink)] md:flex-row">
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only z-50 rounded-full bg-[var(--action)] px-4 py-2 text-sm font-semibold text-[var(--on-action)] focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
          >
            Skip to content
          </a>
          <Sidebar />
          <main id="main" className="min-h-0 flex-1 overflow-auto">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
