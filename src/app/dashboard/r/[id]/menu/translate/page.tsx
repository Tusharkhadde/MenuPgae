import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { requireRestaurantAccess, getPlanForUser } from "@/server/session";
import { getDb } from "@/lib/db";
import { categories, items } from "@/lib/db/schema";
import { hasFeature, limitsFor } from "@/lib/limits";
import { features } from "@/lib/env";
import { TranslationsEditor } from "@/components/dashboard/translations-editor";

export const metadata: Metadata = { title: "Translations" };

export default async function TranslatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { restaurant, role } = await requireRestaurantAccess(id, "manager");
  const db = await getDb();
  const [cats, its, plan] = await Promise.all([
    db.select().from(categories).where(eq(categories.restaurantId, restaurant.id)).orderBy(asc(categories.position), asc(categories.createdAt)),
    db.select().from(items).where(eq(items.restaurantId, restaurant.id)).orderBy(asc(items.position), asc(items.createdAt)),
    getPlanForUser(restaurant.ownerId),
  ]);
  return (
    <TranslationsEditor
      restaurantId={restaurant.id}
      isOwner={role === "owner"}
      languages={restaurant.languages}
      maxLanguages={limitsFor(plan).extraLanguages}
      plan={plan}
      aiAvailable={hasFeature(plan, "aiTools") && features.gemini()}
      categories={cats.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        translations: c.translations ?? {},
        items: its
          .filter((i) => i.categoryId === c.id)
          .map((i) => ({ id: i.id, name: i.name, description: i.description, translations: i.translations ?? {} })),
      }))}
    />
  );
}
