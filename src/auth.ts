import NextAuth, { type NextAuthConfig } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { getDb } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";
import { env, features, isProd } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createDemoAccount } from "@/server/demo";
import { magicLinkEmail } from "@/lib/email";
import { assertProductionConfig } from "@/lib/prod-config";

declare module "next-auth" {
  interface Session {
    user: { id: string; isDemo: boolean; name?: string | null; email?: string | null; image?: string | null };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  // Same check as server start, in case instrumentation didn't run: never guess in production.
  assertProductionConfig();
  const db = await getDb();
  const e = env();

  const secret = e.AUTH_SECRET ?? (isProd() ? undefined : "menupage-development-secret-change-me");
  if (!secret) throw new Error("AUTH_SECRET is not set. Generate one with `npx auth secret` (see README).");

  const providers: NextAuthConfig["providers"] = [];

  if (features.google()) {
    providers.push(Google({ clientId: e.AUTH_GOOGLE_ID, clientSecret: e.AUTH_GOOGLE_SECRET }));
  }

  if (features.email()) {
    providers.push(
      Resend({
        apiKey: e.AUTH_RESEND_KEY ?? "dev",
        from: e.EMAIL_FROM ?? "MenuPage <onboarding@resend.dev>",
        async sendVerificationRequest({ identifier, url, provider }) {
          if (!e.AUTH_RESEND_KEY) {
            if (isProd()) throw new Error("AUTH_RESEND_KEY is not set: refusing to print a magic link to the console in production.");
            console.info(`\n[menupage] Magic sign-in link for ${identifier}:\n${url}\n`);
            return;
          }
          const { subject, html, text } = magicLinkEmail(url);
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: provider.from, to: identifier, subject, html, text }),
          });
          if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
        },
      }),
    );
  }

  if (features.demo()) {
    providers.push(
      Credentials({
        id: "demo",
        name: "Demo",
        credentials: {},
        async authorize(_credentials, request) {
          const ip = clientIp(request.headers);
          if (!rateLimit(`demo:${ip}`, 5, 60 * 60_000).ok) return null;
          const user = await createDemoAccount();
          return { id: user.id, name: user.name, email: user.email, isDemo: true };
        },
      }),
    );
  }

  return {
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    secret,
    trustHost: true,
    session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
    pages: { signIn: "/login", verifyRequest: "/login?check=email", error: "/login" },
    providers,
    callbacks: {
      jwt({ token, user }) {
        if (user?.id) {
          token.uid = user.id;
          token.isDemo = Boolean((user as { isDemo?: boolean }).isDemo);
        }
        return token;
      },
      session({ session, token }) {
        if (token.uid) session.user.id = token.uid as string;
        session.user.isDemo = Boolean(token.isDemo);
        return session;
      },
    },
  } satisfies NextAuthConfig;
});
