import type { MetadataRoute } from "next";
import { and, eq } from "drizzle-orm";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/r/demo`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
  try {
    const { getDb } = await import("@/lib/db");
    const { restaurants, users } = await import("@/lib/db/schema");
    const db = await getDb();
    const rows = await db
      .select({ slug: restaurants.slug, updatedAt: restaurants.updatedAt })
      .from(restaurants)
      .innerJoin(users, eq(users.id, restaurants.ownerId))
      .where(and(eq(restaurants.published, true), eq(users.isDemo, false)))
      .limit(45_000);
    return [
      ...staticPages,
      ...rows
        .filter((r) => r.slug !== "demo")
        .map((r) => ({ url: `${base}/r/${r.slug}`, lastModified: r.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ];
  } catch {
    return staticPages;
  }
}
