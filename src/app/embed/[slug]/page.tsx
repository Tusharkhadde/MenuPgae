import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicMenuBySlug } from "@/server/public-menu";
import { MenuPageView } from "@/components/menu/menu-page";
import { siteUrl } from "@/lib/site-url";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const menu = await getPublicMenuBySlug(slug);
  return { title: menu ? `${menu.restaurant.name} — Menu` : "Menu", robots: { index: false, follow: true } };
}

/** Embeddable menu for a restaurant's existing website: <iframe src="/embed/{slug}">. */
export default async function EmbedPage({ params }: Props) {
  const { slug } = await params;
  const menu = await getPublicMenuBySlug(slug);
  if (!menu) notFound();
  return <MenuPageView menu={menu} pageUrl={`${siteUrl()}/r/${menu.restaurant.slug}`} embed />;
}
