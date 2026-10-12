import { ExternalLinkIcon } from "lucide-react";
import { requireOwnedRestaurant } from "@/server/session";
import { RestaurantTabs } from "@/components/dashboard/restaurant-tabs";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/dashboard/copy-button";
import { appUrl } from "@/lib/env";

export default async function RestaurantLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { restaurant } = await requireOwnedRestaurant(id);
  const publicUrl = `${appUrl()}/r/${restaurant.slug}`;
  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="no-print flex flex-col gap-4 pt-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{restaurant.name}</h1>
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
      <RestaurantTabs id={restaurant.id} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
