import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLinkIcon, PlusIcon } from "lucide-react";
import { requireUser, getPlanForUser, listAccessibleRestaurants } from "@/server/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { canAddRestaurant } from "@/lib/limits";

export default async function DashboardHome() {
  const user = await requireUser();
  const { owned, shared } = await listAccessibleRestaurants(user);
  const all = [...owned.map((r) => ({ r, role: "owner" as const })), ...shared.map((s) => ({ r: s.restaurant, role: s.role }))];
  if (all.length === 0) redirect("/dashboard/new");
  const home = (x: (typeof all)[number]) => `/dashboard/r/${x.r.id}${x.role === "staff" ? "/orders" : ""}`;
  if (all.length === 1) redirect(home(all[0]));
  const list = owned;
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
        {all.map((x) => { const r = x.r; return (
          <div key={r.id} className="rounded-2xl border bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <Link href={home(x)} className="text-lg font-semibold hover:underline">{r.name}</Link>
              {x.role !== "owner" && <Badge variant="secondary" className="capitalize">{x.role}</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">/r/{r.slug}</p>
            <div className="mt-4 flex gap-2">
              <Button asChild size="sm"><Link href={home(x)}>Manage</Link></Button>
              <Button asChild size="sm" variant="outline">
                <a href={`/r/${r.slug}`} target="_blank" rel="noopener noreferrer">View <ExternalLinkIcon /></a>
              </Button>
            </div>
          </div>
        ); })}
      </div>
    </div>
  );
}
