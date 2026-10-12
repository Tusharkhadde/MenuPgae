import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { feedback, orders } from "@/lib/db/schema";
import { sanitizeTable } from "@/lib/whatsapp";
import { feedbackRoute } from "@/lib/reviews";
import { loadPublicRestaurant } from "@/server/orders";
import { guardPublicPost, jsonError } from "@/server/public-api";

const schema = z.object({
  r: z.string().min(1).max(64),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).nullable().optional(),
  name: z.string().trim().max(60).nullable().optional(),
  contact: z.string().trim().max(100).nullable().optional(),
  orderId: z.string().max(64).nullable().optional(),
  table: z.string().max(12).nullable().optional(),
});

/** Reviews funnel: every rating is saved; 4–5★ guests are pointed to Google reviews. */
export async function POST(request: Request) {
  const g = await guardPublicPost(request, "feedback", 5, 10 * 60_000, 4_000);
  if ("error" in g) return g.error;
  const parsed = schema.safeParse(g.body);
  if (!parsed.success) return jsonError("Please pick a rating.");
  const found = await loadPublicRestaurant(parsed.data.r);
  if (!found || !found.restaurant.feedbackEnabled) return jsonError("Not available on this menu.", 404);
  const db = await getDb();
  let orderId: string | null = null;
  if (parsed.data.orderId) {
    const [o] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.id, parsed.data.orderId), eq(orders.restaurantId, found.restaurant.id))).limit(1);
    orderId = o?.id ?? null;
  }
  await db.insert(feedback).values({
    restaurantId: found.restaurant.id,
    orderId,
    rating: parsed.data.rating,
    comment: parsed.data.comment || null,
    name: parsed.data.name || null,
    contact: parsed.data.contact || null,
    table: sanitizeTable(parsed.data.table),
  });
  const route = feedbackRoute(parsed.data.rating, found.restaurant.googleReviewsUrl);
  return NextResponse.json({ ok: true, route, googleReviewsUrl: route === "google" ? found.restaurant.googleReviewsUrl : null });
}
