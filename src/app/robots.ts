import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/api/", "/login", "/demo", "/q/", "/site/"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
