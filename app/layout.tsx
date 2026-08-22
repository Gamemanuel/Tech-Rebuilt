import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NavSidebar } from "@/components/nav-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Refurb Tracker",
  description: "Inventory, repairs, and margins for refurbished game systems",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${mono.variable} font-sans antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var t=localStorage.getItem("theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.classList.toggle("dark",t==="dark");}catch(e){}})();',
          }}
        />
        <div className="mx-auto flex min-h-screen w-full max-w-[1400px] gap-4 p-3 md:p-5">
          <NavSidebar />
          <main className="relative flex-1 rounded-[calc(var(--radius)+0.35rem)] border border-border/70 bg-card/75 p-6 shadow-[0_15px_45px_hsl(var(--foreground)/0.08)] backdrop-blur-sm md:p-8">
            <div className="absolute right-4 top-4">
              <ThemeToggle />
            </div>
            <div className="mx-auto w-full max-w-6xl pt-10 md:pt-2">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
