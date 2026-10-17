import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { restaurants, users } from "@/lib/db/schema";
import { insertSampleMenu } from "@/server/sample-insert";
import { DEMO_RESTAURANT } from "@/server/sample-menu";

const DEMO_TTL_MS = 24 * 60 * 60 * 1000;

function shortId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

/**
 * Judge demo (/demo, only when DEMO_LOGIN_ENABLED=true): creates a throwaway sandbox account
 * with its own copy of the fictional demo café ("Demo data" everywhere it appears). Sandboxes older
 * than 24h are deleted (cascades to their restaurants, menus and analytics).
 */
export async function createDemoAccount() {
  const db = await getDb();
  await db.delete(users).where(and(eq(users.isDemo, true), lt(users.createdAt, new Date(Date.now() - DEMO_TTL_MS))));

  const id = shortId();
  const [user] = await db
    .insert(users)
    .values({ name: "Demo judge", email: `demo-${id}@demo.menupage.invalid`, isDemo: true })
    .returning();

  const [restaurant] = await db
    .insert(restaurants)
    .values({
      ...DEMO_RESTAURANT,
      ownerId: user.id,
      slug: `demo-${id}`,
      name: "Chai & Crumbs (Demo data · sandbox)",
      published: true,
    })
    .returning({ id: restaurants.id });

  await insertSampleMenu(db, restaurant.id, DEMO_RESTAURANT.currency);
  return user;
}
