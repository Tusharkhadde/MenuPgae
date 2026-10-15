import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { requireRestaurantAccess, getPlanForUser } from "@/server/session";
import { getDb } from "@/lib/db";
import { teamMembers } from "@/lib/db/schema";
import { limitsFor } from "@/lib/limits";
import { features } from "@/lib/env";
import { TeamPanel } from "@/components/dashboard/team-panel";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, restaurant } = await requireRestaurantAccess(id, "owner");
  const plan = await getPlanForUser(restaurant.ownerId);
  const db = await getDb();
  const members = await db.select().from(teamMembers).where(eq(teamMembers.restaurantId, restaurant.id)).orderBy(asc(teamMembers.createdAt));
  return (
    <TeamPanel
      restaurantId={restaurant.id}
      max={user.isDemo ? 0 : limitsFor(plan).teamMembers}
      emailConfigured={features.resend()}
      members={members.map((m) => ({ id: m.id, email: m.email, role: m.role }))}
    />
  );
}
