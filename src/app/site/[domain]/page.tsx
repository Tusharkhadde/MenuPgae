import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicMenuByDomain } from "@/server/public-menu";
import { MenuPageView } from "@/components/menu/menu-page";
import { menuMetadata } from "@/server/menu-metadata";
import { getPlanForUser } from "@/server/session";

/** Custom-domain entry point. proxy.ts rewrites requests for a restaurant's own domain here. */
export const revalidate = 300;

type Props = { params: Promise<{ domain: string }> };

async function load(domain: string) {
  const menu = await getPublicMenuByDomain(decodeURIComponent(domain));
  if (!menu) return null;
  // Custom domains are a Pro feature: stop serving if the plan lapses.
  if ((await getPlanForUser(menu.restaurant.ownerId)) !== "pro") return null;
  return menu;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain } = await params;
  const menu = await load(domain);
  if (!menu) return { title: "Not found", robots: { index: false } };
  return menuMetadata(menu, `https://${menu.restaurant.customDomain}`);
}

export default async function CustomDomainPage({ params }: Props) {
  const { domain } = await params;
  const menu = await load(domain);
  if (!menu) notFound();
  return <MenuPageView menu={menu} pageUrl={`https://${menu.restaurant.customDomain}`} />;
}
