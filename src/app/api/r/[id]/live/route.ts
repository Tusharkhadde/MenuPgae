import { NextResponse } from "next/server";
import { getSessionUser, findAccessibleRestaurant, getPlanForUser } from "@/server/session";
import { getLiveFeed } from "@/server/orders";
import { ordersSince } from "@/lib/limits";

export const dynamic = "force-dynamic";

/** Polled by the orders inbox and kitchen display (every few seconds). Staff and up. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const found = await findAccessibleRestaurant(user, id);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const plan = await getPlanForUser(found.restaurant.ownerId);
  const feed = await getLiveFeed(found.restaurant, ordersSince(plan));
  return NextResponse.json(feed, { headers: { "Cache-Control": "private, no-store" } });
}
