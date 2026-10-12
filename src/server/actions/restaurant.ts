"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { restaurants } from "@/lib/db/schema";
import { businessInfoSchema, createRestaurantSchema, designSchema, domainSchema } from "@/lib/validation";
import { validateSlug } from "@/lib/slug";
import { assertCanAddRestaurant, assertCustomDomain } from "@/lib/limits";
import { defaultHours } from "@/lib/hours";
import { getPlanForUser, requireOwnedRestaurantOrThrow, requireUserOrThrow } from "@/server/session";
import { insertSampleMenu } from "@/server/sample-insert";
import { revalidateRestaurant } from "@/server/revalidate";
import { run, UserError, type ActionResult } from "@/server/actions/result";
import { addDomain, getDomainStatus, removeDomain, type DomainStatus } from "@/lib/domains";
import { appUrl } from "@/lib/env";

async function assertSlugFree(slug: string, exceptId?: string) {
  const check = validateSlug(slug);
  if (!check.ok) throw new UserError(check.reason);
  const db = await getDb();
  const [taken] = await db
    .select({ id: restaurants.id })
    .from(restaurants)
    .where(exceptId ? and(eq(restaurants.slug, slug), ne(restaurants.id, exceptId)) : eq(restaurants.slug, slug))
    .limit(1);
  if (taken) throw new UserError("That address is taken. Try another one.");
}

export async function checkSlugAvailable(slug: string): Promise<ActionResult<{ available: boolean; reason?: string }>> {
  return run(async () => {
    await requireUserOrThrow();
    try {
      await assertSlugFree(slug.toLowerCase().trim());
      return { available: true };
    } catch (e) {
      return { available: false, reason: e instanceof Error ? e.message : "Unavailable" };
    }
  });
}

export async function createRestaurant(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const user = await requireUserOrThrow();
    const data = createRestaurantSchema.parse(input);
    const db = await getDb();
    const [{ owned }] = await db.select({ owned: count() }).from(restaurants).where(eq(restaurants.ownerId, user.id));
    assertCanAddRestaurant(await getPlanForUser(user.id), owned);
    await assertSlugFree(data.slug);

    const [row] = await db
      .insert(restaurants)
      .values({
        ownerId: user.id,
        slug: data.slug,
        name: data.name,
        cuisine: data.cuisine,
        currency: data.currency,
        timezone: data.timezone,
        theme: data.theme,
        whatsapp: data.whatsapp,
        logoUrl: data.logoUrl,
        coverUrl: data.coverUrl,
        hours: defaultHours(),
      })
      .returning({ id: restaurants.id });
    if (data.sampleMenu) await insertSampleMenu(db, row.id, data.currency);
    revalidatePath("/dashboard");
    return { id: row.id };
  });
}

export async function updateBusinessInfo(restaurantId: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireOwnedRestaurantOrThrow(restaurantId);
    const data = businessInfoSchema.parse(input);
    const db = await getDb();
    await db.update(restaurants).set(data).where(eq(restaurants.id, restaurant.id));
    revalidateRestaurant(restaurant);
    revalidatePath(`/dashboard/r/${restaurant.id}`, "layout");
    return undefined;
  });
}

export async function updateDesign(restaurantId: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireOwnedRestaurantOrThrow(restaurantId);
    const data = designSchema.parse(input);
    const db = await getDb();
    await db.update(restaurants).set(data).where(eq(restaurants.id, restaurant.id));
    revalidateRestaurant(restaurant);
    revalidatePath(`/dashboard/r/${restaurant.id}`, "layout");
    return undefined;
  });
}

export async function updateSlug(restaurantId: string, slugInput: string): Promise<ActionResult<{ slug: string }>> {
  return run(async () => {
    const { restaurant } = await requireOwnedRestaurantOrThrow(restaurantId);
    const slug = slugInput.toLowerCase().trim();
    if (slug === restaurant.slug) return { slug };
    await assertSlugFree(slug, restaurant.id);
    const db = await getDb();
    await db.update(restaurants).set({ slug }).where(eq(restaurants.id, restaurant.id));
    revalidateRestaurant(restaurant);
    revalidatePath(`/r/${slug}`);
    revalidatePath(`/dashboard/r/${restaurant.id}`, "layout");
    return { slug };
  });
}

export async function setPublished(restaurantId: string, published: boolean): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireOwnedRestaurantOrThrow(restaurantId);
    const db = await getDb();
    await db.update(restaurants).set({ published }).where(eq(restaurants.id, restaurant.id));
    revalidateRestaurant(restaurant);
    revalidatePath(`/dashboard/r/${restaurant.id}`, "layout");
    return undefined;
  });
}

export async function deleteRestaurant(restaurantId: string, confirmSlug: string): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireOwnedRestaurantOrThrow(restaurantId);
    if (confirmSlug.trim() !== restaurant.slug) throw new UserError("Type the restaurant's address exactly to confirm.");
    if (restaurant.customDomain) await removeDomain(restaurant.customDomain).catch(() => undefined);
    const db = await getDb();
    await db.delete(restaurants).where(eq(restaurants.id, restaurant.id));
    revalidateRestaurant(restaurant);
    revalidatePath("/dashboard");
    return undefined;
  });
}

export async function setCustomDomain(restaurantId: string, domainInput: string): Promise<ActionResult<DomainStatus>> {
  return run(async () => {
    const { user, restaurant } = await requireOwnedRestaurantOrThrow(restaurantId);
    if (user.isDemo) throw new UserError("Custom domains aren't available in the demo.");
    assertCustomDomain(await getPlanForUser(user.id));
    const domain = domainSchema.parse(domainInput);
    const appHost = new URL(appUrl()).hostname;
    if (domain === appHost || domain.endsWith(`.${appHost}`)) throw new UserError("Use a domain you own, not the MenuPage domain.");
    const db = await getDb();
    const [taken] = await db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(and(eq(restaurants.customDomain, domain), ne(restaurants.id, restaurant.id)))
      .limit(1);
    if (taken) throw new UserError("That domain is already connected to another restaurant.");
    if (restaurant.customDomain && restaurant.customDomain !== domain) await removeDomain(restaurant.customDomain).catch(() => undefined);
    await db.update(restaurants).set({ customDomain: domain }).where(eq(restaurants.id, restaurant.id));
    const status = await addDomain(domain);
    revalidatePath(`/dashboard/r/${restaurant.id}`, "layout");
    return status;
  });
}

export async function removeCustomDomain(restaurantId: string): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireOwnedRestaurantOrThrow(restaurantId);
    if (restaurant.customDomain) await removeDomain(restaurant.customDomain).catch(() => undefined);
    const db = await getDb();
    await db.update(restaurants).set({ customDomain: null }).where(eq(restaurants.id, restaurant.id));
    revalidateRestaurant(restaurant);
    revalidatePath(`/dashboard/r/${restaurant.id}`, "layout");
    return undefined;
  });
}

export async function checkDomainStatus(restaurantId: string): Promise<ActionResult<DomainStatus | null>> {
  return run(async () => {
    const { restaurant } = await requireOwnedRestaurantOrThrow(restaurantId);
    if (!restaurant.customDomain) return null;
    return getDomainStatus(restaurant.customDomain);
  });
}
