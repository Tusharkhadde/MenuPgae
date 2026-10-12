/**
 * Database helpers for scripts (outside Next.js): migrate + seed.
 * Uses DATABASE_URL (Postgres/Neon) or, when unset, the same embedded PGlite
 * database `npm run dev` uses (.data/pglite).
 */
import "dotenv/config";
import path from "node:path";
import * as schema from "../src/lib/db/schema";
import type { DB } from "../src/lib/db";

export async function scriptDb(): Promise<{ db: DB; migrate: () => Promise<void>; close: () => Promise<void> }> {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
    const db = drizzle(client, { schema });
    return { db, migrate: () => migrate(db, { migrationsFolder }), close: () => client.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = path.join(process.cwd(), ".data", "pglite");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  return { db: db as unknown as DB, migrate: () => migrate(db, { migrationsFolder }), close: () => client.close() };
}
