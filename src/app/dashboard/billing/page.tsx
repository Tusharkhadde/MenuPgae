import { CheckIcon, InfoIcon } from "lucide-react";
import { requireUser, getBillingState, getPlanForUser } from "@/server/session";
import { billingConfig } from "@/server/billing";
import { hasLiveSubscription } from "@/lib/billing/state";
import { PLANS, PRO_PRICE_NOTE } from "@/config/plans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Plan & billing" };

const NOTICES: Record<string, string> = {
  unconfigured: "Payments aren't set up on this server yet. The operator needs to add the Dodo Payments keys (see README).",
  demo: "Billing isn't available in the demo sandbox. Create a real account to upgrade.",
  "no-email": "Your account needs an email address to subscribe.",
  "slow-down": "Too many attempts. Please wait a few minutes.",
  "checkout-error": "We couldn't start checkout. Please try again in a moment.",
  "portal-error": "We couldn't open the billing portal. Please try again.",
  "no-customer": "No subscription found for this account yet.",
};

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ notice?: string; checkout?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const [state, plan] = await Promise.all([getBillingState(user.id), getPlanForUser(user.id)]);
  const configured = !!billingConfig();
  const live = hasLiveSubscription(state);
  const notice = sp.notice ? NOTICES[sp.notice] : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Plan &amp; billing</h1>
      {sp.checkout === "success" && (
        <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          Thanks! Your payment is being confirmed — Pro features unlock as soon as the payment provider confirms it (usually a few seconds; refresh this page).
        </p>
      )}
      {sp.checkout === "cancelled" && <p className="mt-4 rounded-xl border bg-card px-4 py-3 text-sm">Checkout cancelled — you haven&apos;t been charged.</p>}
      {notice && (
        <p className="mt-4 flex gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-primary" /> {notice}
        </p>
      )}

      <div className="mt-6 rounded-2xl border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
              {PLANS[plan].name}
              {state.status && state.status !== "active" && <Badge variant="secondary">{state.status.replace("_", " ")}</Badge>}
            </p>
            {state.currentPeriodEnd && live && (
              <p className="mt-1 text-sm text-muted-foreground">
                {state.cancelAtPeriodEnd ? "Ends" : "Renews"} on {state.currentPeriodEnd.toISOString().slice(0, 10)}
              </p>
            )}
            {state.status === "on_hold" && <p className="mt-1 text-sm text-destructive">Your last payment failed. Update your payment method to restore Pro.</p>}
          </div>
          {live && state.customerId ? (
            <form action="/api/billing/portal" method="post">
              <Button type="submit" variant="outline">Manage billing</Button>
            </form>
          ) : null}
        </div>
      </div>

      {plan === "free" && (
        <div className="mt-6 rounded-2xl border border-primary/40 bg-card p-6 shadow-[0_20px_60px_-30px_color-mix(in_oklch,var(--primary)_50%,transparent)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold">Upgrade to Pro</p>
              <p className="mt-1 text-sm text-muted-foreground">{PLANS.pro.tagline}</p>
            </div>
            <p className="max-w-xs text-right text-xs text-muted-foreground">{PRO_PRICE_NOTE}</p>
          </div>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {PLANS.pro.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm"><CheckIcon className="size-4 text-primary" /> {f}</li>
            ))}
          </ul>
          <form action="/api/billing/checkout" method="post" className="mt-6">
            <Button type="submit" size="lg" className="h-10 w-full sm:w-auto" disabled={!configured || user.isDemo}>
              {configured ? "Upgrade to Pro" : "Payments not configured yet"}
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">Secure checkout by Dodo Payments. Cancel anytime from the billing portal. Your menus are never deleted on downgrade — extra items and branches are just paused.</p>
        </div>
      )}
    </div>
  );
}
