import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http";
import { getBillingState, getSessionUser } from "@/server/session";
import { billingConfig } from "@/server/billing";
import { createPortalUrl } from "@/lib/billing/gateway";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login?callbackUrl=/dashboard/billing", request.url), 303);
  const config = billingConfig();
  if (!config) return NextResponse.redirect(new URL("/dashboard/billing?notice=unconfigured", request.url), 303);
  // Only ever the signed-in user's stored customer id — never from the request.
  const { customerId } = await getBillingState(user.id);
  if (!customerId) return NextResponse.redirect(new URL("/dashboard/billing?notice=no-customer", request.url), 303);
  try {
    return NextResponse.redirect(await createPortalUrl(config, customerId), 303);
  } catch (err) {
    console.error("[menupage] portal failed", err);
    return NextResponse.redirect(new URL("/dashboard/billing?notice=portal-error", request.url), 303);
  }
}
