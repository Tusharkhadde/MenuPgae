import type { Metadata } from "next";
import { hoursAgo } from "@/lib/time";
import Link from "next/link";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { requireRestaurantAccess, getPlanForUser } from "@/server/session";
import { getDb } from "@/lib/db";
import { feedback, reservations } from "@/lib/db/schema";
import { hasFeature } from "@/lib/limits";
import { localDate } from "@/lib/schedule";
import { SectionCard } from "@/components/dashboard/field";
import { Button } from "@/components/ui/button";
import { ReservationList, FeedbackList } from "@/components/dashboard/guests-lists";

export const metadata: Metadata = { title: "Guests" };

export default async function GuestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { restaurant: r, role } = await requireRestaurantAccess(id, "manager");
  const plan = await getPlanForUser(r.ownerId);
  const db = await getDb();
  const today = localDate(new Date(), r.timezone);
  const since = hoursAgo(90 * 24);
  const [resv, fb, [summary]] = await Promise.all([
    db.select().from(reservations).where(and(eq(reservations.restaurantId, r.id), gte(reservations.date, today))).orderBy(asc(reservations.date), asc(reservations.time)).limit(200),
    db.select().from(feedback).where(and(eq(feedback.restaurantId, r.id), gte(feedback.createdAt, since))).orderBy(desc(feedback.createdAt)).limit(200),
    db
      .select({ avg: sql<number | null>`avg(${feedback.rating})::float`, n: sql<number>`count(*)::int`, happy: sql<number>`count(*) filter (where ${feedback.rating} >= 4)::int` })
      .from(feedback)
      .where(and(eq(feedback.restaurantId, r.id), gte(feedback.createdAt, since))),
  ]);
  const reservationsAllowed = hasFeature(plan, "reservations");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard
        title="Table reservations"
        description={reservationsAllowed ? (r.reservationsEnabled ? "Requests from your menu page. Accept or decline — guests with an email are notified automatically." : "Turn on reservations in Settings to show a “Reserve” button on your menu.") : "Let guests request a table from your menu. Included in Pro."}
      >
        {!reservationsAllowed ? (
          <Button asChild><Link href="/dashboard/billing">See Pro</Link></Button>
        ) : (
          <>
            {!r.reservationsEnabled && role === "owner" && (
              <Button asChild variant="outline"><Link href={`/dashboard/r/${r.id}/settings`}>Turn on reservations</Link></Button>
            )}
            <ReservationList
              restaurantId={r.id}
              restaurantName={r.name}
              items={resv.map((x) => ({ id: x.id, name: x.name, phone: x.phone, email: x.email, date: x.date, time: x.time, partySize: x.partySize, note: x.note, status: x.status }))}
            />
          </>
        )}
      </SectionCard>
      <SectionCard
        title="Guest feedback"
        description={
          r.feedbackEnabled
            ? "Guests rate their visit after ordering. 4–5★ guests are invited to review you on Google; 1–3★ feedback comes privately to you here."
            : "The reviews funnel is off. Turn it on in Settings."
        }
      >
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Average (90 days)" value={summary?.n ? `${(summary.avg ?? 0).toFixed(1)} ★` : "—"} />
          <Stat label="Ratings" value={String(summary?.n ?? 0)} />
          <Stat label="Sent to Google" value={r.googleReviewsUrl ? String(summary?.happy ?? 0) : "—"} hint={r.googleReviewsUrl ? undefined : "Add your Google link"} />
        </div>
        {!r.googleReviewsUrl && role === "owner" && (
          <p className="text-sm text-muted-foreground">
            Add your Google reviews link in <Link className="underline" href={`/dashboard/r/${r.id}/details`}>Business info</Link> so happy guests can post a review.
          </p>
        )}
        <FeedbackList restaurantId={r.id} items={fb.map((f) => ({ id: f.id, rating: f.rating, comment: f.comment, contact: f.contact, table: f.table, createdAt: f.createdAt.toISOString() }))} />
      </SectionCard>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
