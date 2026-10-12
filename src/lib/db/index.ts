import "server-only";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import path from "node:path";
import * as schema from "@/lib/db/schema";

export type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __menupageDb?: Promise<DB> };

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    // prepare:false keeps us compatible with Neon's / PgBouncer's transaction pooler.
    const client = postgres(url, { prepare: false, max: process.env.NODE_ENV === "production" ? 5 : 10 });
    return drizzle(client, { schema });
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is not set. Create a free Neon Postgres database and set DATABASE_URL (see README).");
  }
  // Zero-setup local development: an embedded Postgres (PGlite) stored in .data/pglite.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = path.join(process.cwd(), ".data", "pglite");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.info("[menupage] Using embedded PGlite database at .data/pglite (set DATABASE_URL to use Postgres).");
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!globalForDb.__menupageDb) {
    globalForDb.__menupageDb = connect().catch((err) => {
      globalForDb.__menupageDb = undefined;
      throw err;
    });
  }
  return globalForDb.__menupageDb;
}

export { schema };
