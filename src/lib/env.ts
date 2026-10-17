import "server-only";
import { z } from "zod";
import { resolveAiConfig, type AiConfig } from "@/lib/ai/config";
import { demoLoginEnabled } from "@/lib/prod-config";

/**
 * Environment access. Validation is lazy (on first use at runtime) so that
 * `next build` works without any secrets.
 */

const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: optional,
  AUTH_SECRET: optional,
  APP_URL: optional,
  AUTH_URL: optional,
  AUTH_GOOGLE_ID: optional,
  AUTH_GOOGLE_SECRET: optional,
  AUTH_RESEND_KEY: optional,
  EMAIL_FROM: optional,
  DEMO_LOGIN_ENABLED: optional,
  R2_ACCOUNT_ID: optional,
  R2_ACCESS_KEY_ID: optional,
  R2_SECRET_ACCESS_KEY: optional,
  R2_BUCKET: optional,
  R2_PUBLIC_URL: optional,
  VERCEL_API_TOKEN: optional,
  VERCEL_PROJECT_ID: optional,
  VERCEL_TEAM_ID: optional,
  PRO_EMAILS: optional,
  CUSTOM_DOMAIN_TARGET: optional,
  // Open-weight AI (Gemma). GEMINI_* are accepted as legacy aliases.
  AI_PROVIDER: optional,
  GOOGLE_AI_API_KEY: optional,
  GEMINI_API_KEY: optional,
  GEMMA_MODEL: optional,
  GEMMA_VISION_MODEL: optional,
  GEMMA_FALLBACK_MODEL: optional,
  GEMINI_MODEL: optional,
  OLLAMA_BASE_URL: optional,
  OPENAI_COMPAT_BASE_URL: optional,
  OPENAI_COMPAT_API_KEY: optional,
  OLLAMA_MODEL: optional,
  OLLAMA_VISION_MODEL: optional,
  // TabPFN prep-planner agent (Python service in /agent, e.g. on Render)
  AGENT_URL: optional,
  AGENT_SECRET: optional,
  CRON_SECRET: optional,
  // Optional Sentry tracing of the server actions that call the agent (no-op when unset)
  SENTRY_DSN: optional,
  SENTRY_TRACES_SAMPLE_RATE: optional,
  SENTRY_ENVIRONMENT: optional,
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment variables: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProd = () => process.env.NODE_ENV === "production";

/** Throw a clear error at runtime when a production deployment is missing a must-have. */
export function requireEnv<K extends keyof Env>(key: K, why: string): NonNullable<Env[K]> {
  const v = env()[key];
  if (!v) throw new Error(`Missing environment variable ${String(key)} (${why}). See .env.example and README.`);
  return v as NonNullable<Env[K]>;
}

export function appUrl(): string {
  const e = env();
  const url =
    e.APP_URL ??
    e.AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

export const features = {
  google: () => !!(env().AUTH_GOOGLE_ID && env().AUTH_GOOGLE_SECRET),
  /** Magic links via Resend. Only in development (never in production) is the link printed to the server console instead. */
  email: () => !!env().AUTH_RESEND_KEY || !isProd(),
  /** Hidden judge demo (/demo sandbox login + demo restaurants). OFF unless DEMO_LOGIN_ENABLED=true. */
  demo: () => demoLoginEnabled({ DEMO_LOGIN_ENABLED: env().DEMO_LOGIN_ENABLED }),
  r2: () => {
    const e = env();
    return !!(e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET && e.R2_PUBLIC_URL);
  },
  vercelDomains: () => !!(env().VERCEL_API_TOKEN && env().VERCEL_PROJECT_ID),
  /** Transactional email (reservation alerts, team invites, weekly digest). Sign-in links use the same key. */
  resend: () => !!env().AUTH_RESEND_KEY,
  /** Optional AI helpers (auto-translate, menu photo import) on Gemma — Google AI Studio or a local Ollama. */
  ai: () => aiConfig() !== null,
  /** TabPFN prep-planner agent. */
  prepAgent: () => !!(env().AGENT_URL && env().AGENT_SECRET),
};

export function aiConfig(): AiConfig | null {
  return resolveAiConfig(env());
}

export function proEmailAllowlist(): Set<string> {
  return new Set(
    (env().PRO_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}
