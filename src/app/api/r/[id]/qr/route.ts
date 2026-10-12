import { getSessionUser, findOwnedRestaurant } from "@/server/session";
import { qrPng, qrSvg, qrTargetUrl } from "@/lib/qr";
import { sanitizeTable } from "@/lib/whatsapp";
import { appUrl } from "@/lib/env";

/** Owner-only QR download: ?format=png|svg&t=<table> */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const restaurant = await findOwnedRestaurant(user.id, id);
  if (!restaurant) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "svg" ? "svg" : "png";
  const table = sanitizeTable(url.searchParams.get("t"));
  const target = qrTargetUrl(appUrl(), restaurant.slug, table);
  const filename = `${restaurant.slug}${table ? `-table-${table.replace(/\s+/g, "-")}` : ""}-qr.${format}`;
  const headers = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  };
  if (format === "svg") {
    return new Response(await qrSvg(target), { headers: { ...headers, "Content-Type": "image/svg+xml" } });
  }
  const png = await qrPng(target, 1200);
  return new Response(new Uint8Array(png), { headers: { ...headers, "Content-Type": "image/png" } });
}
