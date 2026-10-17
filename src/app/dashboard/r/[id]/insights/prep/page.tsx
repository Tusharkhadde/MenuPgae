import type { Metadata } from "next";
import Link from "next/link";
import { and, count, eq, gte, ne } from "drizzle-orm";
import { requireRestaurantAccess, getPlanForUser } from "@/server/session";
import { hasFeature } from "@/lib/limits";
import { features } from "@/lib/env";
import { getDb } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { localDate } from "@/lib/schedule";
import { addDays } from "@/lib/prep/history";
import { historySourceFor } from "@/lib/prep/readiness";
import { SectionCard } from "@/components/dashboard/field";
import { Button } from "@/components/ui/button";
import { PrepPlanner } from "@/components/dashboard/prep-planner";

export const metadata: Metadata = { title: "Prep planner" };
// The agent may be cold-starting on a free Render instance; give the action time.
export const maxDuration = 180;

export default async function PrepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, restaurant } = await requireRestaurantAccess(id, "manager");
  const plan = await getPlanForUser(restaurant.ownerId);
  // Demo sandbox accounts (hidden judge demo) see synthetic "Demo data" only; real accounts only their own orders.
  const demo = historySourceFor(user) === "synthetic";
  const allowed = demo || hasFeature(plan, "prepPlanner");

  if (!allowed) {
    return (
      <SectionCard title="Prep planner" description="Know how much to prep before the rush.">
        <p className="text-sm text-muted-foreground">
          The prep planner forecasts how many portions of each dish you&apos;ll sell over the next 1–7 days from your own order history (TabPFN, a
          tabular foundation model), flags unusual days, and turns it into a plain-language prep list for the kitchen (Gemma, an open model).
        </p>
        <Button asChild>
          <Link href="/dashboard/billing">Upgrade to Pro</Link>
        </Button>
      </SectionCard>
    );
  }

  if (!features.prepAgent()) {
    return (
      <SectionCard title="Prep planner isn't set up yet" description="It needs the small Python forecasting agent that ships in this repo (/agent).">
        <ol className="list-decimal space-y-1 ps-5 text-sm text-muted-foreground">
          <li>Deploy <code>/agent</code> to Render (free plan) with the <code>render.yaml</code> blueprint — see docs/HACKATHON.md.</li>
          <li>On Render set <code>PRIORLABS_API_KEY</code> (TabPFN) and optionally <code>GOOGLE_AI_API_KEY</code> (Gemma wording).</li>
          <li>
            Here, set <code>AGENT_URL</code> to the Render URL and <code>AGENT_SECRET</code> to the same secret, then redeploy.
          </li>
        </ol>
      </SectionCard>
    );
  }

  if (demo) return <PrepPlanner restaurantId={restaurant.id} demo orderCount={0} orderDays={0} />;

  // Same window and filter as the history the agent receives (last 90 days, cancelled orders excluded).
  const db = await getDb();
  const since = addDays(localDate(new Date(), restaurant.timezone), -90);
  const where = and(eq(orders.restaurantId, restaurant.id), gte(orders.day, since), ne(orders.status, "cancelled"));
  const [[{ n }], days] = await Promise.all([
    db.select({ n: count() }).from(orders).where(where),
    db.selectDistinct({ day: orders.day }).from(orders).where(where),
  ]);

  return <PrepPlanner restaurantId={restaurant.id} demo={false} orderCount={n} orderDays={days.length} />;
}
