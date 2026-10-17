import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertProductionConfig,
  demoLoginEnabled,
  isProductionRuntime,
  productionConfigProblems,
  realSignInMethods,
  seedBlockedReason,
} from "@/lib/prod-config";
import { historySourceFor, needsMoreDays, notEnoughOrdersMessage, prepReadiness } from "@/lib/prep/readiness";

const FULL = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://u:p@host-pooler/db?sslmode=require",
  AUTH_SECRET: "s3cret",
  AUTH_RESEND_KEY: "re_x",
  EMAIL_FROM: "MenuPage <login@example.org>",
};

describe("production config", () => {
  it("a complete production env has no problems", () => {
    expect(productionConfigProblems(FULL)).toEqual([]);
    expect(() => assertProductionConfig(FULL)).not.toThrow();
  });

  it("names every missing required variable", () => {
    const problems = productionConfigProblems({ NODE_ENV: "production" }).join("\n");
    expect(problems).toMatch(/DATABASE_URL/);
    expect(problems).toMatch(/AUTH_SECRET/);
    expect(problems).toMatch(/No sign-in method/);
  });

  it("accepts the legacy NEXTAUTH_SECRET setting", () => {
    const legacySecretEnv = { ...FULL, AUTH_SECRET: undefined, NEXTAUTH_SECRET: "legacy-secret" };
    expect(productionConfigProblems(legacySecretEnv)).toEqual([]);
    expect(() => assertProductionConfig(legacySecretEnv)).not.toThrow();
  });

  it("throws loudly in a production runtime, listing all problems at once", () => {
    expect(() => assertProductionConfig({ NODE_ENV: "production" })).toThrow(/DATABASE_URL[\s\S]*AUTH_SECRET[\s\S]*sign-in/);
  });

  it("the demo login is not a sign-in method for real owners", () => {
    const noRealLogin = { ...FULL, AUTH_RESEND_KEY: undefined, EMAIL_FROM: undefined, DEMO_LOGIN_ENABLED: "true" };
    expect(productionConfigProblems(noRealLogin).join(" ")).toMatch(/No sign-in method/);
  });

  it("accepts Google alone, flags half-configured Google and Resend without EMAIL_FROM", () => {
    const base = { NODE_ENV: "production", DATABASE_URL: "x", AUTH_SECRET: "y" };
    expect(realSignInMethods({ ...base, AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "s" })).toEqual(["google"]);
    expect(productionConfigProblems({ ...base, AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "s" })).toEqual([]);
    expect(productionConfigProblems({ ...base, AUTH_GOOGLE_ID: "id" }).join(" ")).toMatch(/half-configured/);
    expect(productionConfigProblems({ ...base, AUTH_RESEND_KEY: "re_x" }).join(" ")).toMatch(/EMAIL_FROM/);
  });

  it("development, tests and `next build` are unaffected", () => {
    expect(() => assertProductionConfig({})).not.toThrow();
    expect(() => assertProductionConfig({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertProductionConfig({ NODE_ENV: "test" })).not.toThrow();
    expect(isProductionRuntime({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).toBe(false);
    expect(() => assertProductionConfig({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).not.toThrow();
  });
});

describe("demo login flag", () => {
  it("is off unless DEMO_LOGIN_ENABLED=true", () => {
    expect(demoLoginEnabled({})).toBe(false);
    expect(demoLoginEnabled({ DEMO_LOGIN_ENABLED: "" })).toBe(false);
    expect(demoLoginEnabled({ DEMO_LOGIN_ENABLED: "false" })).toBe(false);
    expect(demoLoginEnabled({ DEMO_LOGIN_ENABLED: "1" })).toBe(false);
    expect(demoLoginEnabled({ DEMO_LOGIN_ENABLED: "true" })).toBe(true);
    expect(demoLoginEnabled({ DEMO_LOGIN_ENABLED: " TRUE " })).toBe(true);
  });
});

describe("seed scripts", () => {
  it("refuse to run in production or on Vercel", () => {
    expect(seedBlockedReason({ NODE_ENV: "production" })).not.toBeNull();
    expect(seedBlockedReason({ VERCEL: "1" })).not.toBeNull();
    expect(seedBlockedReason({ VERCEL_ENV: "preview" })).not.toBeNull();
    expect(seedBlockedReason({})).toBeNull();
    expect(seedBlockedReason({ NODE_ENV: "development" })).toBeNull();
  });
});

describe("prep planner data source", () => {
  it("real accounts always use their own orders; only demo sandboxes get synthetic data", () => {
    expect(historySourceFor({ isDemo: false })).toBe("orders");
    expect(historySourceFor({ isDemo: true })).toBe("synthetic");
    // Anything that isn't literally a demo account is treated as real.
    expect(historySourceFor({ isDemo: undefined as unknown as boolean })).toBe("orders");
  });

  it("readiness counts toward 28 days with the 14-day and 28-day unlocks", () => {
    expect(prepReadiness(0)).toMatchObject({ days: 0, target: 28, percent: 0, planner: { ready: false, needed: 14 }, accuracy: { ready: false, needed: 28 } });
    expect(prepReadiness(14)).toMatchObject({ percent: 50, planner: { ready: true, needed: 0 }, accuracy: { ready: false, needed: 14 } });
    expect(prepReadiness(40)).toMatchObject({ percent: 100, planner: { ready: true }, accuracy: { ready: true, needed: 0 } });
    expect(prepReadiness(Number.NaN).days).toBe(0);
  });

  it("the not-enough-orders message is honest and never offers synthetic data", () => {
    expect(needsMoreDays(1)).toBe("Needs 1 more day of orders");
    const msg = notEnoughOrdersMessage(5, 14);
    expect(msg).toMatch(/^Needs 9 more days of orders \(5 of 14/);
    expect(msg).not.toMatch(/synthetic|demo|sample/i);
  });
});

// ── Static guards: cheap, and they catch a regression before a reviewer has to. ─────────────────
const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}
const SRC = walk(path.join(ROOT, "src")).map((p) => ({ rel: path.relative(ROOT, p).split(path.sep).join("/"), text: readFileSync(p, "utf8") }));

describe("no synthetic fallback for real accounts", () => {
  it("only the prep actions and the prep server module touch synthetic history", () => {
    const users = SRC.filter((f) => /syntheticHistory|generateSyntheticHistory/.test(f.text)).map((f) => f.rel).sort();
    expect(users).toEqual(["src/lib/prep/synthetic.ts", "src/server/actions/prep.ts", "src/server/prep.ts"]);
  });

  it("the prep actions pick the source on the server from the account, never from client input", () => {
    const actions = read("src/server/actions/prep.ts");
    expect(actions).toMatch(/historySourceFor\(user\)/);
    expect(actions).not.toMatch(/source:\s*z\./);
    expect(actions).not.toMatch(/data\.source/);
    for (const f of ["src/components/dashboard/prep-planner.tsx", "src/components/dashboard/ask-planner.tsx", "src/components/dashboard/forecast-accuracy.tsx"]) {
      expect(read(f)).not.toMatch(/source:\s*["']synthetic["']|"synthetic"/);
    }
  });
});

describe("no public demo entry points", () => {
  it("marketing pages, nav, footer, sign-in and sitemap don't link to the demo", () => {
    const publicFiles = SRC.filter((f) => f.rel.startsWith("src/app/(marketing)/") || f.rel.startsWith("src/components/marketing/") || f.rel.startsWith("src/app/login/") || f.rel === "src/app/sitemap.ts");
    expect(publicFiles.length).toBeGreaterThan(5);
    for (const f of publicFiles) {
      expect(f.text, f.rel).not.toMatch(/\/r\/demo|href="\/demo"|Try the demo|Live demo|signInAsDemo/);
    }
  });

  it("the demo login only lives at /demo and checks the flag", () => {
    const linkers = SRC.filter((f) => /signInAsDemo/.test(f.text)).map((f) => f.rel).sort();
    expect(linkers).toEqual(["src/app/demo/actions.ts", "src/app/demo/page.tsx"]);
    expect(read("src/app/demo/page.tsx")).toMatch(/if \(!features\.demo\(\)\) notFound\(\)/);
    expect(read("src/app/demo/actions.ts")).toMatch(/if \(!features\.demo\(\)\) notFound\(\)/);
  });

  it("marketing copy has no invented social proof or placeholder prices", () => {
    const marketing = SRC.filter((f) => f.rel.startsWith("src/app/(marketing)/") || f.rel.startsWith("src/components/marketing/"))
      .map((f) => f.text)
      .join("\n");
    expect(marketing).not.toMatch(/testimonial|trusted by|\d[\d,]*\+?\s+(restaurants|cafés|customers|owners)\b|★|placeholder price/i);
    expect(marketing).not.toMatch(/menupage\.app/);
  });
});
