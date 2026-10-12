/**
 * Small in-memory sliding-window rate limiter.
 *
 * On serverless each instance has its own memory, so this is a best-effort
 * shield against bursts and casual abuse (not a global quota). Swap the store
 * for Upstash/Redis if you ever need strict global limits.
 */

type Bucket = number[];
const store = new Map<string, Bucket>();
let lastSweep = Date.now();

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (now - lastSweep > 60_000) {
    for (const [k, hits] of store) {
      if (!hits.length || now - hits[hits.length - 1] > 10 * 60_000) store.delete(k);
    }
    lastSweep = now;
  }
  const hits = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    store.set(key, hits);
    const retry = Math.ceil((windowMs - (now - hits[0])) / 1000);
    return { ok: false, remaining: 0, retryAfterSeconds: Math.max(1, retry) };
  }
  hits.push(now);
  store.set(key, hits);
  return { ok: true, remaining: limit - hits.length, retryAfterSeconds: 0 };
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

export function _resetRateLimits() {
  store.clear();
}
