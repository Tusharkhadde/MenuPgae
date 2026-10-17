/**
 * Seeds the fictional DEMO restaurant at /r/demo (idempotent: re-running resets it). Development / CI only:
 *   npm run db:seed
 * Refuses to run in production (NODE_ENV=production or on Vercel) and against any database that
 * already has real accounts. /r/demo is only served when DEMO_LOGIN_ENABLED=true.
 */
import { and, count, eq, notLike } from "drizzle-orm";
import { scriptDb } from "./db";
import { restaurants, users } from "../src/lib/db/schema";
import { insertSampleMenu } from "../src/server/sample-insert";
import { DEMO_RESTAURANT } from "../src/server/sample-menu";
import { seedBlockedReason } from "../src/lib/prod-config";

const DEMO_OWNER_EMAIL = "demo-owner@menupage.invalid";

async function main() {
  const blocked = seedBlockedReason();
  if (blocked) {
    console.error(`✗ Refusing to seed demo data: ${blocked} Seed scripts are for development and CI only.`);
    process.exit(1);
  }
  const { db, migrate, close } = await scriptDb();
  await migrate();

  // Demo/sandbox accounts all use @….invalid emails; anything else is a real owner.
  const [{ real }] = await db
    .select({ real: count() })
    .from(users)
    .where(and(eq(users.isDemo, false), notLike(users.email, "%.invalid")));
  if (real > 0) {
    await close();
    console.error(`✗ Refusing to seed demo data: this database has ${real} real account(s). Point DATABASE_URL at a development database.`);
    process.exit(1);
  }

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
