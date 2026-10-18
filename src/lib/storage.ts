import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { env, features, isProd } from "@/lib/env";
import { extensionFor, type AllowedImageType } from "@/lib/image-validate";

export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

export class StorageNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(
      `Image uploads aren't configured for production. Missing: ${missing.join(", ")}. Add Cloudinary (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) or Cloudflare R2 variables in Vercel → Settings → Environment Variables.`,
    );
    this.name = "StorageNotConfiguredError";
  }
}

export function getCloudinaryConfig(customEnv?: ReturnType<typeof env>): { cloudName: string; apiKey: string; apiSecret: string } | null {
  const e = customEnv ?? env();
  if (e.CLOUDINARY_URL) {
    try {
      const parsed = new URL(e.CLOUDINARY_URL);
      const apiKey = decodeURIComponent(parsed.username);
      const apiSecret = decodeURIComponent(parsed.password);
      const cloudName = parsed.hostname;
      if (cloudName && apiKey && apiSecret) return { cloudName, apiKey, apiSecret };
    } catch {
      // ignore malformed URL
    }
  }

  const cloudName = e.CLOUDINARY_CLOUD_NAME;
  const apiKey = e.CLOUDINARY_API_KEY;
  const apiSecret = e.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    return { cloudName, apiKey, apiSecret };
  }
  return null;
}

/** Store an image and return its public URL. Cloudinary or Cloudflare R2 in production, local disk in development. */
export async function storeImage(opts: { bytes: Uint8Array; type: AllowedImageType; folder: string }): Promise<string> {
  // 1. Cloudinary upload if configured
  const cloudinary = getCloudinaryConfig();
  if (cloudinary) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = `menupage/${opts.folder.replace(/^\/+|\/+$/g, "")}`;
    const stringToSign = `folder=${folder}&timestamp=${timestamp}${cloudinary.apiSecret}`;
    const signature = createHash("sha1").update(stringToSign).digest("hex");

    const formData = new FormData();
    formData.append("file", new Blob([opts.bytes as unknown as BlobPart], { type: opts.type }), `upload.${extensionFor(opts.type)}`);
    formData.append("folder", folder);
    formData.append("timestamp", timestamp);
    formData.append("api_key", cloudinary.apiKey);
    formData.append("signature", signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(err?.error?.message ?? `Cloudinary upload failed with status ${res.status}`);
    }

    const data = (await res.json()) as { secure_url?: string; url?: string };
    const url = data.secure_url ?? data.url;
    if (!url) throw new Error("Cloudinary upload succeeded but no URL was returned.");
    return url;
  }

  // 2. Cloudflare R2 upload if configured
  const key = `${opts.folder}/${crypto.randomUUID()}.${extensionFor(opts.type)}`;
  if (features.r2()) {
    const e = env();
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: e.R2_ACCESS_KEY_ID!, secretAccessKey: e.R2_SECRET_ACCESS_KEY! },
    });
    await client.send(
      new PutObjectCommand({
        Bucket: e.R2_BUCKET,
        Key: key,
        Body: opts.bytes,
        ContentType: opts.type,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return `${e.R2_PUBLIC_URL!.replace(/\/+$/, "")}/${key}`;
  }

  // 3. In production, require either Cloudinary or R2
  if (isProd()) {
    const e = env();
    const hasAnyCloudinary = e.CLOUDINARY_CLOUD_NAME || e.CLOUDINARY_API_KEY || e.CLOUDINARY_API_SECRET || e.CLOUDINARY_URL;
    const hasAnyR2 = e.R2_ACCOUNT_ID || e.R2_ACCESS_KEY_ID || e.R2_SECRET_ACCESS_KEY || e.R2_BUCKET || e.R2_PUBLIC_URL;

    if (hasAnyCloudinary) {
      const missingCloudinary = [
        !e.CLOUDINARY_CLOUD_NAME && "CLOUDINARY_CLOUD_NAME",
        !e.CLOUDINARY_API_KEY && "CLOUDINARY_API_KEY",
        !e.CLOUDINARY_API_SECRET && "CLOUDINARY_API_SECRET",
      ].filter((n): n is string => Boolean(n));
      throw new StorageNotConfiguredError(missingCloudinary);
    }

    if (hasAnyR2) {
      const missingR2 = [
        !e.R2_ACCOUNT_ID && "R2_ACCOUNT_ID",
        !e.R2_ACCESS_KEY_ID && "R2_ACCESS_KEY_ID",
        !e.R2_SECRET_ACCESS_KEY && "R2_SECRET_ACCESS_KEY",
        !e.R2_BUCKET && "R2_BUCKET",
        !e.R2_PUBLIC_URL && "R2_PUBLIC_URL",
      ].filter((n): n is string => Boolean(n));
      throw new StorageNotConfiguredError(missingR2);
    }

    throw new StorageNotConfiguredError([
      "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (or R2_*)",
    ]);
  }

  // 4. Local disk fallback in development
  const file = path.join(LOCAL_UPLOAD_DIR, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, opts.bytes);
  return `/uploads/${key}`;
}
