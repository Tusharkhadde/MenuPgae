import { ExternalLinkIcon } from "lucide-react";
import { and, count, eq } from "drizzle-orm";
import { requireRestaurantAccess } from "@/server/session";
import { RestaurantTabs } from "@/components/dashboard/restaurant-tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/dashboard/copy-button";
import { appUrl } from "@/lib/env";
import { getDb } from "@/lib/db";
import { reservations } from "@/lib/db/schema";
import { tabsForRole } from "@/lib/roles";

export default async function RestaurantLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { restaurant, role } = await requireRestaurantAccess(id, "staff");
  const publicUrl = `${appUrl()}/r/${restaurant.slug}`;
  const db = await getDb();
  const [{ n: pendingReservations }] = await db
    .select({ n: count() })
    .from(reservations)
    .where(and(eq(reservations.restaurantId, restaurant.id), eq(reservations.status, "pending")));
  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="no-print flex flex-col gap-4 pt-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 truncate text-2xl font-semibold tracking-tight">
            {restaurant.name}
            {role !== "owner" && <Badge variant="secondary" className="capitalize">{role}</Badge>}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span className={restaurant.published ? "size-2 rounded-full bg-emerald-500" : "size-2 rounded-full bg-amber-500"} />
            {restaurant.published ? "Live at" : "Unpublished ·"}
            <span className="truncate font-mono text-xs">{publicUrl.replace(/^https?:\/\//, "")}</span>
            <CopyButton value={publicUrl} />
          </div>
        </div>
        <Button asChild variant="outline">
          <a href={`/r/${restaurant.slug}`} target="_blank" rel="noopener noreferrer">
            View live page <ExternalLinkIcon />
          </a>
        </Button>
      </div>
      <RestaurantTabs id={restaurant.id} allowed={tabsForRole(role)} badges={{ engage: pendingReservations }} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
