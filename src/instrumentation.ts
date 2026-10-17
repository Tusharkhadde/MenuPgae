/**
 * Server start: production config check (throws with a list of missing env vars), then optional Sentry for the server side (server actions that call the prep agent). No-op unless
 * SENTRY_DSN is set. Only the Node.js runtime is instrumented; nothing is sent from browsers.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Fail fast and loudly in production when required env is missing (no-op in dev, tests and `next build`).
  const { assertProductionConfig } = await import("@/lib/prod-config");
  assertProductionConfig();
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "1"),
  });
}

export async function onRequestError(...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>) {
  if (!process.env.SENTRY_DSN || process.env.NEXT_RUNTIME !== "nodejs") return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
