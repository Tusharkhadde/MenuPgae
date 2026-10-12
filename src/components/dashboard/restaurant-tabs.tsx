"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  ["menu", "Menu"],
  ["details", "Business info"],
  ["design", "Design"],
  ["qr", "QR codes"],
  ["analytics", "Analytics"],
  ["settings", "Settings"],
] as const;

export function RestaurantTabs({ id }: { id: string }) {
  const pathname = usePathname();
  return (
    <nav className="no-print no-scrollbar -mx-4 mt-6 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0" aria-label="Restaurant sections">
      {TABS.map(([slug, label]) => {
        const href = `/dashboard/r/${id}/${slug}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={slug}
            href={href}
            className={cn(
              "relative shrink-0 px-3 py-2.5 text-sm transition-colors",
              active ? "font-medium text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
