import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env, features, isProd } from "@/lib/env";
import { extensionFor, type AllowedImageType } from "@/lib/image-validate";

export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Image uploads aren't configured yet. Add the R2_* environment variables (see README) or paste an image link.");
    this.name = "StorageNotConfiguredError";
  }
}

/** Store an image and return its public URL. Cloudflare R2 in production, local disk in development. */
export async function storeImage(opts: { bytes: Uint8Array; type: AllowedImageType; folder: string }): Promise<string> {
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

  if (isProd()) throw new StorageNotConfiguredError();

  const file = path.join(LOCAL_UPLOAD_DIR, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, opts.bytes);
  return `/uploads/${key}`;
}
