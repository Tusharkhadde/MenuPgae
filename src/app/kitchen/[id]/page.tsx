import type { Metadata } from "next";
import { hoursAgo } from "@/lib/time";
import Link from "next/link";
import { requireRestaurantAccess, getPlanForUser } from "@/server/session";
import { getLiveFeed } from "@/server/orders";
import { hasFeature } from "@/lib/limits";
import { KitchenDisplay } from "@/components/dashboard/kitchen-display";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Kitchen display", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function KitchenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { restaurant } = await requireRestaurantAccess(id, "staff");
  const plan = await getPlanForUser(restaurant.ownerId);
  if (!hasFeature(plan, "kitchenDisplay")) {
    return (
      <main className="grid min-h-dvh place-items-center bg-neutral-950 p-6 text-center text-white">
        <div className="max-w-sm">
          <h1 className="text-2xl font-semibold">Kitchen display is a Pro feature</h1>
          <p className="mt-2 text-neutral-400">A full-screen, tap-to-bump order board for the kitchen tablet. Your orders inbox works on every plan.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild><Link href="/dashboard/billing">See Pro</Link></Button>
            <Button asChild variant="secondary"><Link href={`/dashboard/r/${restaurant.id}/orders`}>Back to orders</Link></Button>
          </div>
        </div>
      </main>
    );
  }
  const feed = await getLiveFeed(restaurant, hoursAgo(24));
  return <KitchenDisplay restaurantId={restaurant.id} name={restaurant.name} initial={feed} />;
}
