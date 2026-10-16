import { describe, expect, it } from "vitest";
import { PLANS, PRO_PRICE_NOTE, isPlanId } from "@/config/plans";
import * as plans from "@/config/plans";
import {
  LimitError,
  analyticsSince,
  assertCanAddItems,
  assertCanAddRestaurant,
  assertCustomDomain,
  canAddCategory,
  canAddItems,
  canAddRestaurant,
  showBadge,
} from "@/lib/limits";

describe("plans config", () => {
  it("Free is 1 restaurant / 50 items with the badge and 7-day analytics", () => {
    expect(PLANS.free.limits).toMatchObject({ restaurants: 1, itemsPerRestaurant: 50, analyticsDays: 7, customDomain: false, removeBadge: false });
  });

  it("Pro unlocks branches, custom domain, no badge and 90-day analytics", () => {
    expect(PLANS.pro.limits.restaurants).toBeGreaterThan(1);
    expect(PLANS.pro.limits.itemsPerRestaurant).toBeGreaterThan(PLANS.free.limits.itemsPerRestaurant);
    expect(PLANS.pro.limits).toMatchObject({ analyticsDays: 90, customDomain: true, removeBadge: true });
  });

  it("shows no invented Pro price: the checkout (Dodo product) is the only source of the amount", () => {
    expect("PRO_PRICE_LABELS" in plans).toBe(false);
    expect(PRO_PRICE_NOTE).toMatch(/checkout/i);
    expect(PRO_PRICE_NOTE).not.toMatch(/[₹$€£]\s?\d|\d+\s?(AED|S\$)/);
  });

  it("validates plan ids", () => {
    expect(isPlanId("free")).toBe(true);
    expect(isPlanId("pro")).toBe(true);
    expect(isPlanId("enterprise")).toBe(false);
  });
});

describe("limits", () => {
  it("restaurants", () => {
    expect(canAddRestaurant("free", 0)).toBe(true);
    expect(canAddRestaurant("free", 1)).toBe(false);
    expect(canAddRestaurant("pro", 1)).toBe(true);
    expect(() => assertCanAddRestaurant("free", 1)).toThrow(LimitError);
    expect(() => assertCanAddRestaurant("free", 1)).toThrow(/Upgrade to Pro/);
  });

  it("items", () => {
    expect(canAddItems("free", 49)).toBe(true);
    expect(canAddItems("free", 50)).toBe(false);
    expect(canAddItems("free", 40, 10)).toBe(true);
    expect(canAddItems("free", 41, 10)).toBe(false);
    expect(() => assertCanAddItems("free", 50)).toThrow(LimitError);
    expect(() => assertCanAddItems("pro", 50)).not.toThrow();
  });

  it("categories", () => {
    expect(canAddCategory("free", PLANS.free.limits.categoriesPerRestaurant - 1)).toBe(true);
    expect(canAddCategory("free", PLANS.free.limits.categoriesPerRestaurant)).toBe(false);
  });

  it("custom domain and badge", () => {
    expect(() => assertCustomDomain("free")).toThrow(LimitError);
    expect(() => assertCustomDomain("pro")).not.toThrow();
    expect(showBadge("free")).toBe(true);
    expect(showBadge("pro")).toBe(false);
  });

  it("analytics window", () => {
    const now = new Date("2026-10-12T10:00:00Z");
    expect(analyticsSince("free", now)).toBe("2026-10-06");
    expect(analyticsSince("pro", now)).toBe("2026-07-15");
  });
});

describe("beast-mode feature gating", () => {
  it("keeps core ordering features on Free and gates premium ones to Pro", async () => {
    const { hasFeature, assertFeature, assertLanguages, assertTeamSize, LimitError: LE } = await import("@/lib/limits");
    expect(PLANS.free.limits).toMatchObject({ orderHistoryDays: 7, extraLanguages: 1, teamMembers: 0 });
    expect(PLANS.pro.limits).toMatchObject({ orderHistoryDays: 90, extraLanguages: 6, teamMembers: 10 });
    for (const f of ["kitchenDisplay", "coupons", "happyHour", "reservations", "weeklyDigest", "aiTools"] as const) {
      expect(hasFeature("free", f)).toBe(false);
      expect(hasFeature("pro", f)).toBe(true);
      expect(() => assertFeature("free", f)).toThrow(LE);
      expect(() => assertFeature("pro", f)).not.toThrow();
    }
    expect(() => assertLanguages("free", 1)).not.toThrow();
    expect(() => assertLanguages("free", 2)).toThrow(/Upgrade/);
    expect(() => assertLanguages("pro", 6)).not.toThrow();
    expect(() => assertTeamSize("free", 1)).toThrow(/Pro feature/);
    expect(() => assertTeamSize("pro", 10)).not.toThrow();
    expect(() => assertTeamSize("pro", 11)).toThrow();
  });
});
