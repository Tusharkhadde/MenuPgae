import Link from "next/link";
import { hoursAgo } from "@/lib/time";
import { redirect } from "next/navigation";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { BellRingIcon, CalendarDaysIcon, ChefHatIcon, EyeIcon, IndianRupeeIcon, MessageSquareHeartIcon, QrCodeIcon, ReceiptTextIcon, UtensilsIcon } from "lucide-react";
import { requireRestaurantAccess, getPlanForUser } from "@/server/session";
import { getDb } from "@/lib/db";
import { events, feedback, items, reservations, serviceRequests } from "@/lib/db/schema";
import { todayTotals } from "@/server/orders";
import { formatMoney } from "@/lib/money";
import { hasFeature } from "@/lib/limits";
import { localDate } from "@/lib/schedule";
import { SectionCard } from "@/components/dashboard/field";
import { Button } from "@/components/ui/button";

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { restaurant: r, role } = await requireRestaurantAccess(id, "staff");
  if (role === "staff") redirect(`/dashboard/r/${r.id}/orders`);
  const db = await getDb();
  const utcToday = new Date().toISOString().slice(0, 10);
  const weekAgo = hoursAgo(7 * 24);
  const [today, plan, [views], [itemCount], [openRequests], [pending], [rating]] = await Promise.all([
    todayTotals(r),
    getPlanForUser(r.ownerId),
    db
      .select({ view: sql<number>`count(*) filter (where ${events.type} = 'view')::int`, scan: sql<number>`count(*) filter (where ${events.type} = 'scan')::int` })
      .from(events)
      .where(and(eq(events.restaurantId, r.id), eq(events.day, utcToday))),
    db.select({ n: count() }).from(items).where(eq(items.restaurantId, r.id)),
    db.select({ n: count() }).from(serviceRequests).where(and(eq(serviceRequests.restaurantId, r.id), sql`${serviceRequests.resolvedAt} is null`, gte(serviceRequests.createdAt, hoursAgo(12)))),
    db.select({ n: count() }).from(reservations).where(and(eq(reservations.restaurantId, r.id), eq(reservations.status, "pending"), gte(reservations.date, localDate(new Date(), r.timezone)))),
    db.select({ avg: sql<number | null>`avg(${feedback.rating})::float`, n: sql<number>`count(*)::int` }).from(feedback).where(and(eq(feedback.restaurantId, r.id), gte(feedback.createdAt, weekAgo))),
  ]);

  const stats = [
    { label: "Orders today", value: today.count.toLocaleString("en-US"), icon: ReceiptTextIcon, href: "orders" },
    { label: "Sales today", value: formatMoney(today.revenueMinor, r.currency), icon: r.currency === "INR" ? IndianRupeeIcon : ReceiptTextIcon, href: "orders", hint: today.paidMinor ? `${formatMoney(today.paidMinor, r.currency)} marked paid` : undefined },
    { label: "Page views today", value: views?.view ?? 0, icon: EyeIcon, href: "analytics", hint: `${views?.scan ?? 0} QR scans` },
    { label: "Rating (7 days)", value: rating?.n ? `${(rating.avg ?? 0).toFixed(1)} ★` : "—", icon: MessageSquareHeartIcon, href: "guests", hint: rating?.n ? `${rating.n} rating${rating.n === 1 ? "" : "s"}` : "No ratings yet" },
  ];

  const checklist = [
    { done: itemCount.n > 0, label: "Add your dishes", href: "menu" },
    { done: !!r.whatsapp, label: "Add a WhatsApp number for orders", href: "details" },
    { done: !!r.hours, label: "Set opening hours", href: "details" },
    { done: r.currency !== "INR" || !!r.upiId, label: "Add your UPI ID so guests can pay", href: "settings" },
    { done: !!r.googleReviewsUrl, label: "Add your Google reviews link", href: "details" },
  ];
  const todo = checklist.filter((c) => !c.done);

  return (
    <div className="space-y-6">
      {(openRequests.n > 0 || today.open > 0 || pending.n > 0) && (
        <div className="flex flex-wrap gap-2">
          {today.open > 0 && (
            <Button asChild><Link href={`/dashboard/r/${r.id}/orders`}><ChefHatIcon /> {today.open} order{today.open === 1 ? "" : "s"} in progress</Link></Button>
          )}
          {openRequests.n > 0 && (
            <Button asChild variant="destructive"><Link href={`/dashboard/r/${r.id}/orders`}><BellRingIcon /> {openRequests.n} table request{openRequests.n === 1 ? "" : "s"}</Link></Button>
          )}
          {pending.n > 0 && (
            <Button asChild variant="outline"><Link href={`/dashboard/r/${r.id}/guests`}><CalendarDaysIcon /> {pending.n} reservation{pending.n === 1 ? "" : "s"} to confirm</Link></Button>
          )}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={`/dashboard/r/${r.id}/${s.href}`} className="rounded-2xl border bg-card p-5 transition-colors hover:border-foreground/20">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><s.icon className="size-4" /> {s.label}</div>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{s.value}</p>
            {s.hint && <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>}
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={todo.length ? "Finish setting up" : "You're all set"} description={todo.length ? "A few quick wins that help guests order and come back." : "Everything important is in place."}>
          {todo.length ? (
            <ul className="space-y-2">
              {todo.map((c) => (
                <li key={c.label}>
                  <Link href={`/dashboard/r/${r.id}/${c.href}`} className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm hover:bg-accent">
                    {c.label} <span aria-hidden>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Print your table QR codes and you&apos;re ready for service.</p>
          )}
        </SectionCard>
        <SectionCard title="Quick actions">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" className="justify-start"><Link href={`/dashboard/r/${r.id}/menu`}><UtensilsIcon /> Edit menu</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link href={`/dashboard/r/${r.id}/qr`}><QrCodeIcon /> QR codes & sharing</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link href={`/dashboard/r/${r.id}/menu/print`}><ReceiptTextIcon /> Printable menu</Link></Button>
            {hasFeature(plan, "kitchenDisplay") ? (
              <Button asChild variant="outline" className="justify-start"><Link href={`/kitchen/${r.id}`}><ChefHatIcon /> Kitchen display</Link></Button>
            ) : (
              <Button asChild variant="outline" className="justify-start"><Link href="/dashboard/billing"><ChefHatIcon /> Kitchen display (Pro)</Link></Button>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
