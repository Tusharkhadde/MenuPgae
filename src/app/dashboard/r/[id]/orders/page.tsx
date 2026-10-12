import type { Metadata } from "next";
import { requireRestaurantAccess, getPlanForUser } from "@/server/session";
import { getLiveFeed } from "@/server/orders";
import { hasFeature, limitsFor, ordersSince } from "@/lib/limits";
import { OrdersInbox } from "@/components/dashboard/orders-inbox";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { restaurant, role } = await requireRestaurantAccess(id, "staff");
  const plan = await getPlanForUser(restaurant.ownerId);
  const feed = await getLiveFeed(restaurant, ordersSince(plan));
  return (
    <OrdersInbox
      restaurantId={restaurant.id}
      currency={restaurant.currency}
      slug={restaurant.slug}
      initial={feed}
      historyDays={limitsFor(plan).orderHistoryDays}
      kitchenAllowed={hasFeature(plan, "kitchenDisplay")}
      ordersEnabled={restaurant.ordersEnabled}
      isOwner={role === "owner"}
    />
  );
}
