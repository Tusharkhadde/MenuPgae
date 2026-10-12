import "server-only";
import { and, asc, desc, eq, gte, isNull, max, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { categories, coupons, items, orders, restaurants, serviceRequests, type Order, type Restaurant } from "@/lib/db/schema";
import { getPlanForUser } from "@/server/session";
import { hasFeature, limitsFor } from "@/lib/limits";
import { normalizeOptions } from "@/lib/options";
import { OrderError, priceOrder, type PlaceOrderInput, type PricedOrder, type PricingItem } from "@/lib/order";
import { localDate, normalizeCouponCode, type CouponRule } from "@/lib/schedule";
import { sanitizeTable } from "@/lib/whatsapp";
import type { PlanId } from "@/config/plans";

/** A published, not-paused restaurant plus its owner's plan — or null. */
export async function loadPublicRestaurant(restaurantId: string): Promise<{ restaurant: Restaurant; plan: PlanId } | null> {
  const db = await getDb();
  const [r] = await db
    .select()
    .from(restaurants)
    .where(and(eq(restaurants.id, restaurantId), eq(restaurants.published, true)))
    .limit(1);
  if (!r) return null;
  const plan = await getPlanForUser(r.ownerId);
  const siblings = await db.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.ownerId, r.ownerId)).orderBy(asc(restaurants.createdAt));
  if (siblings.findIndex((s) => s.id === r.id) >= limitsFor(plan).restaurants) return null;
  return { restaurant: r, plan };
}

async function pricingItems(restaurantId: string, plan: PlanId): Promise<Map<string, PricingItem>> {
  const db = await getDb();
  const [cats, its] = await Promise.all([
    db.select({ id: categories.id, availability: categories.availability }).from(categories).where(eq(categories.restaurantId, restaurantId)).orderBy(asc(categories.position), asc(categories.createdAt)),
    db.select().from(items).where(eq(items.restaurantId, restaurantId)).orderBy(asc(items.position), asc(items.createdAt)),
  ]);
  const catAvail = new Map(cats.map((c) => [c.id, c.availability ?? null]));
  const catOrder = new Map(cats.map((c, i) => [c.id, i]));
  // Same "paused after downgrade" budget as the public page: items beyond the limit can't be ordered.
  const sorted = [...its].sort((a, b) => (catOrder.get(a.categoryId) ?? 0) - (catOrder.get(b.categoryId) ?? 0));
  const allowed = sorted.slice(0, limitsFor(plan).itemsPerRestaurant);
  return new Map(
    allowed.map((i) => [
      i.id,
      {
        id: i.id,
        name: i.name,
        priceMinor: i.priceMinor,
        soldOut: i.soldOut,
        options: normalizeOptions(i.options),
        happyHour: i.happyHour,
        availability: i.availability ?? null,
        categoryAvailability: catAvail.get(i.categoryId) ?? null,
      },
    ]),
  );
}

async function findCoupon(restaurantId: string, code: string): Promise<(CouponRule & { id: string }) | null> {
  const db = await getDb();
  const [c] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.restaurantId, restaurantId), eq(coupons.code, normalizeCouponCode(code))))
    .limit(1);
  return c ? { ...c, kind: c.kind === "amount" ? "amount" : "percent" } : null;
}

export async function quoteOrder(input: PlaceOrderInput, now = new Date()): Promise<{ restaurant: Restaurant; plan: PlanId; priced: PricedOrder; couponId: string | null }> {
  const found = await loadPublicRestaurant(input.r);
  if (!found) throw new OrderError("This menu isn't taking orders right now.");
  const { restaurant, plan } = found;
  const couponsAllowed = hasFeature(plan, "coupons");
  const code = normalizeCouponCode(input.coupon);
  const coupon = code && couponsAllowed ? await findCoupon(restaurant.id, code) : null;
  const priced = priceOrder(
    { lines: input.lines, coupon: code || null },
    {
      items: await pricingItems(restaurant.id, plan),
      timezone: restaurant.timezone,
      happyHour: hasFeature(plan, "happyHour") ? (restaurant.happyHour ?? null) : null,
      now,
      coupon,
      couponsAllowed,
      today: localDate(now, restaurant.timezone),
    },
  );
  return { restaurant, plan, priced, couponId: coupon?.id ?? null };
}

const REF_RE = /^[A-Z0-9]{4,8}$/;

