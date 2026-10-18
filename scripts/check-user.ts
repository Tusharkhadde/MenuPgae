import { scriptDb } from "./db";
import { users, billingAccounts } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Checking DB...");
  const timer = setTimeout(() => {
    console.error("DB connection timed out (likely locked by next dev)");
    process.exit(1);
  }, 4000);

  const { db, close } = await scriptDb();
  const allUsers = await db.select().from(users);
  console.log("Users in DB:", JSON.stringify(allUsers, null, 2));

  const allBilling = await db.select().from(billingAccounts);
  console.log("Billing accounts in DB:", JSON.stringify(allBilling, null, 2));

  clearTimeout(timer);
  await close();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
