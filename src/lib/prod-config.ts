/**
 * Production configuration checks. Pure functions over an env record (no "server-only", no zod),
 * so they can run from auth initialization, scripts, and unit tests.
 *
 * Development and tests are unchanged: nothing here throws unless NODE_ENV is "production"
 * and we are not inside `next build` (which runs with no secrets on CI).
 */

export type EnvLike = Record<string, string | undefined>;

const set = (v: string | undefined) => !!v && v.trim().length > 0;

/** A running production server (`next start` / Vercel), as opposed to `next build`. */
export function isProductionRuntime(e: EnvLike = process.env): boolean {
  return e.NODE_ENV === "production" && e.NEXT_PHASE !== "phase-production-build";
}

/** The judge/demo sandbox login is OFF unless DEMO_LOGIN_ENABLED is exactly "true" (case-insensitive). */
export function demoLoginEnabled(e: EnvLike = process.env): boolean {
  return (e.DEMO_LOGIN_ENABLED ?? "").trim().toLowerCase() === "true";
}

/** Real sign-in methods. The demo login does not count: real owners can't use it. */
export function realSignInMethods(e: EnvLike = process.env): ("google" | "email")[] {
  const out: ("google" | "email")[] = [];
  if (set(e.AUTH_GOOGLE_ID) && set(e.AUTH_GOOGLE_SECRET)) out.push("google");
  if (set(e.AUTH_RESEND_KEY)) out.push("email");
  return out;
}

/** Everything a production deployment must have. Empty array = good to go. */
export function productionConfigProblems(e: EnvLike = process.env): string[] {
  const problems: string[] = [];
  if (!set(e.DATABASE_URL)) problems.push("DATABASE_URL is not set (Neon pooled connection string). Production never falls back to the embedded PGlite database.");
  if (!set(e.AUTH_SECRET) && !set(e.NEXTAUTH_SECRET)) {
    problems.push("AUTH_SECRET is not set (generate one with `npx auth secret`; legacy NEXTAUTH_SECRET is also supported).");
  }
  if (set(e.AUTH_GOOGLE_ID) !== set(e.AUTH_GOOGLE_SECRET)) problems.push("Google sign-in is half-configured: set both AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, or neither.");
  if (realSignInMethods(e).length === 0) {
    problems.push(
      "No sign-in method is configured. Set AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET (Google) and/or AUTH_RESEND_KEY + EMAIL_FROM (email magic links). Production never prints magic links to the console, and the demo login does not count.",
    );
  }
  if (set(e.AUTH_RESEND_KEY) && !set(e.EMAIL_FROM)) {
    problems.push("AUTH_RESEND_KEY is set but EMAIL_FROM is not. Use a sender on a domain verified in Resend (the onboarding@resend.dev fallback only delivers to your own Resend account).");
  }
  return problems;
}

export function formatConfigProblems(problems: string[]): string {
  return `MenuPage is not configured for production:\n${problems.map((p) => `  - ${p}`).join("\n")}\nSee .env.example and README → "Deploy". (Development is unaffected.)`;
}

/** Throw one clear error listing every missing production setting when auth is initialized. */
export function assertProductionConfig(e: EnvLike = process.env): void {
  if (!isProductionRuntime(e)) return;
  const problems = productionConfigProblems(e);
  if (problems.length) throw new Error(formatConfigProblems(problems));
}

/**
 * Seed scripts create the fictional demo café. They must never touch a production database.
 * Returns the reason to refuse, or null when seeding is allowed.
 */
export function seedBlockedReason(e: EnvLike = process.env): string | null {
  if (e.NODE_ENV === "production") return "NODE_ENV is production.";
  if (set(e.VERCEL) || set(e.VERCEL_ENV)) return "running on Vercel.";
  return null;
}
