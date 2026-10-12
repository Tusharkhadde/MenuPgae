import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ExternalLinkIcon, PlusIcon } from "lucide-react";
import { requireUser, getPlanForUser } from "@/server/session";
import { getDb } from "@/lib/db";
import { restaurants } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { canAddRestaurant } from "@/lib/limits";

export default async function DashboardHome() {
  const user = await requireUser();
  const db = await getDb();
  const list = await db.select().from(restaurants).where(eq(restaurants.ownerId, user.id)).orderBy(asc(restaurants.createdAt));
  if (list.length === 0) redirect("/dashboard/new");
  if (list.length === 1) redirect(`/dashboard/r/${list[0].id}/menu`);
  const plan = await getPlanForUser(user.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your restaurants</h1>
        {canAddRestaurant(plan, list.length) && (
          <Button asChild>
            <Link href="/dashboard/new"><PlusIcon /> New restaurant</Link>
          </Button>
        )}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((r) => (
          <div key={r.id} className="rounded-2xl border bg-card p-5">
            <Link href={`/dashboard/r/${r.id}/menu`} className="text-lg font-semibold hover:underline">{r.name}</Link>
            <p className="mt-1 text-sm text-muted-foreground">/r/{r.slug}</p>
            <div className="mt-4 flex gap-2">
              <Button asChild size="sm"><Link href={`/dashboard/r/${r.id}/menu`}>Manage</Link></Button>
              <Button asChild size="sm" variant="outline">
                <a href={`/r/${r.slug}`} target="_blank" rel="noopener noreferrer">View <ExternalLinkIcon /></a>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
