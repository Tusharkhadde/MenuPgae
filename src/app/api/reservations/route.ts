import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { reservations, users } from "@/lib/db/schema";
import { checkReservationDate, reservationSchema } from "@/lib/reservations";
import { localDate } from "@/lib/schedule";
import { hasFeature } from "@/lib/limits";
import { appUrl } from "@/lib/env";
import { loadPublicRestaurant } from "@/server/orders";
import { guardPublicPost, jsonError } from "@/server/public-api";
import { emailShell, escapeHtml, sendEmail } from "@/server/mailer";

/** Guest requests a table → owner sees it in the dashboard (and by email when Resend is set up). */
export async function POST(request: Request) {
  const g = await guardPublicPost(request, "reserve", 4, 30 * 60_000, 4_000);
  if ("error" in g) return g.error;
  const parsed = reservationSchema.safeParse(g.body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Please check the form.");
  const found = await loadPublicRestaurant(parsed.data.r);
  if (!found || !found.restaurant.reservationsEnabled || !hasFeature(found.plan, "reservations")) return jsonError("This restaurant isn't taking reservations online.", 404);
  const r = found.restaurant;
  const dateError = checkReservationDate(parsed.data.date, localDate(new Date(), r.timezone));
  if (dateError) return jsonError(dateError);
  const db = await getDb();
  const [row] = await db
    .insert(reservations)
    .values({
      restaurantId: r.id,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email ?? null,
      date: parsed.data.date,
      time: parsed.data.time,
      partySize: parsed.data.partySize,
      note: parsed.data.note || null,
    })
    .returning({ id: reservations.id });

  const [owner] = await db.select({ email: users.email }).from(users).where(eq(users.id, r.ownerId)).limit(1);
  if (owner?.email) {
    const d = parsed.data;
    const summary = `${d.name} · ${d.partySize} guest${d.partySize === 1 ? "" : "s"} · ${d.date} at ${d.time}`;
    await sendEmail({
      to: owner.email,
      subject: `New table request at ${r.name}: ${summary}`,
      text: `${summary}\nPhone: ${d.phone}${d.email ? `\nEmail: ${d.email}` : ""}${d.note ? `\nNote: ${d.note}` : ""}\n\nAccept or decline: ${appUrl()}/dashboard/r/${r.id}/guests`,
      html: emailShell(
        "New table request",
        `<p><strong>${escapeHtml(summary)}</strong></p><p>Phone: ${escapeHtml(d.phone)}${d.email ? `<br>Email: ${escapeHtml(d.email)}` : ""}${d.note ? `<br>Note: ${escapeHtml(d.note)}` : ""}</p>`,
        { href: `${appUrl()}/dashboard/r/${r.id}/guests`, label: "Accept or decline" },
      ),
      replyTo: d.email ?? null,
    });
  }
  return NextResponse.json({ ok: true, id: row.id });
}
