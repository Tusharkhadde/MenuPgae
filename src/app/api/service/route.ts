import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { serviceRequests } from "@/lib/db/schema";
import { sanitizeTable } from "@/lib/whatsapp";
import { rateLimit } from "@/lib/rate-limit";
import { loadPublicRestaurant } from "@/server/orders";
import { guardPublicPost, jsonError } from "@/server/public-api";

const schema = z.object({ r: z.string().min(1).max(64), table: z.string().max(12), kind: z.enum(["waiter", "bill"]) });

/** Guest taps "Call waiter" / "Request bill" at a table → shows live in the dashboard. */
export async function POST(request: Request) {
  const g = await guardPublicPost(request, "service", 10, 10 * 60_000, 2_000);
  if ("error" in g) return g.error;
  const parsed = schema.safeParse(g.body);
  const table = parsed.success ? sanitizeTable(parsed.data.table) : null;
  if (!parsed.success || !table) return jsonError("Scan the QR code on your table first.");
  // One request per table and kind per minute is plenty.
  if (!rateLimit(`service:${parsed.data.r}:${table}:${parsed.data.kind}`, 1, 60_000).ok) return NextResponse.json({ ok: true, duplicate: true });
  const found = await loadPublicRestaurant(parsed.data.r);
  if (!found || !found.restaurant.serviceRequestsEnabled) return jsonError("Not available on this menu.", 404);
  const db = await getDb();
  await db.insert(serviceRequests).values({ restaurantId: found.restaurant.id, table, kind: parsed.data.kind });
  return NextResponse.json({ ok: true });
}
