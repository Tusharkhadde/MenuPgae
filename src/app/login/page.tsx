import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheckIcon, SparklesIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { features } from "@/lib/env";
import { getSessionUser } from "@/server/session";
import { signInAsDemo, signInWithEmail, signInWithGoogle } from "./actions";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  InvalidEmail: "Enter a valid email address.",
  TooMany: "Too many sign-in attempts. Please wait a few minutes.",
  EmailSignin: "We couldn't send the sign-in email. Please try again.",
  DemoLimit: "Demo limit reached for now. Try again later or create a free account.",
  OAuthAccountNotLinked: "This email is already linked to another sign-in method. Use the one you signed up with.",
  Verification: "That sign-in link has expired or was already used. Request a new one.",
  Configuration: "Sign-in isn't fully configured on this server yet.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const redirectTo = sp.callbackUrl?.startsWith("/") && !sp.callbackUrl.startsWith("//") ? sp.callbackUrl : "/dashboard";
  if (await getSessionUser()) redirect(redirectTo);

  const google = features.google();
  const email = features.email();
  const demo = features.demo();
  const checkEmail = sp.check === "email";
  const error = sp.error ? (ERRORS[sp.error] ?? "Sign-in failed. Please try again.") : null;
  const signup = sp.intent === "signup";

  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-10">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border bg-card p-7 shadow-xl shadow-black/[0.03]">
          {checkEmail ? (
            <div className="text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-primary">
                <MailCheckIcon className="size-6" />
              </div>
              <h1 className="mt-4 text-xl font-semibold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">We sent you a sign-in link. It expires in 24 hours.</p>
              <Button asChild variant="ghost" className="mt-6">
                <Link href="/login">Use a different email</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight">{signup ? "Create your MenuPage" : "Welcome back"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {signup ? "Free plan, no card needed." : "Sign in to manage your menu."}
              </p>
              {error && <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              <div className="mt-6 space-y-3">
                {google && (
                  <form action={signInWithGoogle}>
                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <SubmitButton variant="outline" className="h-10 w-full">
                      <GoogleIcon /> Continue with Google
                    </SubmitButton>
                  </form>
                )}
                {google && email && <Divider />}
                {email && (
                  <form action={signInWithEmail} className="space-y-3">
                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@restaurant.com" className="h-10" />
                    </div>
                    <SubmitButton className="h-10 w-full">Email me a sign-in link</SubmitButton>
                  </form>
                )}
                {!google && !email && !demo && (
                  <p className="text-sm text-muted-foreground">No sign-in method is configured. Set Google or Resend env vars (see README).</p>
                )}
              </div>
              {demo && (
                <div className="mt-6 border-t pt-5">
                  <form action={signInAsDemo}>
                    <SubmitButton variant="secondary" className="h-10 w-full">
                      <SparklesIcon /> Try the dashboard with a demo account
                    </SubmitButton>
                  </form>
                  <p className="mt-2 text-center text-xs text-muted-foreground">A private sandbox with a sample café. Deleted after 24 hours.</p>
                </div>
              )}
            </>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our <Link href="/terms" className="underline underline-offset-2">Terms</Link> and{" "}
          <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}
