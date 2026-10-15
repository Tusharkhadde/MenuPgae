"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { categories, coupons, items, restaurants } from "@/lib/db/schema";
import { assertFeature, assertLanguages } from "@/lib/limits";
import { COUPON_CODE_RE, happyHourSchema, normalizeCouponCode } from "@/lib/schedule";
import { LANGUAGE_CODES, cleanTranslations, type Translations } from "@/lib/languages";
import { normalizeUpiId } from "@/lib/upi";
import { parsePriceToMinor } from "@/lib/money";
import { getPlanForUser, requireRestaurantAccessOrThrow } from "@/server/session";
import { revalidateRestaurant } from "@/server/revalidate";
import { run, UserError, type ActionResult } from "@/server/actions/result";
import { aiTranslate } from "@/server/ai";
import type { TranslateOutput } from "@/lib/ai/translate";

const orderingSchema = z.object({
  ordersEnabled: z.boolean(),
  serviceRequestsEnabled: z.boolean(),
  feedbackEnabled: z.boolean(),
  reservationsEnabled: z.boolean(),
  digestEnabled: z.boolean(),
  upiId: z.string().trim().max(120).nullable(),
});

export async function saveOrderingSettings(restaurantId: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "owner");
    const data = orderingSchema.parse(input);
    const plan = await getPlanForUser(restaurant.ownerId);
    if (data.reservationsEnabled && !restaurant.reservationsEnabled) assertFeature(plan, "reservations");
    let upiId: string | null = null;
    if (data.upiId) {
      upiId = normalizeUpiId(data.upiId);
      if (!upiId) throw new UserError("Enter a UPI ID like yourname@okaxis");
    }
    const db = await getDb();
    await db
      .update(restaurants)
      .set({
        ordersEnabled: data.ordersEnabled,
        serviceRequestsEnabled: data.serviceRequestsEnabled,
        feedbackEnabled: data.feedbackEnabled,
        reservationsEnabled: data.reservationsEnabled,
        digestEnabled: data.digestEnabled,
        upiId,
      })
      .where(eq(restaurants.id, restaurant.id));
    revalidateRestaurant(restaurant);
    revalidatePath(`/dashboard/r/${restaurant.id}`, "layout");
    return undefined;
  });
}

const promoSchema = z.object({
  promoBanner: z.preprocess((v) => (typeof v === "string" && !v.trim() ? null : v), z.string().trim().max(140).nullable()),
  happyHour: happyHourSchema,
});

export async function savePromotions(restaurantId: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "owner");
    const data = promoSchema.parse(input);
    if (data.happyHour?.enabled) assertFeature(await getPlanForUser(restaurant.ownerId), "happyHour");
    const db = await getDb();
    await db.update(restaurants).set({ promoBanner: data.promoBanner, happyHour: data.happyHour }).where(eq(restaurants.id, restaurant.id));
    revalidateRestaurant(restaurant);
    revalidatePath(`/dashboard/r/${restaurant.id}/promotions`);
    return undefined;
  });
}

const couponSchema = z.object({
  code: z.string(),
  kind: z.enum(["percent", "amount"]),
  value: z.string().trim().min(1),
  minOrder: z.string().trim().optional(),
  expiresAt: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()),
  maxUses: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().min(1).max(100000).nullable()),
});

export async function createCoupon(restaurantId: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "owner");
    assertFeature(await getPlanForUser(restaurant.ownerId), "coupons");
    const data = couponSchema.parse(input);
    const code = normalizeCouponCode(data.code);
    if (!COUPON_CODE_RE.test(code)) throw new UserError("Codes are 3–20 letters, numbers, - or _ (e.g. WELCOME10).");
    let value: number;
    if (data.kind === "percent") {
      value = Number.parseInt(data.value, 10);
      if (!Number.isInteger(value) || value < 1 || value > 90) throw new UserError("Percent off must be between 1 and 90.");
    } else {
      const v = parsePriceToMinor(data.value, restaurant.currency);
      if (!v) throw new UserError("Enter a valid amount.");
      value = v;
    }
    const minOrderMinor = data.minOrder ? parsePriceToMinor(data.minOrder, restaurant.currency) : 0;
    if (minOrderMinor === null) throw new UserError("Enter a valid minimum order.");
    const db = await getDb();
    await db.insert(coupons).values({ restaurantId: restaurant.id, code, kind: data.kind, value, minOrderMinor, expiresAt: data.expiresAt ?? null, maxUses: data.maxUses });
    revalidatePath(`/dashboard/r/${restaurant.id}/promotions`);
    revalidateRestaurant(restaurant);
    return undefined;
  });
}

