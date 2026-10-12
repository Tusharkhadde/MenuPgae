import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { requireUser, getPlanForUser } from "@/server/session";
import { getDb } from "@/lib/db";
import { restaurants } from "@/lib/db/schema";
import { canAddRestaurant, limitsFor } from "@/lib/limits";
import { OnboardingWizard } from "@/components/dashboard/onboarding-wizard";
import { Button } from "@/components/ui/button";
import { appUrl } from "@/lib/env";

export default async function NewRestaurantPage() {
  const user = await requireUser();
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(restaurants).where(eq(restaurants.ownerId, user.id));
  const plan = await getPlanForUser(user.id);

  if (!canAddRestaurant(plan, n)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;ve reached your plan&apos;s limit</h1>
        <p className="mt-3 text-muted-foreground">
          Your {plan === "pro" ? "Pro" : "Free"} plan includes {limitsFor(plan).restaurants} restaurant{limitsFor(plan).restaurants === 1 ? "" : "s"}.
          {plan === "free" && " Upgrade to Pro to add more branches."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {plan === "free" && <Button asChild><Link href="/dashboard/billing">See Pro</Link></Button>}
          <Button asChild variant="outline"><Link href="/dashboard">Back to dashboard</Link></Button>
        </div>
      </div>
    );
  }
  return <OnboardingWizard appHost={new URL(appUrl()).host} />;
}
