import { describe, expect, it } from "vitest";
import { businessInfoSchema, createRestaurantSchema, domainSchema, itemSchema, trackSchema } from "@/lib/validation";
import { defaultHours } from "@/lib/hours";
import { rateLimit, _resetRateLimits } from "@/lib/rate-limit";

describe("validation", () => {
  it("creates a restaurant with sane defaults", () => {
    const r = createRestaurantSchema.parse({ name: "Chai & Crumbs", slug: "chai-and-crumbs", currency: "INR", timezone: "Asia/Kolkata", whatsapp: "", logoUrl: "" });
    expect(r).toMatchObject({ theme: "classic", whatsapp: null, logoUrl: null, cuisine: null, sampleMenu: false });
  });

  it("rejects bad currency, timezone and slug", () => {
    expect(createRestaurantSchema.safeParse({ name: "X Y", slug: "ok-slug", currency: "XXX", timezone: "Asia/Kolkata" }).success).toBe(false);
    expect(createRestaurantSchema.safeParse({ name: "X Y", slug: "ok-slug", currency: "INR", timezone: "Mars/Base" }).success).toBe(false);
    expect(createRestaurantSchema.safeParse({ name: "X Y", slug: "Not OK", currency: "INR", timezone: "Asia/Kolkata" }).success).toBe(false);
  });

  it("normalizes links and Instagram handles", () => {
    const base = { name: "Cafe", whatsappOrdering: true, currency: "INR", timezone: "Asia/Kolkata", hours: defaultHours() };
    const r = businessInfoSchema.parse({ ...base, mapsUrl: "maps.app.goo.gl/abc", instagram: "https://instagram.com/my.cafe/", swiggyUrl: "" });
    expect(r.mapsUrl).toBe("https://maps.app.goo.gl/abc");
    expect(r.instagram).toBe("my.cafe");
    expect(r.swiggyUrl).toBeNull();
    expect(businessInfoSchema.safeParse({ ...base, mapsUrl: "javascript:alert(1)" }).success).toBe(false);
  });

  it("validates items", () => {
    const ok = itemSchema.parse({ categoryId: "c", name: "Dosa", price: "120", imageUrl: "", diet: "", spicy: "2", allergens: ["gluten"], bestseller: false, soldOut: false });
    expect(ok).toMatchObject({ diet: null, spicy: 2, imageUrl: null });
    expect(itemSchema.safeParse({ categoryId: "c", name: "", price: "1", diet: null, spicy: 0, allergens: [], bestseller: false, soldOut: false }).success).toBe(false);
    expect(itemSchema.safeParse({ categoryId: "c", name: "x", price: "1", diet: null, spicy: 5, allergens: [], bestseller: false, soldOut: false }).success).toBe(false);
  });

  it("validates domains", () => {
    expect(domainSchema.parse("https://Menu.MyCafe.com/")).toBe("menu.mycafe.com");
    expect(domainSchema.safeParse("localhost").success).toBe(false);
    expect(domainSchema.safeParse("not a domain").success).toBe(false);
  });

  it("validates analytics beacons", () => {
    expect(trackSchema.safeParse({ r: "id", type: "view" }).success).toBe(true);
    expect(trackSchema.safeParse({ r: "id", type: "scan" }).success).toBe(false);
    expect(trackSchema.safeParse({ r: "id", type: "whatsapp", items: [{ id: "a", qty: 0 }] }).success).toBe(false);
  });
});

describe("rate limit", () => {
  it("allows up to the limit in a window then blocks", () => {
    _resetRateLimits();
    const t = 1_000_000;
    expect(rateLimit("k", 2, 1000, t).ok).toBe(true);
    expect(rateLimit("k", 2, 1000, t + 1).ok).toBe(true);
    const blocked = rateLimit("k", 2, 1000, t + 2);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(rateLimit("k", 2, 1000, t + 1001).ok).toBe(true);
  });
});
