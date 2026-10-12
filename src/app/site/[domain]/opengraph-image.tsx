import { getPublicMenuByDomain } from "@/server/public-menu";
import { brandOgImage, menuOgImage, OG_SIZE } from "@/server/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Restaurant menu";
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const menu = await getPublicMenuByDomain(decodeURIComponent(domain)).catch(() => null);
  if (!menu) return brandOgImage();
  const r = menu.restaurant;
  return menuOgImage({ name: r.name, subtitle: r.tagline ?? r.cuisine, theme: r.theme, showBrand: menu.showBadge });
}
