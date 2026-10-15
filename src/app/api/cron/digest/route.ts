import { NextResponse } from "next/server";
import { and, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { events, feedback, items, orders, reservations, restaurants, users } from "@/lib/db/schema";
import { appUrl, env, features } from "@/lib/env";
import { hasFeature } from "@/lib/limits";
import { buildDigest, shouldSendDigest } from "@/lib/digest";
import { getPlanForUser } from "@/server/session";
import { emailShell, escapeHtml, sendEmail } from "@/server/mailer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Weekly owner digest (Vercel Cron, Mondays — see vercel.json).
 * Needs CRON_SECRET (Vercel sends it as a Bearer token) and AUTH_RESEND_KEY; skips cleanly otherwise.
 */
export async function GET(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) return NextResponse.json({ skipped: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(request, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!features.resend()) return NextResponse.json({ skipped: "Email (AUTH_RESEND_KEY) is not configured" });

  const db = await getDb();
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const sinceDay = since.toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const list = await db
    .select({ r: restaurants, email: users.email, isDemo: users.isDemo })
    .from(restaurants)
    .innerJoin(users, eq(users.id, restaurants.ownerId))
    .where(and(eq(restaurants.digestEnabled, true), eq(restaurants.published, true), eq(users.isDemo, false)))
    .limit(500);

  let sent = 0;
  let skipped = 0;
  for (const { r, email } of list) {
    if (!email || !hasFeature(await getPlanForUser(r.ownerId), "weeklyDigest")) {
      skipped++;
      continue;
    }
    const [[ev], [ord], [fb], [pend], orderRows] = await Promise.all([
      db
        .select({ view: sql<number>`count(*) filter (where ${events.type} = 'view')::int`, scan: sql<number>`count(*) filter (where ${events.type} = 'scan')::int` })
        .from(events)
        .where(and(eq(events.restaurantId, r.id), gte(events.day, sinceDay), lt(events.day, today))),
      db
        .select({ n: sql<number>`count(*)::int`, rev: sql<number>`coalesce(sum(${orders.totalMinor}),0)::int` })
        .from(orders)
        .where(and(eq(orders.restaurantId, r.id), gte(orders.createdAt, since), ne(orders.status, "cancelled"))),
      db
        .select({ avg: sql<number | null>`avg(${feedback.rating})::float`, n: sql<number>`count(*)::int`, priv: sql<number>`count(*) filter (where ${feedback.rating} <= 3 and ${feedback.comment} is not null)::int` })
        .from(feedback)
        .where(and(eq(feedback.restaurantId, r.id), gte(feedback.createdAt, since))),
      db.select({ n: sql<number>`count(*)::int` }).from(reservations).where(and(eq(reservations.restaurantId, r.id), eq(reservations.status, "pending"))),
      db.select({ lines: orders.lines }).from(orders).where(and(eq(orders.restaurantId, r.id), gte(orders.createdAt, since), ne(orders.status, "cancelled"))).limit(2000),
    ]);
    const qty = new Map<string, number>();
    for (const o of orderRows) for (const l of o.lines) qty.set(l.itemId, (qty.get(l.itemId) ?? 0) + l.qty);
    const topIds = [...qty.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const names = topIds.length ? await db.select({ id: items.id, name: items.name }).from(items).where(inArray(items.id, topIds.map(([id]) => id))) : [];
    const data = {
      restaurantName: r.name,
      currency: r.currency,
      periodLabel: `${sinceDay} – ${today}`,
      views: ev?.view ?? 0,
      scans: ev?.scan ?? 0,
      orders: ord?.n ?? 0,
      revenueMinor: ord?.rev ?? 0,
      topItems: topIds.map(([id, q]) => ({ name: names.find((n) => n.id === id)?.name ?? "Removed item", qty: q })),
      ratingAvg: fb?.avg ?? null,
      ratingCount: fb?.n ?? 0,
      privateFeedback: fb?.priv ?? 0,
      pendingReservations: pend?.n ?? 0,
      dashboardUrl: `${appUrl()}/dashboard/r/${r.id}`,
    };
    if (!shouldSendDigest(data)) {
      skipped++;
      continue;
    }
    const d = buildDigest(data);
    const html = emailShell(
      `${r.name} — your week`,
      `<table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px">${d.rows
        .map(([k, v]) => `<tr><td style="padding:6px 0;color:#78716c">${escapeHtml(k)}</td><td align="right" style="padding:6px 0;font-weight:600">${escapeHtml(v)}</td></tr>`)
        .join("")}</table>${d.highlights.map((h) => `<p style="margin:6px 0">• ${escapeHtml(h)}</p>`).join("")}<p style="font-size:12px;color:#a8a29e;margin-top:16px">Turn this email off in Settings → Ordering & guest features.</p>`,
      { href: data.dashboardUrl, label: "Open dashboard" },
    );
    const res = await sendEmail({ to: email, subject: d.subject, text: d.text, html });
    if (res.sent) sent++;
    else skipped++;
  }
  return NextResponse.json({ ok: true, sent, skipped });
}
