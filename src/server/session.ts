import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { billingAccounts, restaurants, users, type Restaurant } from "@/lib/db/schema";
import { EMPTY_BILLING_STATE, entitledPlan, type BillingState, type SubscriptionStatus } from "@/lib/billing/state";
import type { PlanId } from "@/config/plans";
import { proEmailAllowlist } from "@/lib/env";

export type SessionUser = { id: string; isDemo: boolean; name?: string | null; email?: string | null; image?: string | null };

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  // Make sure the account still exists (demo sandboxes expire).
  const db = await getDb();
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!row) return null;
  return session.user;
});

/** For pages: redirect to login when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export class AuthError extends Error {
  constructor(message = "You need to be signed in.") {
    super(message);
    this.name = "AuthError";
  }
}

/** For actions/route handlers: throw instead of redirecting. */
export async function requireUserOrThrow(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError();
  return user;
}

/** Load a restaurant only if the current user owns it. */
export async function findOwnedRestaurant(userId: string, restaurantId: string): Promise<Restaurant | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(restaurants)
    .where(and(eq(restaurants.id, restaurantId), eq(restaurants.ownerId, userId)))
    .limit(1);
  return row ?? null;
}

export async function requireOwnedRestaurant(restaurantId: string) {
  const user = await requireUser();
  const restaurant = await findOwnedRestaurant(user.id, restaurantId);
  if (!restaurant) notFound();
  return { user, restaurant };
}

export async function requireOwnedRestaurantOrThrow(restaurantId: string) {
  const user = await requireUserOrThrow();
  const restaurant = await findOwnedRestaurant(user.id, restaurantId);
  if (!restaurant) throw new AuthError("Restaurant not found.");
  return { user, restaurant };
}

export function rowToBillingState(row: typeof billingAccounts.$inferSelect | undefined): BillingState {
  if (!row) return EMPTY_BILLING_STATE;
  return {
    plan: row.plan === "pro" ? "pro" : "free",
    status: (row.status as SubscriptionStatus | null) ?? null,
    subscriptionId: row.subscriptionId,
    customerId: row.customerId,
    productId: row.productId,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    pastDueEndsAt: row.pastDueEndsAt,
    lastEventAt: row.lastEventAt,
  };
}

export async function getBillingState(userId: string): Promise<BillingState> {
  const db = await getDb();
  const [row] = await db.select().from(billingAccounts).where(eq(billingAccounts.userId, userId)).limit(1);
  return rowToBillingState(row);
}

/** The plan an owner is entitled to right now (server-side source of truth for limits). */
export async function getPlanForUser(userId: string): Promise<PlanId> {
  const db = await getDb();
  const [u] = await db.select({ email: users.email, isDemo: users.isDemo }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u || u.isDemo) return "free";
  if (u.email && proEmailAllowlist().has(u.email.toLowerCase())) return "pro";
  return entitledPlan(await getBillingState(userId));
}
