import "server-only";
import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/http";

export function jsonError(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * Shared guard for public guest endpoints: same-origin (or embedded iframe on
 * our own origin), rate limit per IP, size-capped JSON body.
 */
export async function guardPublicPost(request: Request, key: string, limit: number, windowMs: number, maxBytes = 16_000) {
  if (!isSameOrigin(request)) return { error: jsonError("Forbidden", 403) } as const;
  const ip = clientIp(request.headers);
  const rl = rateLimit(`${key}:${ip}`, limit, windowMs);
  if (!rl.ok) return { error: jsonError("Too many requests — please wait a moment.", 429) } as const;
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > maxBytes) return { error: jsonError("Request too large", 413) } as const;
    body = JSON.parse(text);
  } catch {
    return { error: jsonError("Invalid request") } as const;
  }
  return { body, ip } as const;
}
