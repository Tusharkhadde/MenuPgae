import { describe, expect, it } from "vitest";
import { slugify, validateSlug } from "@/lib/slug";
import { parseTables } from "@/lib/tables";
import { sniffImageType, validateImage, MAX_UPLOAD_BYTES } from "@/lib/image-validate";

describe("slug", () => {
  it("slugifies names", () => {
    expect(slugify("Chai & Crumbs")).toBe("chai-and-crumbs");
    expect(slugify("  Café Délice!! ")).toBe("cafe-delice");
    expect(slugify("A".repeat(60))).toHaveLength(40);
  });

  it("validates format and reserved words", () => {
    expect(validateSlug("chai-and-crumbs").ok).toBe(true);
    expect(validateSlug("ab").ok).toBe(false);
    expect(validateSlug("-abc").ok).toBe(false);
    expect(validateSlug("abc-").ok).toBe(false);
    expect(validateSlug("a--b").ok).toBe(false);
    expect(validateSlug("Upper").ok).toBe(false);
    expect(validateSlug("dashboard").ok).toBe(false);
    expect(validateSlug("admin").ok).toBe(false);
    expect(validateSlug("demo").ok).toBe(false);
    expect(validateSlug("demo-abc123").ok).toBe(false);
  });
});

describe("table parsing", () => {
  it("expands ranges and names, bounded", () => {
    expect(parseTables("1-3", 10)).toEqual(["1", "2", "3"]);
    expect(parseTables("A1-A3, Patio, Bar", 10)).toEqual(["A1", "A2", "A3", "Patio", "Bar"]);
    expect(parseTables("1-100", 5)).toHaveLength(5);
    expect(parseTables("1,1,2", 10)).toEqual(["1", "2"]);
    expect(parseTables("<x>", 10)).toEqual([]);
  });
});

describe("image validation", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
  it("sniffs real image types from magic bytes", () => {
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(jpg)).toBe("image/jpeg");
    expect(sniffImageType(webp)).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("rejects empty, oversized and non-image files", () => {
    expect(validateImage(new Uint8Array())).toMatchObject({ ok: false });
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(png);
    expect(validateImage(big)).toMatchObject({ ok: false });
    expect(validateImage(png)).toEqual({ ok: true, type: "image/png" });
  });
});