export async function placeOrder(input: PlaceOrderInput & { ref?: string | null }, now = new Date()): Promise<Order> {
  const { restaurant, priced, couponId } = await quoteOrder(input, now);
  if (!restaurant.ordersEnabled) throw new OrderError("This menu isn't taking orders right now.");
  const db = await getDb();
  const day = localDate(now, restaurant.timezone);
  const ref = input.ref && REF_RE.test(input.ref) ? input.ref : null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const [{ n }] = await tx
          .select({ n: max(orders.number) })
          .from(orders)
          .where(and(eq(orders.restaurantId, restaurant.id), eq(orders.day, day)));
        const [row] = await tx
          .insert(orders)
          .values({
            restaurantId: restaurant.id,
            day,
            number: (n ?? 0) + 1,
            ref,
            table: sanitizeTable(input.table),
            customerName: input.name?.trim() || null,
            customerPhone: input.phone?.trim() || null,
            note: input.note?.trim() || null,
            lines: priced.lines,
            currency: restaurant.currency,
            subtotalMinor: priced.subtotalMinor,
            discountMinor: priced.discountMinor,
            totalMinor: priced.totalMinor,
            couponCode: priced.couponCode,
          })
          .returning();
        if (couponId) await tx.update(coupons).set({ uses: sql`${coupons.uses} + 1` }).where(eq(coupons.id, couponId));
        return row;
      });
    } catch (err) {
      // Two orders raced for the same number: retry with the next one.
      const code = (err as { code?: string; cause?: { code?: string } })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
      if (code === "23505" && attempt < 3) continue;
      throw err;
    }
  }
  throw new OrderError("Couldn't place the order. Please try again.");
}

/* ----------------------------------------------------------------- Dashboard */

export type LiveOrder = Pick<
  Order,
  "id" | "number" | "ref" | "table" | "customerName" | "customerPhone" | "note" | "lines" | "currency" | "subtotalMinor" | "discountMinor" | "totalMinor" | "couponCode" | "status" | "paid" | "day"
> & { createdAt: string };

export type LiveRequest = { id: string; table: string; kind: "waiter" | "bill"; createdAt: string };

export type LiveFeed = {
  orders: LiveOrder[];
  requests: LiveRequest[];
  today: { day: string; count: number; revenueMinor: number; paidMinor: number; open: number };
  serverTime: string;
};

function toLive(o: Order): LiveOrder {
  return {
    id: o.id,
    number: o.number,
    ref: o.ref,
    table: o.table,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    note: o.note,
    lines: o.lines,
    currency: o.currency,
    subtotalMinor: o.subtotalMinor,
    discountMinor: o.discountMinor,
    totalMinor: o.totalMinor,
    couponCode: o.couponCode,
    status: o.status,
    paid: o.paid,
    day: o.day,
    createdAt: o.createdAt.toISOString(),
  };
}

export async function todayTotals(restaurant: Pick<Restaurant, "id" | "timezone">, now = new Date()) {
  const db = await getDb();
  const day = localDate(now, restaurant.timezone);
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::int`,
      paid: sql<number>`coalesce(sum(case when ${orders.paid} then ${orders.totalMinor} else 0 end), 0)::int`,
      open: sql<number>`count(*) filter (where ${orders.status} in ('new','preparing','ready'))::int`,
    })
    .from(orders)
    .where(and(eq(orders.restaurantId, restaurant.id), eq(orders.day, day), ne(orders.status, "cancelled")));
  return { day, count: row?.count ?? 0, revenueMinor: row?.revenue ?? 0, paidMinor: row?.paid ?? 0, open: row?.open ?? 0 };
}

/** Orders for the inbox: everything still in progress plus the history window. */
export async function getLiveFeed(restaurant: Pick<Restaurant, "id" | "timezone">, since: Date, now = new Date()): Promise<LiveFeed> {
  const db = await getDb();
  const [rows, reqs, today] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(and(eq(orders.restaurantId, restaurant.id), gte(orders.createdAt, since)))
      .orderBy(desc(orders.createdAt))
      .limit(300),
    db
      .select()
      .from(serviceRequests)
      .where(and(eq(serviceRequests.restaurantId, restaurant.id), isNull(serviceRequests.resolvedAt), gte(serviceRequests.createdAt, new Date(now.getTime() - 12 * 3_600_000))))
      .orderBy(asc(serviceRequests.createdAt))
      .limit(100),
    todayTotals(restaurant, now),
  ]);
  return {
    orders: rows.map(toLive),
    requests: reqs.map((r) => ({ id: r.id, table: r.table, kind: r.kind === "bill" ? "bill" : "waiter", createdAt: r.createdAt.toISOString() })),
    today,
    serverTime: now.toISOString(),
  };
}
