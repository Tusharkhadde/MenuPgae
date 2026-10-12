import type { BillingConfig } from "@/lib/billing/env";

/** Minimal surface of the Dodo SDK we use — lets tests inject a fake. */
export type DodoClientLike = {
  checkoutSessions: {
    create(body: {
      product_cart: { product_id: string; quantity: number }[];
      customer?: { customer_id: string } | { email: string; name?: string };
      metadata?: Record<string, string>;
      return_url?: string;
      cancel_url?: string;
    }): Promise<{ session_id: string; checkout_url?: string | null }>;
  };
  customers: {
    customerPortal: {
      create(customerId: string, params?: { return_url?: string }): Promise<{ link: string }>;
    };
  };
};

export type MakeClient = (config: BillingConfig) => Promise<DodoClientLike>;

/** Lazy-load the SDK so the app never imports it when billing is unconfigured. */
export const defaultMakeClient: MakeClient = async (config) => {
  const { default: DodoPayments } = await import("dodopayments");
  return new DodoPayments({
    bearerToken: config.apiKey,
    environment: config.environment,
    maxRetries: 2,
    timeout: 20_000,
  }) as unknown as DodoClientLike;
};

export async function createCheckoutUrl(
  config: BillingConfig,
  opts: {
    plan: "pro";
    user: { id: string; email: string; name?: string | null };
    customerId?: string | null;
  },
  makeClient: MakeClient = defaultMakeClient,
): Promise<string> {
  const productId = config.products[opts.plan];
  if (!productId) throw new Error(`No Dodo product configured for plan "${opts.plan}".`);
  const client = await makeClient(config);
  const session = await client.checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1 }],
    customer: opts.customerId
      ? { customer_id: opts.customerId }
      : { email: opts.user.email, ...(opts.user.name ? { name: opts.user.name } : {}) },
    metadata: { app_user_id: opts.user.id, app_plan: opts.plan },
    return_url: `${config.siteUrl}/dashboard/billing?checkout=success`,
    cancel_url: `${config.siteUrl}/dashboard/billing?checkout=cancelled`,
  });
  if (!session.checkout_url) throw new Error("Dodo did not return a checkout URL.");
  return session.checkout_url;
}

export async function createPortalUrl(
  config: BillingConfig,
  customerId: string,
  makeClient: MakeClient = defaultMakeClient,
): Promise<string> {
  const client = await makeClient(config);
  const res = await client.customers.customerPortal.create(customerId, {
    return_url: `${config.siteUrl}/dashboard/billing`,
  });
  return res.link;
}
