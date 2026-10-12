/** Public base URL, safe to call at build time (no env validation). */
export function siteUrl(): string {
  const url =
    process.env.APP_URL ??
    process.env.AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ??
    "http://localhost:3000";
  return url.replace(/\/+$/, "");
}
