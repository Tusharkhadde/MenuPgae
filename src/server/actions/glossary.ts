"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { glossaryEntries } from "@/lib/db/schema";
import { cleanGlossaryInput } from "@/lib/glossary";
import { requireRestaurantAccessOrThrow } from "@/server/session";
import { run, UserError, type ActionResult } from "@/server/actions/result";

const MAX_ENTRIES = 300;

const inputSchema = z.object({
  term: z.string().max(80),
  aliases: z.string().max(400).optional(),
  explanation: z.string().max(240),
});

/** Add or update (same dish name) a restaurant glossary entry. */
export async function saveGlossaryEntry(restaurantId: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
    const cleaned = cleanGlossaryInput(inputSchema.parse(input));
    if (typeof cleaned === "string") throw new UserError(cleaned);
    const db = await getDb();
    const [{ n }] = await db.select({ n: count() }).from(glossaryEntries).where(eq(glossaryEntries.restaurantId, restaurant.id));
    if (n >= MAX_ENTRIES) throw new UserError(`Up to ${MAX_ENTRIES} glossary entries per restaurant.`);
    await db
      .insert(glossaryEntries)
      .values({ restaurantId: restaurant.id, term: cleaned.term, aliases: cleaned.aliases ?? [], explanation: cleaned.explanation })
      .onConflictDoUpdate({
        target: [glossaryEntries.restaurantId, glossaryEntries.term],
        set: { aliases: cleaned.aliases ?? [], explanation: cleaned.explanation, updatedAt: new Date() },
      });
    revalidatePath(`/dashboard/r/${restaurant.id}/menu/translate/glossary`);
    return undefined;
  });
}

export async function deleteGlossaryEntry(restaurantId: string, entryId: string): Promise<ActionResult> {
  return run(async () => {
    const { restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
    const db = await getDb();
    await db.delete(glossaryEntries).where(and(eq(glossaryEntries.id, String(entryId)), eq(glossaryEntries.restaurantId, restaurant.id)));
    revalidatePath(`/dashboard/r/${restaurant.id}/menu/translate/glossary`);
    return undefined;
  });
}
