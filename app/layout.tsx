import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "@/lib/fontawesome";
import { NavSidebar } from "@/components/nav-sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Tech Rebuilt",
  description: "Inventory, repairs, and margins for refurbished game systems",
  icons: {
    icon: "/logo.png",
  },
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
      {/* No outer max-width/padding/border here on purpose — sidebar and
            main content both run flush to the viewport edges. */}
      <div className="flex min-h-screen w-full">
        <NavSidebar />
        <main className="min-w-0 flex-1 bg-background">
          <div className="mx-auto w-full max-w-6xl px-6 py-8 md:px-10 md:py-10">
            {children}
          </div>
        </main>
      </div>
      </body>
      </html>
  );
}
