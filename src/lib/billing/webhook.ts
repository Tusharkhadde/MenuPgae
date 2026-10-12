import { createHmac, timingSafeEqual } from "node:crypto";

/** Standard Webhooks (https://www.standardwebhooks.com) as used by Dodo Payments. */

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

const secretKey = (secret: string) =>
  Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");

export function signWebhook(secret: string, id: string, timestamp: number | string, body: string): string {
  const sig = createHmac("sha256", secretKey(secret)).update(`${id}.${timestamp}.${body}`).digest("base64");
  return `v1,${sig}`;
}

export type WebhookHeaders = {
  "webhook-id"?: string | null;
  "webhook-timestamp"?: string | null;
  "webhook-signature"?: string | null;
};

export type VerifiedWebhook<T = unknown> = { id: string; timestamp: number; event: T };

export function verifyWebhook<T = unknown>(opts: {
  secret: string;
  headers: WebhookHeaders;
  body: string;
  now?: number;
  toleranceSeconds?: number;
}): VerifiedWebhook<T> {
  const { secret, headers, body, now = Date.now(), toleranceSeconds = 300 } = opts;
  const id = headers["webhook-id"];
  const tsText = headers["webhook-timestamp"];
  const sigs = headers["webhook-signature"];
  if (!id || !tsText || !sigs) throw new WebhookVerificationError("Missing webhook headers.");
  if (!/^\d+$/.test(tsText)) throw new WebhookVerificationError("Invalid timestamp.");
  const ts = Number(tsText);
  if (Math.abs(Math.floor(now / 1000) - ts) > toleranceSeconds) {
    throw new WebhookVerificationError("Timestamp outside tolerance.");
  }
  const expected = Buffer.from(signWebhook(secret, id, ts, body).slice(3), "base64");
  const ok = sigs.split(" ").some((candidate) => {
    const [version, sig] = candidate.split(",", 2);
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!ok) throw new WebhookVerificationError("No matching signature.");
  let event: T;
  try {
    event = JSON.parse(body) as T;
  } catch {
    throw new WebhookVerificationError("Body is not valid JSON.");
  }
  return { id, timestamp: ts, event };
}
