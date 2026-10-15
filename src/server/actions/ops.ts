"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { feedback, orders, reservations, serviceRequests } from "@/lib/db/schema";
import { isOrderStatus } from "@/lib/order";
import { requireRestaurantAccessOrThrow } from "@/server/session";
import { run, UserError, type ActionResult } from "@/server/actions/result";
import { emailShell, escapeHtml, sendEmail } from "@/server/mailer";
import { reservationReplyText } from "@/lib/reservations";

export async function setOrderStatus(restaurantId: string, orderId: string, status: string): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "staff");
    if (!isOrderStatus(status)) throw new UserError("Unknown status.");
    const db = await getDb();
    const res = await db
      .update(orders)
      .set({ status })
      .where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurant.id)))
      .returning({ id: orders.id });
    if (!res.length) throw new UserError("Order not found.");
    return undefined;
  });
}

export async function setOrderPaid(restaurantId: string, orderId: string, paid: boolean): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "staff");
    const db = await getDb();
    const res = await db
      .update(orders)
      .set({ paid: Boolean(paid) })
      .where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurant.id)))
      .returning({ id: orders.id });
    if (!res.length) throw new UserError("Order not found.");
    return undefined;
  });
}

export async function resolveServiceRequest(restaurantId: string, requestId: string): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "staff");
    const db = await getDb();
    await db
      .update(serviceRequests)
      .set({ resolvedAt: new Date() })
      .where(and(eq(serviceRequests.id, requestId), eq(serviceRequests.restaurantId, restaurant.id), isNull(serviceRequests.resolvedAt)));
    return undefined;
  });
}

export async function setReservationStatus(
  restaurantId: string,
  reservationId: string,
  status: "accepted" | "declined",
): Promise<ActionResult<{ emailed: boolean }>> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
    if (status !== "accepted" && status !== "declined") throw new UserError("Unknown status.");
    const db = await getDb();
    const [row] = await db
      .update(reservations)
      .set({ status })
      .where(and(eq(reservations.id, reservationId), eq(reservations.restaurantId, restaurant.id)))
      .returning();
    if (!row) throw new UserError("Reservation not found.");
    let emailed = false;
    if (row.email) {
      const text = reservationReplyText({ restaurantName: restaurant.name, name: row.name, date: row.date, time: row.time, partySize: row.partySize, accepted: status === "accepted" });
      const res = await sendEmail({
        to: row.email,
        subject: status === "accepted" ? `Your table at ${restaurant.name} is confirmed` : `About your table request at ${restaurant.name}`,
        text,
        html: emailShell(status === "accepted" ? "Table confirmed" : "Table request", `<p>${escapeHtml(text)}</p>`),
      });
      emailed = res.sent;
    }
    revalidatePath(`/dashboard/r/${restaurant.id}/guests`);
    return { emailed };
  });
}

export async function deleteFeedback(restaurantId: string, feedbackId: string): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
    const db = await getDb();
    await db.delete(feedback).where(and(eq(feedback.id, feedbackId), eq(feedback.restaurantId, restaurant.id)));
    revalidatePath(`/dashboard/r/${restaurant.id}/guests`);
    return undefined;
  });
}
