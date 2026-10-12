import type { PlanId } from "@/config/plans";

export type BillingEnvironment = "test_mode" | "live_mode";

export type BillingConfig = {
  apiKey: string;
  webhookSecret: string;
  environment: BillingEnvironment;
  /** Paid plan → Dodo product id. */
  products: Partial<Record<Exclude<PlanId, "free">, string>>;
  siteUrl: string;
};

type Env = Record<string, string | undefined>;

/** Returns null when billing isn't configured; the app then runs with billing disabled. */
export function readBillingConfig(env: Env = process.env): BillingConfig | null {
  const apiKey = env.DODO_PAYMENTS_API_KEY?.trim();
  const webhookSecret = env.DODO_PAYMENTS_WEBHOOK_SECRET?.trim();
  const pro = env.DODO_PRODUCT_PRO?.trim();
  const siteUrl = (env.APP_URL ?? env.AUTH_URL ?? "").trim().replace(/\/+$/, "");
  if (!apiKey || !webhookSecret || !pro || !siteUrl) return null;
  const environment: BillingEnvironment = env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";
  return { apiKey, webhookSecret, environment, products: { pro }, siteUrl };
}

export function planForProduct(config: Pick<BillingConfig, "products">, productId: string | null | undefined): PlanId | null {
  if (!productId) return null;
  for (const [plan, id] of Object.entries(config.products)) {
    if (id === productId) return plan as PlanId;
  }
  return null;
}
