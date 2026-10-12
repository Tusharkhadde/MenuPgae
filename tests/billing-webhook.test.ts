import { describe, expect, it, vi } from "vitest";
import { signWebhook, verifyWebhook, WebhookVerificationError } from "@/lib/billing/webhook";
import { applyEvent, EMPTY_BILLING_STATE, entitledPlan, hasLiveSubscription, type BillingState, type DodoEvent } from "@/lib/billing/state";
import { planForProduct, readBillingConfig } from "@/lib/billing/env";
import { createCheckoutUrl, createPortalUrl, type DodoClientLike } from "@/lib/billing/gateway";

const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

describe("webhook signature (Standard Webhooks)", () => {
  it("matches the Standard Webhooks reference vector", () => {
    expect(signWebhook(SECRET, "msg_p5jXN8AQM9LWM0D4loKWxJek", 1614265330, '{"test": 2432232314}')).toBe(
      "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
    );
  });

  const body = JSON.stringify({ type: "subscription.active", data: {} });
  const now = 1_760_000_000_000;
  const ts = String(Math.floor(now / 1000));
  const headers = (sig: string, t = ts) => ({ "webhook-id": "msg_1", "webhook-timestamp": t, "webhook-signature": sig });

  it("accepts a valid signature", () => {
    const sig = signWebhook(SECRET, "msg_1", ts, body);
    expect(verifyWebhook({ secret: SECRET, headers: headers(sig), body, now }).event).toEqual(JSON.parse(body));
  });

  it("accepts when any of several signatures matches (key rotation)", () => {
    const sig = signWebhook(SECRET, "msg_1", ts, body);
    expect(() => verifyWebhook({ secret: SECRET, headers: headers(`v1,AAAA ${sig}`), body, now })).not.toThrow();
  });

  it("rejects a tampered body", () => {
    const sig = signWebhook(SECRET, "msg_1", ts, body);
    expect(() => verifyWebhook({ secret: SECRET, headers: headers(sig), body: body.replace("active", "cancelled"), now })).toThrow(WebhookVerificationError);
  });

  it("rejects stale and future timestamps", () => {
    const old = String(Number(ts) - 600);
    const future = String(Number(ts) + 600);
    expect(() => verifyWebhook({ secret: SECRET, headers: headers(signWebhook(SECRET, "msg_1", old, body), old), body, now })).toThrow(/tolerance/);
    expect(() => verifyWebhook({ secret: SECRET, headers: headers(signWebhook(SECRET, "msg_1", future, body), future), body, now })).toThrow(/tolerance/);
  });

  it("rejects missing headers, bad versions and wrong secrets", () => {
    expect(() => verifyWebhook({ secret: SECRET, headers: {}, body, now })).toThrow(/Missing/);
    const sig = signWebhook(SECRET, "msg_1", ts, body);
    expect(() => verifyWebhook({ secret: SECRET, headers: headers(sig.replace("v1,", "v2,")), body, now })).toThrow(/No matching/);
    expect(() => verifyWebhook({ secret: "whsec_" + Buffer.from("other").toString("base64"), headers: headers(sig), body, now })).toThrow(/No matching/);
    expect(() => verifyWebhook({ secret: SECRET, headers: headers(sig, "abc"), body, now })).toThrow(/Invalid timestamp/);
  });
});

const config = { products: { pro: "pdt_pro" } };
const plan = (pid: string | null | undefined) => planForProduct(config, pid);
const ev = (type: string, data: Partial<DodoEvent["data"]> = {}, timestamp = "2026-10-12T10:00:00Z"): DodoEvent => ({
  type,
  timestamp,
  data: { subscription_id: "sub_1", product_id: "pdt_pro", customer: { customer_id: "cus_1", email: "a@b.co" }, ...data },
});

