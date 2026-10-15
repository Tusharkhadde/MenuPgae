import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { requireRestaurantAccess } from "@/server/session";
import { getDb } from "@/lib/db";
import { glossaryEntries, items } from "@/lib/db/schema";
import { DISH_GLOSSARY, findGlossaryMatches } from "@/lib/glossary";
import { GlossaryEditor } from "@/components/dashboard/glossary-editor";

export const metadata: Metadata = { title: "Dish glossary" };

export default async function GlossaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { restaurant } = await requireRestaurantAccess(id, "manager");
  const db = await getDb();
  const [rows, menu] = await Promise.all([
    db.select().from(glossaryEntries).where(eq(glossaryEntries.restaurantId, restaurant.id)).orderBy(asc(glossaryEntries.term)),
    db.select({ name: items.name }).from(items).where(eq(items.restaurantId, restaurant.id)),
  ]);
  const onMenu = new Set<string>();
  for (const it of menu) for (const m of findGlossaryMatches(it.name, DISH_GLOSSARY)) onMenu.add(m.entry.term);
  return (
    <GlossaryEditor
      restaurantId={restaurant.id}
      custom={rows.map((r) => ({ id: r.id, term: r.term, aliases: r.aliases, explanation: r.explanation }))}
      builtIn={DISH_GLOSSARY.map((e) => ({ term: e.term, aliases: e.aliases, explanation: e.explanation }))}
      onMenu={[...onMenu].sort()}
    />
  );
}
