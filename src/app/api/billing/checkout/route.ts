import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http";
import { getBillingState, getSessionUser } from "@/server/session";
import { billingConfig } from "@/server/billing";
import { createCheckoutUrl, createPortalUrl } from "@/lib/billing/gateway";
import { hasLiveSubscription } from "@/lib/billing/state";
import { rateLimit } from "@/lib/rate-limit";

const back = (request: Request, notice: string) =>
  NextResponse.redirect(new URL(`/dashboard/billing?notice=${notice}`, request.url), 303);

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login?callbackUrl=/dashboard/billing", request.url), 303);
  if (user.isDemo) return back(request, "demo");
  const config = billingConfig();
  if (!config) return back(request, "unconfigured");
  if (!user.email) return back(request, "no-email");
  if (!rateLimit(`checkout:${user.id}`, 10, 10 * 60_000).ok) return back(request, "slow-down");

  try {
    const state = await getBillingState(user.id);
    // Never start a second subscription — existing subscribers manage it in the portal.
    if (hasLiveSubscription(state) && state.customerId) {
      return NextResponse.redirect(await createPortalUrl(config, state.customerId), 303);
    }
    const url = await createCheckoutUrl(config, {
      plan: "pro",
      user: { id: user.id, email: user.email, name: user.name },
      customerId: state.customerId,
    });
    return NextResponse.redirect(url, 303);
  } catch (err) {
    console.error("[menupage] checkout failed", err);
    return back(request, "checkout-error");
  }
}
