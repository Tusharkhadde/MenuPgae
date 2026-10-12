import { ImageResponse } from "next/og";
import { getPublicMenuBySlug } from "@/server/public-menu";
import { THEMES, type ThemeIdT } from "@/lib/themes";

export const revalidate = 86400;

/** Generated app icon: the restaurant's initial on its theme colour. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const size = new URL(req.url).searchParams.get("size") === "192" ? 192 : 512;
  const menu = await getPublicMenuBySlug(slug);
  const name = menu?.restaurant.name ?? "M";
  const [, accent, fg] = THEMES[(menu?.restaurant.theme as ThemeIdT) ?? "classic"]?.swatch ?? THEMES.classic.swatch;
  const light = fg === "#f5f5f4";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: accent, color: light ? "#0f0f12" : "#ffffff", fontSize: size * 0.5, fontWeight: 700 }}>
        {name.trim().slice(0, 1).toUpperCase()}
      </div>
    ),
    { width: size, height: size },
  );
}
