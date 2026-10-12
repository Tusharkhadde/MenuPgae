import "server-only";
import QRCode from "qrcode";

export function qrTargetUrl(baseUrl: string, slug: string, table?: string | null): string {
  const u = new URL(`/q/${slug}`, baseUrl);
  if (table) u.searchParams.set("t", table);
  return u.toString();
}

const opts = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark: "#111111", light: "#ffffff" } };

export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { ...opts, type: "svg" });
}

export function qrPng(text: string, width = 1024): Promise<Buffer> {
  return QRCode.toBuffer(text, { ...opts, type: "png", width });
}

export { parseTables } from "@/lib/tables";
