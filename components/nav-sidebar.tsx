"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGaugeHigh, faBoxesStacked, faReceipt, faListCheck, faGear, faPhotoFilm } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS: { href: string; label: string; icon: IconDefinition }[] = [
  { href: "/", label: "Dashboard", icon: faGaugeHigh },
  { href: "/units", label: "Pipeline", icon: faBoxesStacked },
  { href: "/receipts", label: "Receipts", icon: faReceipt },
  { href: "/lists", label: "Lists", icon: faListCheck },
  { href: "/settings", label: "Settings", icon: faGear },
  { href: "/imagecropper", label: "Image Cropper", icon: faPhotoFilm },
];

export function NavSidebar() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
        {/* Plain <img>, not next/image — this is a small fixed-size static
            asset, so the optimizer pipeline (and its SVG restrictions) buys
            us nothing here. */}
        <img src="/logo.svg" alt="Tech Rebuilt logo" width={30} height={30} className="h-[30px] w-[30px] rounded-md" />
        <div>
          <p className="text-sm font-semibold tracking-tight text-primary">Tech Rebuilt</p>
          <p className="text-xs text-muted-foreground">Inventory intelligence</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <FontAwesomeIcon icon={item.icon} className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border p-3">
        <ThemeToggle />
      </div>
    </aside>
  );
}
