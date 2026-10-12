import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { restaurants } from "@/lib/db/schema";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isBot, recordEvent } from "@/server/analytics";
import { sanitizeTable } from "@/lib/whatsapp";

/** QR codes point here: count the scan (no cookies), then send the guest to the menu. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(request.url);
  const table = sanitizeTable(url.searchParams.get("t"));
  const target = new URL(`/r/${encodeURIComponent(slug.toLowerCase())}`, url.origin);
  if (table) target.searchParams.set("t", table);

  try {
    const ip = clientIp(request.headers);
    if (!isBot(request.headers.get("user-agent")) && rateLimit(`scan:${ip}:${slug}`, 3, 60_000).ok) {
      const db = await getDb();
      const [row] = await db.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.slug, slug.toLowerCase())).limit(1);
      if (row) await recordEvent(row.id, "scan", table ? { table } : undefined);
    }
  } catch (err) {
    console.error("[menupage] scan tracking failed", err);
  }
  return NextResponse.redirect(target, { status: 307, headers: { "Cache-Control": "no-store" } });
}
