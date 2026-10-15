import { asc, eq } from "drizzle-orm";
import { requireRestaurantAccess, getPlanForUser } from "@/server/session";
import { getDb } from "@/lib/db";
import { categories, items } from "@/lib/db/schema";
import { hasFeature, limitsFor } from "@/lib/limits";
import { features } from "@/lib/env";
import { normalizeOptions } from "@/lib/options";
import { MenuEditor } from "@/components/dashboard/menu-editor";

export default async function MenuPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ welcome?: string }> }) {
  const { id } = await params;
  const { welcome } = await searchParams;
  const { restaurant } = await requireRestaurantAccess(id, "manager");
  const db = await getDb();
  const [cats, its, plan] = await Promise.all([
    db.select().from(categories).where(eq(categories.restaurantId, restaurant.id)).orderBy(asc(categories.position), asc(categories.createdAt)),
    db.select().from(items).where(eq(items.restaurantId, restaurant.id)).orderBy(asc(items.position), asc(items.createdAt)),
    getPlanForUser(restaurant.ownerId),
  ]);
  return (
    <MenuEditor
      key={restaurant.id}
      restaurantId={restaurant.id}
      slug={restaurant.slug}
      currency={restaurant.currency}
      welcome={welcome === "1"}
      itemLimit={limitsFor(plan).itemsPerRestaurant}
      plan={plan}
      happyHourAllowed={hasFeature(plan, "happyHour")}
      aiAvailable={hasFeature(plan, "aiTools") && features.ai()}
      initial={cats.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        availability: c.availability ?? null,
        items: its
          .filter((i) => i.categoryId === c.id)
          .map((i) => ({
            id: i.id,
            categoryId: i.categoryId,
            name: i.name,
            description: i.description,
            priceMinor: i.priceMinor,
            imageUrl: i.imageUrl,
            diet: i.diet,
            spicy: i.spicy,
            allergens: i.allergens,
            bestseller: i.bestseller,
            soldOut: i.soldOut,
            options: i.options ? normalizeOptions(i.options) : null,
            special: i.special,
            happyHour: i.happyHour,
            availability: i.availability ?? null,
            calories: i.calories,
            nutrition: i.nutrition,
          })),
      }))}
    />
  );
}
