import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getCloudinaryConfig, storeImage, StorageNotConfiguredError } from "@/lib/storage";
import { _resetEnvCache } from "@/lib/env";

describe("Cloudinary storage", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    _resetEnvCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    _resetEnvCache();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("extracts config from CLOUDINARY_URL", () => {
    process.env.CLOUDINARY_URL = "cloudinary://my_key:my_secret@my_cloud";
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
    _resetEnvCache();

    const config = getCloudinaryConfig();
    expect(config).toEqual({
      cloudName: "my_cloud",
      apiKey: "my_key",
      apiSecret: "my_secret",
    });
  });

  it("extracts config from individual CLOUDINARY_* environment variables", () => {
    delete process.env.CLOUDINARY_URL;
    process.env.CLOUDINARY_CLOUD_NAME = "custom_cloud";
    process.env.CLOUDINARY_API_KEY = "custom_key";
    process.env.CLOUDINARY_API_SECRET = "custom_secret";
    _resetEnvCache();

    const config = getCloudinaryConfig();
    expect(config).toEqual({
      cloudName: "custom_cloud",
      apiKey: "custom_key",
      apiSecret: "custom_secret",
    });
  });

  it("returns null when Cloudinary variables are not set", () => {
    delete process.env.CLOUDINARY_URL;
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
    _resetEnvCache();

    expect(getCloudinaryConfig()).toBeNull();
  });

  it("uploads successfully to Cloudinary and returns secure URL", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "testcloud";
    process.env.CLOUDINARY_API_KEY = "testkey";
    process.env.CLOUDINARY_API_SECRET = "testsecret";
    _resetEnvCache();

    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        secure_url: "https://res.cloudinary.com/testcloud/image/upload/v12345/menupage/r/1/upload.png",
      }),
    });
    vi.stubGlobal("fetch", fakeFetch);

    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header
    const url = await storeImage({
      bytes,
      type: "image/png",
      folder: "r/1",
    });

    expect(url).toBe("https://res.cloudinary.com/testcloud/image/upload/v12345/menupage/r/1/upload.png");
    expect(fakeFetch).toHaveBeenCalledOnce();

    const [fetchUrl, fetchOptions] = fakeFetch.mock.calls[0];
    expect(fetchUrl).toBe("https://api.cloudinary.com/v1_1/testcloud/image/upload");
    expect(fetchOptions.method).toBe("POST");

    const formData = fetchOptions.body as FormData;
    expect(formData.get("folder")).toBe("menupage/r/1");
    expect(formData.get("api_key")).toBe("testkey");
    expect(formData.get("signature")).toBeDefined();
    expect(formData.get("timestamp")).toBeDefined();
  });

  it("throws clear error when Cloudinary responds with failure", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "testcloud";
    process.env.CLOUDINARY_API_KEY = "testkey";
    process.env.CLOUDINARY_API_SECRET = "testsecret";
    _resetEnvCache();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "Invalid API Key" } }),
      }),
    );

    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    await expect(
      storeImage({
        bytes,
        type: "image/png",
        folder: "r/1",
      }),
    ).rejects.toThrow("Invalid API Key");
  });

  it("throws StorageNotConfiguredError in production when neither Cloudinary nor R2 is configured", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.CLOUDINARY_URL;
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET;
    delete process.env.R2_PUBLIC_URL;
    _resetEnvCache();

    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    await expect(
      storeImage({
        bytes,
        type: "image/png",
        folder: "r/1",
      }),
    ).rejects.toThrow(StorageNotConfiguredError);
  });
});
