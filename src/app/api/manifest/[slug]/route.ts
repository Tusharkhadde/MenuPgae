import { NextResponse } from "next/server";
import { getPublicMenuBySlug } from "@/server/public-menu";
import { THEMES, type ThemeIdT } from "@/lib/themes";

export const revalidate = 3600;

/** Per-restaurant web app manifest: guests can "Add to Home screen" and open the menu offline. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const menu = await getPublicMenuBySlug(slug);
  if (!menu) return new NextResponse("Not found", { status: 404 });
  const r = menu.restaurant;
  const [bg, accent] = THEMES[(r.theme as ThemeIdT) ?? "classic"]?.swatch ?? THEMES.classic.swatch;
  const icon = (size: number) => ({ src: `/api/manifest/${r.slug}/icon?size=${size}`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" });
  return NextResponse.json(
    {
      name: r.name,
      short_name: r.name.slice(0, 12),
      description: r.tagline ?? `${r.name} menu`,
      start_url: `/r/${r.slug}?source=pwa`,
      scope: `/r/${r.slug}`,
      display: "standalone",
      background_color: bg,
      theme_color: accent,
      icons: [icon(192), icon(512), { ...icon(512), purpose: "maskable" }],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
