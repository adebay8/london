import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "London Neighbourhood Research",
  description: "Research and compare London neighbourhoods for apartment hunting",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Inline script to apply saved theme before React hydrates — prevents flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="flex h-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)]">
        <ThemeProvider>
          <Sidebar />
          <main className="flex-1 overflow-auto">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
