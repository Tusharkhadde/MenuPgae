"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { teamMembers, users } from "@/lib/db/schema";
import { assertTeamSize } from "@/lib/limits";
import { appUrl } from "@/lib/env";
import { getPlanForUser, requireRestaurantAccessOrThrow } from "@/server/session";
import { run, UserError, type ActionResult } from "@/server/actions/result";
import { emailShell, escapeHtml, sendEmail } from "@/server/mailer";

const inviteSchema = z.object({ email: z.email("Enter a valid email").max(120), role: z.enum(["manager", "staff"]) });

export async function inviteTeamMember(restaurantId: string, input: unknown): Promise<ActionResult<{ emailed: boolean }>> {
  return run(async () => {
    const { user, restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "owner");
    const data = inviteSchema.parse(input);
    const email = data.email.trim().toLowerCase();
    const db = await getDb();
    const [owner] = await db.select({ email: users.email }).from(users).where(eq(users.id, restaurant.ownerId)).limit(1);
    if (owner?.email?.toLowerCase() === email) throw new UserError("That's your own email.");
    const [{ n }] = await db.select({ n: count() }).from(teamMembers).where(eq(teamMembers.restaurantId, restaurant.id));
    assertTeamSize(await getPlanForUser(restaurant.ownerId), n + 1);
    await db.insert(teamMembers).values({ restaurantId: restaurant.id, email, role: data.role });
    const url = `${appUrl()}/login`;
    const roleText = data.role === "manager" ? "manage the menu, orders and reservations" : "see and update incoming orders";
    const res = await sendEmail({
      to: email,
      subject: `You've been added to ${restaurant.name} on MenuPage`,
      text: `${user.name ?? "The owner"} added you to ${restaurant.name} on MenuPage so you can ${roleText}.\nSign in with this email address: ${url}`,
      html: emailShell(
        `Join ${restaurant.name}`,
        `<p>${escapeHtml(user.name ?? "The owner")} added you to <strong>${escapeHtml(restaurant.name)}</strong> so you can ${roleText}.</p><p>Sign in with <strong>${escapeHtml(email)}</strong>.</p>`,
        { href: url, label: "Sign in to MenuPage" },
      ),
    });
    revalidatePath(`/dashboard/r/${restaurant.id}/team`);
    return { emailed: res.sent };
  });
}

export async function updateTeamRole(restaurantId: string, memberId: string, role: string): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "owner");
    if (role !== "manager" && role !== "staff") throw new UserError("Unknown role.");
    const db = await getDb();
    await db.update(teamMembers).set({ role }).where(and(eq(teamMembers.id, memberId), eq(teamMembers.restaurantId, restaurant.id)));
    revalidatePath(`/dashboard/r/${restaurant.id}/team`);
    return undefined;
  });
}

export async function removeTeamMember(restaurantId: string, memberId: string): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "owner");
    const db = await getDb();
    await db.delete(teamMembers).where(and(eq(teamMembers.id, memberId), eq(teamMembers.restaurantId, restaurant.id)));
    revalidatePath(`/dashboard/r/${restaurant.id}/team`);
    return undefined;
  });
}
