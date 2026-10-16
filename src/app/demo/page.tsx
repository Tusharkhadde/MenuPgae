import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlaskConicalIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { DemoDataBadge } from "@/components/demo-data-badge";
import { features } from "@/lib/env";
import { getSessionUser } from "@/server/session";
import { signInAsDemo } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Judge demo", robots: { index: false, follow: false } };

/**
 * Hidden judge demo. Not linked from anywhere in the product; 404 unless DEMO_LOGIN_ENABLED=true.
 * Everything a judge sees from here is a fictional café, labelled "Demo data".
 */
export default async function DemoPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!features.demo()) notFound();
  const sp = await searchParams;
  const user = await getSessionUser();

  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-10">
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border bg-card p-7 shadow-xl shadow-black/[0.03]">
          <DemoDataBadge />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">Judge demo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Opens a private sandbox dashboard with a fictional café, <strong>Chai &amp; Crumbs</strong>. Its menu, prices, address and the order
            history behind the prep planner are invented demo data — not a real restaurant and not real sales. Nothing you do here is sent to
            anyone, and the sandbox is deleted after 24 hours.
          </p>
          {sp.error === "limit" && (
            <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">Demo limit reached for this network. Try again in an hour.</p>
          )}
          <div className="mt-6">
            {user?.isDemo ? (
              <Button asChild className="h-10 w-full">
                <Link href="/dashboard">Back to the demo dashboard</Link>
              </Button>
            ) : (
              <form action={signInAsDemo}>
                <SubmitButton className="h-10 w-full">
                  <FlaskConicalIcon /> Open the demo dashboard
                </SubmitButton>
              </form>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Real restaurants never see demo data: their prep planner uses only their own orders.</p>
        </div>
      </div>
    </div>
  );
}
