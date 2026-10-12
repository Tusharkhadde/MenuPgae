import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { events, items, type EventType } from "@/lib/db/schema";

export async function recordEvent(restaurantId: string, type: EventType, meta?: (typeof events.$inferInsert)["meta"]) {
  const db = await getDb();
  await db.insert(events).values({ restaurantId, type, day: new Date().toISOString().slice(0, 10), meta: meta ?? null });
}

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse|pingdom|curl|wget/i;
export function isBot(ua: string | null): boolean {
  return !ua || BOT_RE.test(ua);
}

export type AnalyticsSummary = {
  days: { day: string; view: number; scan: number; whatsapp: number }[];
  totals: { view: number; scan: number; whatsapp: number };
  topItems: { id: string; name: string; qty: number }[];
  tables: { table: string; count: number }[];
};

export async function getAnalytics(restaurantId: string, since: string, until = new Date()): Promise<AnalyticsSummary> {
  const db = await getDb();
  const rows = await db
    .select({ day: events.day, type: events.type, count: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.restaurantId, restaurantId), gte(events.day, since)))
    .groupBy(events.day, events.type);

  const days: AnalyticsSummary["days"] = [];
  const start = new Date(`${since}T00:00:00Z`);
  const end = new Date(until.toISOString().slice(0, 10) + "T00:00:00Z");
  for (let d = start; d <= end; d = new Date(d.getTime() + 86_400_000)) {
    days.push({ day: d.toISOString().slice(0, 10), view: 0, scan: 0, whatsapp: 0 });
  }
  const byDay = new Map(days.map((d) => [d.day, d]));
  const totals = { view: 0, scan: 0, whatsapp: 0 };
  for (const r of rows) {
    const bucket = byDay.get(String(r.day));
    if (bucket && r.type in totals) {
      bucket[r.type] += r.count;
      totals[r.type] += r.count;
    }
  }

  const orderRows = await db
    .select({ meta: events.meta })
    .from(events)
    .where(and(eq(events.restaurantId, restaurantId), gte(events.day, since), eq(events.type, "whatsapp")))
    .limit(5000);
  const qty = new Map<string, number>();
  const tableCounts = new Map<string, number>();
  for (const { meta } of orderRows) {
    for (const it of meta?.items ?? []) qty.set(it.id, (qty.get(it.id) ?? 0) + it.qty);
    if (meta?.table) tableCounts.set(meta.table, (tableCounts.get(meta.table) ?? 0) + 1);
  }
  const scanRows = await db
    .select({ table: sql<string | null>`${events.meta}->>'table'`, count: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.restaurantId, restaurantId), gte(events.day, since), eq(events.type, "scan")))
    .groupBy(sql`${events.meta}->>'table'`);
  for (const s of scanRows) if (s.table) tableCounts.set(s.table, (tableCounts.get(s.table) ?? 0) + s.count);

  const names = new Map(
    (await db.select({ id: items.id, name: items.name }).from(items).where(eq(items.restaurantId, restaurantId))).map((i) => [i.id, i.name]),
  );
  const topItems = [...qty.entries()]
    .filter(([id]) => names.has(id))
    .map(([id, q]) => ({ id, name: names.get(id)!, qty: q }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);
  const tables = [...tableCounts.entries()]
    .map(([table, count]) => ({ table, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return { days, totals, topItems, tables };
}