describe("billing state reducer", () => {
  it("activates Pro on subscription.active", () => {
    const { state, outcome } = applyEvent(EMPTY_BILLING_STATE, ev("subscription.active", { status: "active", next_billing_date: "2026-11-12T10:00:00Z" }), plan);
    expect(outcome).toBe("applied");
    expect(state).toMatchObject({ plan: "pro", status: "active", subscriptionId: "sub_1", customerId: "cus_1" });
    expect(state.currentPeriodEnd?.toISOString()).toBe("2026-11-12T10:00:00.000Z");
    expect(entitledPlan(state)).toBe("pro");
    expect(hasLiveSubscription(state)).toBe(true);
  });

  it("ignores unknown products and non-subscription events", () => {
    expect(applyEvent(EMPTY_BILLING_STATE, ev("subscription.active", { product_id: "pdt_other" }), plan).outcome).toBe("ignored");
    expect(applyEvent(EMPTY_BILLING_STATE, { type: "refund.succeeded", data: {} }, plan).outcome).toBe("ignored");
  });

  it("fills a missing customer id from payment events without changing the plan", () => {
    const { state } = applyEvent(EMPTY_BILLING_STATE, { type: "payment.succeeded", data: { customer: { customer_id: "cus_9" } } }, plan);
    expect(state.customerId).toBe("cus_9");
    expect(entitledPlan(state)).toBe("free");
  });

  it("drops out-of-order (stale) events for the same subscription", () => {
    const active = applyEvent(EMPTY_BILLING_STATE, ev("subscription.active", { status: "active" }, "2026-10-12T10:00:00Z"), plan).state;
    const res = applyEvent(active, ev("subscription.on_hold", { status: "on_hold" }, "2026-10-12T09:00:00Z"), plan);
    expect(res.outcome).toBe("stale");
    expect(res.state.status).toBe("active");
  });

  it("revokes Pro on cancel / expire / failed / on_hold", () => {
    const active = applyEvent(EMPTY_BILLING_STATE, ev("subscription.active", { status: "active" }), plan).state;
    for (const type of ["subscription.cancelled", "subscription.expired", "subscription.failed", "subscription.on_hold"]) {
      const { state } = applyEvent(active, ev(type, {}, "2026-10-13T10:00:00Z"), plan);
      expect(entitledPlan(state)).toBe("free");
    }
  });

  it("keeps Pro while past_due until the grace period ends", () => {
    const active = applyEvent(EMPTY_BILLING_STATE, ev("subscription.active", { status: "active" }), plan).state;
    const { state } = applyEvent(active, ev("subscription.past_due", { status: "past_due", past_due_ends_at: "2026-10-20T00:00:00Z" }, "2026-10-13T00:00:00Z"), plan);
    expect(entitledPlan(state, new Date("2026-10-15T00:00:00Z"))).toBe("pro");
    expect(entitledPlan(state, new Date("2026-10-21T00:00:00Z"))).toBe("free");
  });

  it("doesn't let a dead, different subscription override a live one", () => {
    const active = applyEvent(EMPTY_BILLING_STATE, ev("subscription.active", { status: "active" }), plan).state;
    const res = applyEvent(active, ev("subscription.failed", { subscription_id: "sub_old", status: "failed" }, "2026-10-13T00:00:00Z"), plan);
    expect(res.outcome).toBe("ignored");
    expect(entitledPlan(res.state)).toBe("pro");
  });

  it("records cancel-at-period-end without revoking access", () => {
    const { state } = applyEvent(EMPTY_BILLING_STATE, ev("subscription.updated", { status: "active", cancel_at_next_billing_date: true }), plan);
    expect(state.cancelAtPeriodEnd).toBe(true);
    expect(entitledPlan(state)).toBe("pro");
  });
});

describe("billing config", () => {
  it("is disabled unless every key is present", () => {
    expect(readBillingConfig({})).toBeNull();
    expect(readBillingConfig({ DODO_PAYMENTS_API_KEY: "k", DODO_PAYMENTS_WEBHOOK_SECRET: "s", DODO_PRODUCT_PRO: "p" })).toBeNull();
    const c = readBillingConfig({ DODO_PAYMENTS_API_KEY: "k", DODO_PAYMENTS_WEBHOOK_SECRET: "s", DODO_PRODUCT_PRO: "p", APP_URL: "https://x.app/" });
    expect(c).toMatchObject({ environment: "test_mode", siteUrl: "https://x.app", products: { pro: "p" } });
    expect(readBillingConfig({ DODO_PAYMENTS_API_KEY: "k", DODO_PAYMENTS_WEBHOOK_SECRET: "s", DODO_PRODUCT_PRO: "p", APP_URL: "https://x.app", DODO_PAYMENTS_ENVIRONMENT: "live_mode" })?.environment).toBe("live_mode");
  });
});

describe("billing gateway", () => {
  const cfg = { apiKey: "k", webhookSecret: "s", environment: "test_mode" as const, products: { pro: "pdt_pro" }, siteUrl: "https://x.app" };
  const fake = () => {
    const client: DodoClientLike = {
      checkoutSessions: { create: vi.fn(async () => ({ session_id: "cs_1", checkout_url: "https://checkout.dodo/cs_1" })) },
      customers: { customerPortal: { create: vi.fn(async () => ({ link: "https://portal.dodo/x" })) } },
    };
    return client;
  };

  it("creates a checkout with metadata, return URLs and the user's email", async () => {
    const client = fake();
    const url = await createCheckoutUrl(cfg, { plan: "pro", user: { id: "u1", email: "o@r.co", name: "Owner" } }, async () => client);
    expect(url).toBe("https://checkout.dodo/cs_1");
    expect(client.checkoutSessions.create).toHaveBeenCalledWith({
      product_cart: [{ product_id: "pdt_pro", quantity: 1 }],
      customer: { email: "o@r.co", name: "Owner" },
      metadata: { app_user_id: "u1", app_plan: "pro" },
      return_url: "https://x.app/dashboard/billing?checkout=success",
      cancel_url: "https://x.app/dashboard/billing?checkout=cancelled",
    });
  });

  it("reuses an existing customer id", async () => {
    const client = fake();
    await createCheckoutUrl(cfg, { plan: "pro", user: { id: "u1", email: "o@r.co" }, customerId: "cus_1" }, async () => client);
    expect(vi.mocked(client.checkoutSessions.create).mock.calls[0][0].customer).toEqual({ customer_id: "cus_1" });
  });

  it("opens the portal for the stored customer", async () => {
    const client = fake();
    expect(await createPortalUrl(cfg, "cus_1", async () => client)).toBe("https://portal.dodo/x");
    expect(client.customers.customerPortal.create).toHaveBeenCalledWith("cus_1", { return_url: "https://x.app/dashboard/billing" });
  });
});

describe("billing state shape", () => {
  it("free by default", () => {
    const s: BillingState = EMPTY_BILLING_STATE;
    expect(entitledPlan(s)).toBe("free");
    expect(hasLiveSubscription(s)).toBe(false);
  });
});
