export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // keep under Vercel's 4.5 MB request limit
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

const EXT: Record<AllowedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export function extensionFor(type: AllowedImageType) {
  return EXT[type];
}

/** Detect the real image type from magic bytes (never trust the client-sent MIME type). */
export function sniffImageType(bytes: Uint8Array): AllowedImageType | null {
  const b = bytes;
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) return "image/avif";
  return null;
}

export type ImageCheck = { ok: true; type: AllowedImageType } | { ok: false; error: string };

export function validateImage(bytes: Uint8Array): ImageCheck {
  if (bytes.byteLength === 0) return { ok: false, error: "The file is empty." };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return { ok: false, error: "Images must be 4 MB or smaller." };
  const type = sniffImageType(bytes);
  if (!type) return { ok: false, error: "Upload a JPG, PNG, WebP or AVIF image." };
  return { ok: true, type };
}
