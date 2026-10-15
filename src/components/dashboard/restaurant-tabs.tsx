"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  ["overview", "Overview", ""],
  ["orders", "Orders", "/orders"],
  ["menu", "Menu", "/menu"],
  ["engage", "Guests", "/guests"],
  ["growth", "Promotions", "/promotions"],
  ["details", "Business info", "/details"],
  ["design", "Design", "/design"],
  ["qr", "QR & sharing", "/qr"],
  ["analytics", "Analytics", "/analytics"],
  ["team", "Team", "/team"],
  ["settings", "Settings", "/settings"],
] as const;

export function RestaurantTabs({ id, allowed, badges }: { id: string; allowed: string[]; badges?: Partial<Record<string, number>> }) {
  const pathname = usePathname();
  const base = `/dashboard/r/${id}`;
  return (
    <nav className="no-print no-scrollbar -mx-4 mt-6 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0" aria-label="Restaurant sections">
      {TABS.filter(([key]) => allowed.includes(key)).map(([key, label, path]) => {
        const href = `${base}${path}`;
        const active = path ? pathname.startsWith(href) : pathname === base;
        const badge = badges?.[key];
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm transition-colors",
              active ? "font-medium text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {!!badge && <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground">{badge > 99 ? "99+" : badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
