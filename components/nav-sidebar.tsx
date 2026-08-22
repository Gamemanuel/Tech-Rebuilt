"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Boxes, Receipt, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/units", label: "Pipeline", icon: Boxes },
  { href: "/receipts", label: "Receipts", icon: Receipt },
  { href: "/vendors", label: "Vendors", icon: Building2 },
];

export function NavSidebar() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <aside className="sticky top-3 hidden h-[calc(100vh-1.5rem)] w-60 shrink-0 flex-col rounded-[calc(var(--radius)+0.35rem)] border border-border/70 bg-card/75 p-4 shadow-[0_15px_35px_hsl(var(--foreground)/0.06)] backdrop-blur-sm md:flex">
      <div className="mb-6 border-b border-border/70 px-2 pb-4">
        <p className="font-mono text-sm font-semibold tracking-tight text-primary">refurb_tracker</p>
        <p className="mt-1 text-xs text-muted-foreground">Inventory intelligence</p>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/15 text-primary font-medium shadow-sm shadow-primary/10"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
