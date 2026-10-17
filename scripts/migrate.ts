import { scriptDb } from "./db";

async function main() {
  const noDb = !process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED;
  if (noDb && process.env.VERCEL_ENV === "production") {
    // Fail the production build loudly instead of deploying an app with no database.
    console.error("✗ DATABASE_URL is not set for the Production environment. Set it in Vercel → Settings → Environment Variables and redeploy.");
    process.exit(1);
  }
  if (noDb && process.env.VERCEL) {
    console.warn("⚠ DATABASE_URL is not set — skipping migrations. Set it in Vercel → Settings → Environment Variables.");
    return;
  }
  const { migrate, close } = await scriptDb();
  await migrate();
  await close();
  console.log("✓ Database migrated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
