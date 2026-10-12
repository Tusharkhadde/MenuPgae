import type { DB } from "@/lib/db";
import { categories, items } from "@/lib/db/schema";
import { minorDigits } from "@/lib/money";
import { SAMPLE_MENU, type SampleCategory } from "@/server/sample-menu";

/** Insert a sample menu into a restaurant (no auth checks — callers must authorize). */
export async function insertSampleMenu(db: DB, restaurantId: string, currency: string, menu: SampleCategory[] = SAMPLE_MENU) {
  const factor = 10 ** minorDigits(currency);
  for (const [ci, cat] of menu.entries()) {
    const [row] = await db
      .insert(categories)
      .values({ restaurantId, name: cat.name, description: cat.description ?? null, position: ci })
      .returning({ id: categories.id });
    if (!cat.items.length) continue;
    await db.insert(items).values(
      cat.items.map((it, ii) => ({
        restaurantId,
        categoryId: row.id,
        name: it.name,
        description: it.description ?? null,
        priceMinor: Math.round(it.price * factor),
        diet: it.diet ?? null,
        spicy: it.spicy ?? 0,
        allergens: it.allergens ?? [],
        bestseller: it.bestseller ?? false,
        soldOut: it.soldOut ?? false,
        position: ii,
      })),
    );
  }
}
