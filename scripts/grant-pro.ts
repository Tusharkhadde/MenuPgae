import { eq } from "drizzle-orm";
import { scriptDb } from "./db";
import { billingAccounts, users } from "../src/lib/db/schema";

async function main() {
  const email = (process.argv[2] ?? "tusharkhadde06@gmail.com").trim().toLowerCase();

  console.log(`Connecting to database to grant Pro access to: ${email}...`);
  const { db, migrate, close } = await scriptDb();
  await migrate();

  // Find or create user
  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) {
    console.log(`User ${email} does not exist yet. Creating user record...`);
    [user] = await db
      .insert(users)
      .values({
        email,
        name: email.split("@")[0],
        isDemo: false,
      })
      .returning();
    console.log(`✓ User created with ID: ${user.id}`);
  } else {
    console.log(`✓ Found existing user with ID: ${user.id}`);
  }

  // Upsert billing_accounts to Pro plan with active status and future end date
  const subId = `sub_manual_${user.id.slice(0, 8)}`;
  await db
    .insert(billingAccounts)
    .values({
      userId: user.id,
      plan: "pro",
      status: "active",
      subscriptionId: subId,
      productId: "manual_pro",
      currentPeriodEnd: new Date("2099-12-31T23:59:59Z"),
      cancelAtPeriodEnd: false,
    })
    .onConflictDoUpdate({
      target: billingAccounts.userId,
      set: {
        plan: "pro",
        status: "active",
        subscriptionId: subId,
        productId: "manual_pro",
        currentPeriodEnd: new Date("2099-12-31T23:59:59Z"),
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      },
    });

  await close();
  console.log(`\n🎉 Successfully granted PRO access to ${email}!`);
  console.log(`User ID: ${user.id}`);
  console.log(`Plan: pro`);
  console.log(`Status: active`);
}

main().catch((err) => {
  console.error("Error granting pro access:", err);
  process.exit(1);
});
