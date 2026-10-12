import { brandOgImage, OG_SIZE } from "@/server/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "MenuPage — QR menu & one-page website for restaurants";

export default function Image() {
  return brandOgImage();
}
