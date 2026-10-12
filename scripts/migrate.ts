import { scriptDb } from "./db";

async function main() {
  if (process.env.VERCEL && !process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
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
