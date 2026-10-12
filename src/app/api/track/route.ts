import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { restaurants } from "@/lib/db/schema";
import { trackSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isBot, recordEvent } from "@/server/analytics";
import { sanitizeTable } from "@/lib/whatsapp";

/** Cookie-less event beacon from public menu pages. Always answers 204 so it never blocks the page. */
export async function POST(request: Request) {
  const ok = new NextResponse(null, { status: 204 });
  if (isBot(request.headers.get("user-agent"))) return ok;
  const ip = clientIp(request.headers);
  if (!rateLimit(`track:${ip}`, 60, 60_000).ok) return new NextResponse(null, { status: 429 });

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 8_000) return ok;
    body = JSON.parse(text);
  } catch {
    return ok;
  }
  const parsed = trackSchema.safeParse(body);
  if (!parsed.success) return ok;
  const { r, type, table, items } = parsed.data;

  // One view per visitor/restaurant/minute is plenty — stops refresh-spam inflating numbers.
  if (type === "view" && !rateLimit(`view:${ip}:${r}`, 1, 60_000).ok) return ok;

  try {
    const db = await getDb();
    const [row] = await db.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.id, r)).limit(1);
    if (!row) return ok;
    const t = sanitizeTable(table);
    await recordEvent(row.id, type, {
      ...(t ? { table: t } : {}),
      ...(type === "whatsapp" && items ? { items } : {}),
    });
  } catch (err) {
    console.error("[menupage] track failed", err);
  }
  return ok;
}
