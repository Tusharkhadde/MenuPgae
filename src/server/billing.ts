import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { billingAccounts, processedWebhooks, users } from "@/lib/db/schema";
import { planForProduct, readBillingConfig } from "@/lib/billing/env";
import { applyEvent, type DodoEvent } from "@/lib/billing/state";
import type { VerifiedWebhook } from "@/lib/billing/webhook";
import { rowToBillingState } from "@/server/session";
import { restaurants } from "@/lib/db/schema";
import { revalidateRestaurant } from "@/server/revalidate";

export const billingConfig = () => readBillingConfig();

export type WebhookOutcome = "applied" | "ignored" | "stale" | "duplicate" | "unknown_account";

async function resolveUserId(event: DodoEvent): Promise<string | null> {
  const db = await getDb();
  const metaUser = event.data?.metadata?.app_user_id;
  if (metaUser) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, metaUser)).limit(1);
    if (u) return u.id;
  }
  const subId = event.data?.subscription_id;
  if (subId) {
    const [b] = await db.select({ id: billingAccounts.userId }).from(billingAccounts).where(eq(billingAccounts.subscriptionId, subId)).limit(1);
    if (b) return b.id;
  }
  const customerId = event.data?.customer?.customer_id;
  if (customerId) {
    const [b] = await db.select({ id: billingAccounts.userId }).from(billingAccounts).where(eq(billingAccounts.customerId, customerId)).limit(1);
    if (b) return b.id;
  }
  const email = event.data?.customer?.email?.toLowerCase();
  if (email) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (u) return u.id;
  }
  return null;
}

/** Apply a verified Dodo webhook exactly once (idempotent on `webhook-id`). */
export async function processWebhook(verified: VerifiedWebhook<DodoEvent>): Promise<WebhookOutcome> {
  const config = billingConfig();
  if (!config) return "ignored";
  const db = await getDb();

  const [seen] = await db.select({ id: processedWebhooks.id }).from(processedWebhooks).where(eq(processedWebhooks.id, verified.id)).limit(1);
  if (seen) return "duplicate";

  const event = verified.event;
  const userId = await resolveUserId(event);

  const outcome = await db.transaction(async (tx) => {
    // Unique PK makes concurrent deliveries of the same webhook fail here → treated as duplicate.
    const inserted = await tx
      .insert(processedWebhooks)
      .values({ id: verified.id, type: event.type })
      .onConflictDoNothing()
      .returning({ id: processedWebhooks.id });
    if (!inserted.length) return "duplicate" as const;
    if (!userId) return "unknown_account" as const;

    const [row] = await tx.select().from(billingAccounts).where(eq(billingAccounts.userId, userId)).limit(1);
    const { state, outcome } = applyEvent(rowToBillingState(row), event, (pid) => planForProduct(config, pid));
    if (outcome !== "applied") return outcome;

    const values = {
      plan: state.plan,
      status: state.status,
      subscriptionId: state.subscriptionId,
      customerId: state.customerId,
      productId: state.productId,
      currentPeriodEnd: state.currentPeriodEnd,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd,
      pastDueEndsAt: state.pastDueEndsAt,
      lastEventAt: state.lastEventAt,
    };
    await tx
      .insert(billingAccounts)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: billingAccounts.userId, set: values });
    return "applied" as const;
  });

  if (outcome === "applied" && userId) {
    // Plan changes affect the public pages (badge, paused branches/items).
    const owned = await db.select({ slug: restaurants.slug, customDomain: restaurants.customDomain }).from(restaurants).where(eq(restaurants.ownerId, userId));
    for (const r of owned) {
      try {
        revalidateRestaurant(r);
      } catch {
        /* revalidation is best-effort */
      }
    }
  }
  return outcome;
}