export async function setCouponActive(restaurantId: string, couponId: string, active: boolean): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "owner");
    const db = await getDb();
    await db.update(coupons).set({ active: Boolean(active) }).where(and(eq(coupons.id, couponId), eq(coupons.restaurantId, restaurant.id)));
    revalidatePath(`/dashboard/r/${restaurant.id}/promotions`);
    revalidateRestaurant(restaurant);
    return undefined;
  });
}

export async function deleteCoupon(restaurantId: string, couponId: string): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "owner");
    const db = await getDb();
    await db.delete(coupons).where(and(eq(coupons.id, couponId), eq(coupons.restaurantId, restaurant.id)));
    revalidatePath(`/dashboard/r/${restaurant.id}/promotions`);
    revalidateRestaurant(restaurant);
    return undefined;
  });
}

/* ----------------------------------------------------------------- Languages */

export async function saveLanguages(restaurantId: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "owner");
    const langs = [...new Set(z.array(z.enum(LANGUAGE_CODES)).max(12).parse(input))];
    assertLanguages(await getPlanForUser(restaurant.ownerId), langs.length);
    const db = await getDb();
    await db.update(restaurants).set({ languages: langs }).where(eq(restaurants.id, restaurant.id));
    revalidateRestaurant(restaurant);
    revalidatePath(`/dashboard/r/${restaurant.id}/menu/translate`);
    return undefined;
  });
}

const translationsPayload = z.object({
  categories: z.array(z.object({ id: z.string().min(1), translations: z.unknown() })).max(200),
  items: z.array(z.object({ id: z.string().min(1), translations: z.unknown() })).max(2000),
});

export async function saveTranslations(restaurantId: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
    const data = translationsPayload.parse(input);
    const allowed = restaurant.languages;
    const db = await getDb();
    const catIds = data.categories.map((c) => c.id);
    const itemIds = data.items.map((i) => i.id);
    const [ownCats, ownItems] = await Promise.all([
      catIds.length ? db.select({ id: categories.id, t: categories.translations }).from(categories).where(and(inArray(categories.id, catIds), eq(categories.restaurantId, restaurant.id))) : [],
      itemIds.length ? db.select({ id: items.id, t: items.translations }).from(items).where(and(inArray(items.id, itemIds), eq(items.restaurantId, restaurant.id))) : [],
    ]);
    const catMap = new Map(ownCats.map((c) => [c.id, c.t]));
    const itemMap = new Map(ownItems.map((c) => [c.id, c.t]));
    // Keep translations for languages that were switched off (so switching back on restores them).
    const merge = (prev: Translations | undefined, next: unknown): Translations => {
      const kept = Object.fromEntries(Object.entries(prev ?? {}).filter(([k]) => !allowed.includes(k)));
      return { ...kept, ...cleanTranslations(next, allowed) };
    };
    await db.transaction(async (tx) => {
      for (const c of data.categories) {
        if (!catMap.has(c.id)) continue;
        await tx.update(categories).set({ translations: merge(catMap.get(c.id), c.translations) }).where(eq(categories.id, c.id));
      }
      for (const i of data.items) {
        if (!itemMap.has(i.id)) continue;
        await tx.update(items).set({ translations: merge(itemMap.get(i.id), i.translations) }).where(eq(items.id, i.id));
      }
    });
    revalidateRestaurant(restaurant);
    revalidatePath(`/dashboard/r/${restaurant.id}/menu/translate`);
    return undefined;
  });
}

/** Optional: draft translations with Gemma (Pro + an AI provider). Glossary-protected dish names are kept and post-checked. Nothing is saved until the owner reviews and saves. */
export async function autoTranslate(
  restaurantId: string,
  lang: string,
  texts: { id: string; name: string; description: string | null }[],
): Promise<ActionResult<Record<string, TranslateOutput>>> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
    assertFeature(await getPlanForUser(restaurant.ownerId), "aiTools");
    if (!restaurant.languages.includes(lang)) throw new UserError("Turn that language on first.");
    const input = z.array(z.object({ id: z.string().max(64), name: z.string().max(100), description: z.string().max(400).nullable() })).max(400).parse(texts);
    return aiTranslate(restaurant.id, input, lang);
  });
}
