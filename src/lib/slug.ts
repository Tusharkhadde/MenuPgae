import { RESERVED_SLUGS } from "@/config/reserved-slugs";

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export type SlugCheck = { ok: true } | { ok: false; reason: string };

export function validateSlug(slug: string): SlugCheck {
  if (!SLUG_RE.test(slug)) {
    return { ok: false, reason: "Use 3–40 lowercase letters, numbers or dashes (no dash at the start or end)." };
  }
  if (slug.includes("--")) return { ok: false, reason: "Avoid double dashes." };
  if (RESERVED_SLUGS.has(slug) || slug.startsWith("demo-")) {
    return { ok: false, reason: "That address is reserved. Try another one." };
  }
  return { ok: true };
}
