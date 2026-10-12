/**
 * Seeds the public demo restaurant at /r/demo (idempotent: re-running resets it).
 *   npm run db:seed
 */
import { eq } from "drizzle-orm";
import { scriptDb } from "./db";
import { restaurants, users } from "../src/lib/db/schema";
import { insertSampleMenu } from "../src/server/sample-insert";
import { DEMO_RESTAURANT } from "../src/server/sample-menu";

const DEMO_OWNER_EMAIL = "demo-owner@menupage.invalid";

async function main() {
  const { db, migrate, close } = await scriptDb();
  await migrate();

  let [owner] = await db.select().from(users).where(eq(users.email, DEMO_OWNER_EMAIL)).limit(1);
  if (!owner) {
    [owner] = await db.insert(users).values({ name: "MenuPage Demo", email: DEMO_OWNER_EMAIL, isDemo: false }).returning();
  }

  await db.delete(restaurants).where(eq(restaurants.slug, DEMO_RESTAURANT.slug));
  const [restaurant] = await db
    .insert(restaurants)
    .values({ ...DEMO_RESTAURANT, ownerId: owner.id })
    .returning({ id: restaurants.id });
  await insertSampleMenu(db, restaurant.id, DEMO_RESTAURANT.currency);

  await close();
  console.log(`✓ Seeded demo restaurant → /r/${DEMO_RESTAURANT.slug}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
