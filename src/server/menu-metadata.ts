import type { Metadata } from "next";
import type { PublicMenu } from "@/server/public-menu";

export function menuMetadata(menu: PublicMenu, canonical: string): Metadata {
  const r = menu.restaurant;
  const title = r.cuisine ? `${r.name} — ${r.cuisine} menu` : `${r.name} — Menu`;
  const description =
    r.description?.slice(0, 160) ??
    r.tagline ??
    `See the menu, prices, opening hours and location of ${r.name}${r.address ? ` · ${r.address.split("\n")[0]}` : ""}.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: menu.isDemo && r.slug !== "demo" ? { index: false, follow: false } : undefined,
    openGraph: { type: "website", title, description, url: canonical, siteName: r.name },
    twitter: { card: "summary_large_image", title, description },
    icons: r.logoUrl ? { icon: r.logoUrl, apple: r.logoUrl } : undefined,
  };
}
