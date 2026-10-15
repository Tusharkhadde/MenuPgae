import Link from "next/link";
import { EyeIcon, MessageCircleIcon, QrCodeIcon } from "lucide-react";
import { requireRestaurantAccess, getPlanForUser } from "@/server/session";
import { getAnalytics } from "@/server/analytics";
import { analyticsSince, limitsFor } from "@/lib/limits";
import { SectionCard } from "@/components/dashboard/field";
import { Button } from "@/components/ui/button";

export default async function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { restaurant } = await requireRestaurantAccess(id, "manager");
  const plan = await getPlanForUser(restaurant.ownerId);
  const days = limitsFor(plan).analyticsDays;
  const data = await getAnalytics(restaurant.id, analyticsSince(plan));
  const max = Math.max(1, ...data.days.map((d) => d.view + d.scan));
  const stats = [
    { label: "Page views", value: data.totals.view, icon: EyeIcon },
    { label: "QR scans", value: data.totals.scan, icon: QrCodeIcon },
    { label: "WhatsApp orders started", value: data.totals.whatsapp, icon: MessageCircleIcon },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Last {days} days · cookie-free, anonymous counts{plan === "free" && " · "}
          {plan === "free" && <Link href="/dashboard/billing" className="font-medium text-primary hover:underline">Get 90 days with Pro</Link>}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><s.icon className="size-4" /> {s.label}</div>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{s.value.toLocaleString("en-US")}</p>
          </div>
        ))}
      </div>

      <SectionCard title="Visits per day" description="Page views and QR scans.">
        {data.totals.view + data.totals.scan === 0 ? (
          <EmptyState slug={restaurant.slug} id={restaurant.id} />
        ) : (
          <div>
            <div className="flex h-48 items-end gap-[3px]" role="img" aria-label="Bar chart of daily visits">
              {data.days.map((d) => (
                <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.day}: ${d.view} views, ${d.scan} scans`}>
                  <div className="w-full rounded-t-[3px] bg-primary/35" style={{ height: `${(d.scan / max) * 100}%` }} />
                  <div className="w-full bg-primary" style={{ height: `${(d.view / max) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>{data.days[0]?.day}</span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-primary" /> Views</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-primary/35" /> Scans</span>
              </span>
              <span>{data.days.at(-1)?.day}</span>
            </div>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Most ordered dishes" description="From WhatsApp orders started on your page.">
          {data.topItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No WhatsApp orders yet.</p>
          ) : (
            <ol className="space-y-2">
              {data.topItems.map((it, i) => (
                <li key={it.id} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate">{it.name}</span>
                  <span className="tabular-nums text-muted-foreground">{it.qty}×</span>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
        <SectionCard title="Busiest tables" description="Scans and orders from table QR codes.">
          {data.tables.length === 0 ? (
            <p className="text-sm text-muted-foreground">No table activity yet. Print table QR codes to see this.</p>
          ) : (
            <ol className="space-y-2">
              {data.tables.map((t) => (
                <li key={t.table} className="flex items-center justify-between text-sm">
                  <span>Table {t.table}</span>
                  <span className="tabular-nums text-muted-foreground">{t.count}</span>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function EmptyState({ slug, id }: { slug: string; id: string }) {
  return (
    <div className="py-10 text-center">
      <p className="font-medium">No visits yet</p>
      <p className="mt-1 text-sm text-muted-foreground">Share your link or print your QR codes — visits will show up here.</p>
      <div className="mt-4 flex justify-center gap-2">
        <Button asChild size="sm" variant="outline"><a href={`/r/${slug}`} target="_blank" rel="noopener noreferrer">Open your page</a></Button>
        <Button asChild size="sm"><Link href={`/dashboard/r/${id}/qr`}>Get QR codes</Link></Button>
      </div>
    </div>
  );
}
