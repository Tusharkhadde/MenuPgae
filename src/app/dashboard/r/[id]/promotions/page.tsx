import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { requireRestaurantAccess, getPlanForUser } from "@/server/session";
import { getDb } from "@/lib/db";
import { coupons } from "@/lib/db/schema";
import { hasFeature } from "@/lib/limits";
import { PromotionsPanel } from "@/components/dashboard/promotions-panel";

export const metadata: Metadata = { title: "Promotions" };

export default async function PromotionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { restaurant: r } = await requireRestaurantAccess(id, "owner");
  const plan = await getPlanForUser(r.ownerId);
  const db = await getDb();
  const list = await db.select().from(coupons).where(eq(coupons.restaurantId, r.id)).orderBy(desc(coupons.createdAt));
  return (
    <PromotionsPanel
      restaurantId={r.id}
      currency={r.currency}
      promoBanner={r.promoBanner}
      happyHour={r.happyHour ?? null}
      happyHourAllowed={hasFeature(plan, "happyHour")}
      couponsAllowed={hasFeature(plan, "coupons")}
      coupons={list.map((c) => ({ id: c.id, code: c.code, kind: c.kind, value: c.value, minOrderMinor: c.minOrderMinor, active: c.active, expiresAt: c.expiresAt, maxUses: c.maxUses, uses: c.uses }))}
    />
  );
}
