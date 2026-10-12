"use server";

import { and, count, eq, inArray, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { categories, items } from "@/lib/db/schema";
import { categorySchema, itemSchema, reorderSchema } from "@/lib/validation";
import { parsePriceToMinor } from "@/lib/money";
import { hasOptions } from "@/lib/options";
import { assertCanAddCategory, assertCanAddItems } from "@/lib/limits";
import { getPlanForUser, requireRestaurantAccessOrThrow } from "@/server/session";
import { revalidateRestaurant } from "@/server/revalidate";
import { insertSampleMenu } from "@/server/sample-insert";
import { SAMPLE_MENU } from "@/server/sample-menu";
import { run, UserError, type ActionResult } from "@/server/actions/result";
import type { Restaurant } from "@/lib/db/schema";

function done(r: Restaurant) {
  revalidateRestaurant(r);
  revalidatePath(`/dashboard/r/${r.id}/menu`);
}

export async function upsertCategory(restaurantId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
    const data = categorySchema.parse(input);
    const db = await getDb();
    if (data.id) {
      const res = await db
        .update(categories)
        .set({ name: data.name, description: data.description, availability: data.availability })
        .where(and(eq(categories.id, data.id), eq(categories.restaurantId, restaurant.id)))
        .returning({ id: categories.id });
      if (!res.length) throw new UserError("Category not found.");
      done(restaurant);
      return { id: data.id };
    }
    const [{ n }] = await db.select({ n: count() }).from(categories).where(eq(categories.restaurantId, restaurant.id));
    assertCanAddCategory(await getPlanForUser(restaurant.ownerId), n);
    const [{ pos }] = await db.select({ pos: max(categories.position) }).from(categories).where(eq(categories.restaurantId, restaurant.id));
    const [row] = await db
      .insert(categories)
      .values({ restaurantId: restaurant.id, name: data.name, description: data.description, availability: data.availability, position: (pos ?? -1) + 1 })
      .returning({ id: categories.id });
    done(restaurant);
    return { id: row.id };
  });
}

export async function deleteCategory(restaurantId: string, categoryId: string): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
    const db = await getDb();
    await db.delete(categories).where(and(eq(categories.id, categoryId), eq(categories.restaurantId, restaurant.id)));
    done(restaurant);
    return undefined;
  });
}

export async function reorderCategories(restaurantId: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
    const { ids } = reorderSchema.parse(input);
    const db = await getDb();
    await db.transaction(async (tx) => {
      for (const [i, id] of ids.entries()) {
        await tx.update(categories).set({ position: i }).where(and(eq(categories.id, id), eq(categories.restaurantId, restaurant.id)));
      }
    });
    done(restaurant);
    return undefined;
  });
}

export async function upsertItem(restaurantId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
    const data = itemSchema.parse(input);
    const priceMinor = parsePriceToMinor(data.price, restaurant.currency);
    if (priceMinor === null) throw new UserError("Enter a valid price, e.g. 149 or 149.50");
    const db = await getDb();
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, data.categoryId), eq(categories.restaurantId, restaurant.id)))
      .limit(1);
    if (!cat) throw new UserError("Category not found.");

    const values = {
      categoryId: cat.id,
      name: data.name,
      description: data.description,
      priceMinor,
      imageUrl: data.imageUrl,
      diet: data.diet,
      spicy: data.spicy,
      allergens: data.allergens,
      bestseller: data.bestseller,
      soldOut: data.soldOut,
      options: hasOptions(data.options) ? data.options : null,
      special: data.special,
      happyHour: data.happyHour,
      availability: data.availability,
      calories: data.calories,
      nutrition: data.nutrition,
    };

    if (data.id) {
      const res = await db
        .update(items)
        .set(values)
        .where(and(eq(items.id, data.id), eq(items.restaurantId, restaurant.id)))
        .returning({ id: items.id });
      if (!res.length) throw new UserError("Item not found.");
      done(restaurant);
      return { id: data.id };
    }

    const [{ n }] = await db.select({ n: count() }).from(items).where(eq(items.restaurantId, restaurant.id));
    assertCanAddItems(await getPlanForUser(restaurant.ownerId), n);
    const [{ pos }] = await db.select({ pos: max(items.position) }).from(items).where(eq(items.categoryId, cat.id));
    const [row] = await db
      .insert(items)
      .values({ ...values, restaurantId: restaurant.id, position: (pos ?? -1) + 1 })
      .returning({ id: items.id });
    done(restaurant);
    return { id: row.id };
  });
}

export async function setItemFlag(
  restaurantId: string,
  itemId: string,
  flag: "soldOut" | "bestseller" | "special",
  value: boolean,
): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
    if (flag !== "soldOut" && flag !== "bestseller" && flag !== "special") throw new UserError("Unknown flag.");
    const db = await getDb();
    await db
      .update(items)
      .set({ [flag]: Boolean(value) })
      .where(and(eq(items.id, itemId), eq(items.restaurantId, restaurant.id)));
    done(restaurant);
    return undefined;
  });
}

export async function deleteItem(restaurantId: string, itemId: string): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
    const db = await getDb();
    await db.delete(items).where(and(eq(items.id, itemId), eq(items.restaurantId, restaurant.id)));
    done(restaurant);
    return undefined;
  });
}

/** Persist item order within a category (and move items into it if dragged across). */
export async function reorderItems(restaurantId: string, categoryId: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
    const { ids } = reorderSchema.parse(input);
    const db = await getDb();
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.restaurantId, restaurant.id)))
      .limit(1);
    if (!cat) throw new UserError("Category not found.");
    const owned = await db
      .select({ id: items.id })
      .from(items)
      .where(and(inArray(items.id, ids), eq(items.restaurantId, restaurant.id)));
    if (owned.length !== new Set(ids).size) throw new UserError("Some items were not found.");
    await db.transaction(async (tx) => {
      for (const [i, id] of ids.entries()) {
        await tx.update(items).set({ position: i, categoryId: cat.id }).where(and(eq(items.id, id), eq(items.restaurantId, restaurant.id)));
      }
    });
    done(restaurant);
    return undefined;
  });
}

export async function addSampleMenu(restaurantId: string): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
    const db = await getDb();
    const [{ n }] = await db.select({ n: count() }).from(items).where(eq(items.restaurantId, restaurant.id));
    if (n > 0) throw new UserError("The sample menu can only be added to an empty menu.");
    assertCanAddItems(await getPlanForUser(restaurant.ownerId), 0, SAMPLE_MENU.reduce((s, c) => s + c.items.length, 0));
    await insertSampleMenu(db, restaurant.id, restaurant.currency);
    done(restaurant);
    return undefined;
  });
}
