"use server";

import { count, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { categories, items } from "@/lib/db/schema";
import { parseCsv, rowsFromCsv } from "@/lib/csv-import";
import { assertCanAddCategory, assertCanAddItems, assertFeature, limitsFor } from "@/lib/limits";
import { getPlanForUser, requireRestaurantAccessOrThrow } from "@/server/session";
import { revalidateRestaurant } from "@/server/revalidate";
import { run, UserError, type ActionResult } from "@/server/actions/result";
import { aiMenuFromImage } from "@/server/ai";
import { rateLimit } from "@/lib/rate-limit";

/** Import menu rows from CSV text (parsed again on the server — the browser preview is just a preview). */
export async function importMenuCsv(restaurantId: string, csvText: string): Promise<ActionResult<{ items: number; categories: number; skipped: number }>> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
    if (typeof csvText !== "string" || csvText.length > 1_000_000) throw new UserError("The file is too large (1 MB max).");
    const plan = await getPlanForUser(restaurant.ownerId);
    const { rows, errors } = rowsFromCsv(parseCsv(csvText), restaurant.currency, limitsFor(plan).itemsPerRestaurant);
    if (!rows.length) throw new UserError(errors[0]?.message ?? "No items found in the file.");
    const db = await getDb();
    const [{ n: itemCount }] = await db.select({ n: count() }).from(items).where(eq(items.restaurantId, restaurant.id));
    assertCanAddItems(plan, itemCount, rows.length);

    const existing = await db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.restaurantId, restaurant.id));
    const byName = new Map(existing.map((c) => [c.name.trim().toLowerCase(), c.id]));
    const newNames = [...new Set(rows.map((r) => r.category.trim()))].filter((n) => !byName.has(n.toLowerCase()));
    if (newNames.length) assertCanAddCategory(plan, existing.length + newNames.length - 1);

    let created = 0;
    await db.transaction(async (tx) => {
      const [{ pos }] = await tx.select({ pos: max(categories.position) }).from(categories).where(eq(categories.restaurantId, restaurant.id));
      let catPos = (pos ?? -1) + 1;
      for (const name of newNames) {
        const [c] = await tx.insert(categories).values({ restaurantId: restaurant.id, name, position: catPos++ }).returning({ id: categories.id });
        byName.set(name.toLowerCase(), c.id);
        created++;
      }
      const positions = new Map<string, number>();
      for (const r of rows) {
        const categoryId = byName.get(r.category.trim().toLowerCase())!;
        if (!positions.has(categoryId)) {
          const [{ p }] = await tx.select({ p: max(items.position) }).from(items).where(eq(items.categoryId, categoryId));
          positions.set(categoryId, (p ?? -1) + 1);
        }
        const position = positions.get(categoryId)!;
        positions.set(categoryId, position + 1);
        await tx.insert(items).values({
          restaurantId: restaurant.id,
          categoryId,
          name: r.name,
          description: r.description,
          priceMinor: r.priceMinor,
          diet: r.diet,
          spicy: r.spicy,
          allergens: r.allergens,
          bestseller: r.bestseller,
          soldOut: r.soldOut,
          calories: r.calories,
          options: r.variants.length ? { variants: r.variants, groups: [] } : null,
          position,
        });
      }
    });
    revalidateRestaurant(restaurant);
    revalidatePath(`/dashboard/r/${restaurant.id}/menu`);
    return { items: rows.length, categories: created, skipped: errors.length };
  });
}

/** Optional AI import: read a menu photo into CSV text for review (Pro + Gemma vision). */
export async function readMenuPhoto(restaurantId: string, base64: string, mimeType: string): Promise<ActionResult<{ csv: string }>> {
  return run(async () => {
    const { user, restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
    assertFeature(await getPlanForUser(restaurant.ownerId), "aiTools");
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) throw new UserError("Use a JPG, PNG or WebP photo.");
    if (typeof base64 !== "string" || base64.length > 6_000_000) throw new UserError("The photo is too large (4 MB max).");
    if (!rateLimit(`ai-photo:${user.id}`, 10, 60 * 60_000).ok) throw new UserError("Too many photo imports this hour. Try again later.");
    const rows = await aiMenuFromImage(base64, mimeType);
    if (rows.length < 2) throw new UserError("No dishes could be read from that photo. Try a sharper, straight-on photo.");
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    return { csv: rows.map((r) => r.map(esc).join(",")).join("\n") };
  });
}
