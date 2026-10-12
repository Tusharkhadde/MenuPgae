import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicMenuBySlug } from "@/server/public-menu";
import { MenuPageView } from "@/components/menu/menu-page";
import { menuMetadata } from "@/server/menu-metadata";
import { siteUrl } from "@/lib/site-url";

// Cached and revalidated on every owner edit (revalidatePath), with a time-based fallback.
export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

function canonicalFor(menu: NonNullable<Awaited<ReturnType<typeof getPublicMenuBySlug>>>) {
  return menu.restaurant.customDomain ? `https://${menu.restaurant.customDomain}` : `${siteUrl()}/r/${menu.restaurant.slug}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const menu = await getPublicMenuBySlug(slug);
  if (!menu) return { title: "Menu not found", robots: { index: false } };
  return menuMetadata(menu, canonicalFor(menu));
}

export default async function RestaurantPage({ params }: Props) {
  const { slug } = await params;
  const menu = await getPublicMenuBySlug(slug);
  if (!menu) notFound();
  return <MenuPageView menu={menu} pageUrl={canonicalFor(menu)} />;
}
