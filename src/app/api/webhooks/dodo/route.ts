import { NextResponse } from "next/server";
import { verifyWebhook, WebhookVerificationError } from "@/lib/billing/webhook";
import type { DodoEvent } from "@/lib/billing/state";
import { billingConfig, processWebhook } from "@/server/billing";

export async function POST(request: Request) {
  const config = billingConfig();
  if (!config) return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });

  const body = await request.text(); // raw body — verify before parsing
  let verified;
  try {
    verified = verifyWebhook<DodoEvent>({
      secret: config.webhookSecret,
      body,
      headers: {
        "webhook-id": request.headers.get("webhook-id"),
        "webhook-timestamp": request.headers.get("webhook-timestamp"),
        "webhook-signature": request.headers.get("webhook-signature"),
      },
    });
  } catch (err) {
    if (err instanceof WebhookVerificationError) return NextResponse.json({ error: err.message }, { status: 401 });
    throw err;
  }

  try {
    const outcome = await processWebhook(verified);
    return NextResponse.json({ outcome });
  } catch (err) {
    console.error("[menupage] webhook processing failed", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 }); // Dodo will retry
  }
}
