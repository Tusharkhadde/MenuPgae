import type { PlanId } from "@/config/plans";

export type SubscriptionStatus =
  | "pending"
  | "active"
  | "on_hold"
  | "paused"
  | "cancelled"
  | "failed"
  | "expired"
  | "past_due";

export type BillingState = {
  plan: PlanId;
  status: SubscriptionStatus | null;
  subscriptionId: string | null;
  customerId: string | null;
  productId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  pastDueEndsAt: Date | null;
  lastEventAt: Date | null;
};

export const EMPTY_BILLING_STATE: BillingState = {
  plan: "free",
  status: null,
  subscriptionId: null,
  customerId: null,
  productId: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  pastDueEndsAt: null,
  lastEventAt: null,
};

/** The subset of a Dodo webhook payload we rely on. */
export type DodoEvent = {
  business_id?: string;
  type: string;
  timestamp?: string;
  data: {
    payload_type?: string;
    subscription_id?: string;
    product_id?: string;
    status?: string;
    customer?: { customer_id?: string; email?: string; name?: string };
    next_billing_date?: string | null;
    cancel_at_next_billing_date?: boolean;
    past_due_ends_at?: string | null;
    metadata?: Record<string, string>;
  };
};

const STATUSES = new Set<SubscriptionStatus>([
  "pending",
  "active",
  "on_hold",
  "paused",
  "cancelled",
  "failed",
  "expired",
  "past_due",
]);

const EVENT_STATUS: Record<string, SubscriptionStatus> = {
  "subscription.active": "active",
  "subscription.renewed": "active",
  "subscription.unpaused": "active",
  "subscription.past_due": "past_due",
  "subscription.on_hold": "on_hold",
  "subscription.paused": "paused",
  "subscription.cancelled": "cancelled",
  "subscription.expired": "expired",
  "subscription.failed": "failed",
};

/** Statuses that mean "this customer has a live subscription — send them to the portal, not a new checkout". */
export const LIVE_STATUSES = new Set<SubscriptionStatus>(["active", "past_due", "on_hold", "paused"]);

export function hasLiveSubscription(state: BillingState): boolean {
  return !!state.subscriptionId && !!state.status && LIVE_STATUSES.has(state.status);
}

/** Which plan the account is entitled to right now. */
export function entitledPlan(state: BillingState, now = new Date()): PlanId {
  if (!state.subscriptionId || !state.status) return "free";
  if (state.status === "active") return state.plan;
  if (state.status === "past_due") {
    if (!state.pastDueEndsAt || state.pastDueEndsAt.getTime() > now.getTime()) return state.plan;
  }
  return "free";
}

function isEntitledStatus(s: SubscriptionStatus | null): boolean {
  return s === "active" || s === "past_due";
}

const parseDate = (v: string | null | undefined): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export type ApplyOutcome = "applied" | "ignored" | "stale";

/**
 * Pure reducer: the stored billing state + a verified webhook event → the new state.
 * Webhooks can arrive out of order and duplicated; this guards against both.
 */
export function applyEvent(
  state: BillingState,
  event: DodoEvent,
  planForProduct: (productId: string | null | undefined) => PlanId | null,
): { state: BillingState; outcome: ApplyOutcome } {
  const data = event.data ?? {};
  const eventAt = parseDate(event.timestamp) ?? new Date();

  if (event.type.startsWith("payment.")) {
    const customerId = data.customer?.customer_id;
    if (customerId && !state.customerId) return { state: { ...state, customerId }, outcome: "applied" };
    return { state, outcome: "ignored" };
  }
  if (!event.type.startsWith("subscription.") || !data.subscription_id) return { state, outcome: "ignored" };

  const plan = planForProduct(data.product_id);
  if (!plan) return { state, outcome: "ignored" };

  const sameSubscription = state.subscriptionId === data.subscription_id;
  if (sameSubscription && state.lastEventAt && eventAt.getTime() < state.lastEventAt.getTime()) {
    return { state, outcome: "stale" };
  }

  const status: SubscriptionStatus | undefined =
    data.status && STATUSES.has(data.status as SubscriptionStatus)
      ? (data.status as SubscriptionStatus)
      : EVENT_STATUS[event.type];
  if (!status) return { state, outcome: "ignored" };

  // Never let a dead, different subscription clobber a live entitled one.
  if (!sameSubscription && state.subscriptionId && isEntitledStatus(state.status) && !isEntitledStatus(status)) {
    return { state, outcome: "ignored" };
  }

  return {
    outcome: "applied",
    state: {
      plan,
      status,
      subscriptionId: data.subscription_id,
      customerId: data.customer?.customer_id ?? state.customerId,
      productId: data.product_id ?? state.productId,
      currentPeriodEnd: parseDate(data.next_billing_date) ?? (sameSubscription ? state.currentPeriodEnd : null),
      cancelAtPeriodEnd: data.cancel_at_next_billing_date ?? false,
      pastDueEndsAt: status === "past_due" ? parseDate(data.past_due_ends_at) : null,
      lastEventAt: eventAt,
    },
  };
}
