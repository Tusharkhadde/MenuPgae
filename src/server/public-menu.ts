import "server-only";
import { cache } from "react";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { categories, items, restaurants, users, type Category, type Item, type Restaurant } from "@/lib/db/schema";
import { getPlanForUser } from "@/server/session";
import { limitsFor, showBadge } from "@/lib/limits";

export type PublicMenu = {
  restaurant: Restaurant;
  categories: (Category & { items: Item[] })[];
  showBadge: boolean;
  isDemo: boolean;
};

async function load(where: ReturnType<typeof eq>): Promise<PublicMenu | null> {
  const db = await getDb();
  const [row] = await db
    .select({ restaurant: restaurants, isDemo: users.isDemo })
    .from(restaurants)
    .innerJoin(users, eq(users.id, restaurants.ownerId))
    .where(and(where, eq(restaurants.published, true)))
    .limit(1);
  if (!row) return null;
  const r = row.restaurant;
  const [cats, its, plan, siblings] = await Promise.all([
    db.select().from(categories).where(eq(categories.restaurantId, r.id)).orderBy(asc(categories.position), asc(categories.createdAt)),
    db.select().from(items).where(eq(items.restaurantId, r.id)).orderBy(asc(items.position), asc(items.createdAt)),
    getPlanForUser(r.ownerId),
    db.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.ownerId, r.ownerId)).orderBy(asc(restaurants.createdAt)),
  ]);
  // After a downgrade nothing is deleted: branches and items beyond the plan's limits are just paused.
  const limits = limitsFor(plan);
  if (siblings.findIndex((s) => s.id === r.id) >= limits.restaurants) return null;
  let budget = limits.itemsPerRestaurant;
  return {
    restaurant: r,
    categories: cats
      .map((c) => {
        const catItems = its.filter((i) => i.categoryId === c.id).slice(0, Math.max(0, budget));
        budget -= catItems.length;
        return { ...c, items: catItems };
      })
      .filter((c) => c.items.length > 0),
    showBadge: showBadge(plan),
    isDemo: row.isDemo || r.slug === "demo",
  };
}

export const getPublicMenuBySlug = cache((slug: string) => load(eq(restaurants.slug, slug.toLowerCase())));
export const getPublicMenuByDomain = cache((domain: string) => load(eq(restaurants.customDomain, domain.toLowerCase())));
