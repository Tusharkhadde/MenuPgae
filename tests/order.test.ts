import { describe, expect, it } from "vitest";
import { OrderError, nextStatus, placeOrderSchema, priceOrder, type PricingItem } from "@/lib/order";
import type { CouponRule } from "@/lib/schedule";

const item = (p: Partial<PricingItem> & { id: string }): PricingItem => ({
  name: p.id,
  priceMinor: 10000,
  soldOut: false,
  options: null,
  happyHour: false,
  availability: null,
  categoryAvailability: null,
  ...p,
});

const items = new Map<string, PricingItem>([
  ["chai", item({ id: "chai", name: "Masala Chai", priceMinor: 4000, happyHour: true })],
  ["thali", item({ id: "thali", name: "Thali", options: { variants: [{ id: "h", name: "Half", priceMinor: 15000 }, { id: "f", name: "Full", priceMinor: 25000 }], groups: [] } })],
  ["gone", item({ id: "gone", soldOut: true })],
  ["brekkie", item({ id: "brekkie", name: "Poha", categoryAvailability: { from: "08:00", to: "11:00" } })],
]);
const NOON_IST = new Date("2026-10-12T06:30:00Z");
const FIVE_PM_IST = new Date("2026-10-12T11:30:00Z");
const ctx = { items, timezone: "Asia/Kolkata", happyHour: null, now: NOON_IST };

describe("server-side order pricing", () => {
  it("re-prices from the menu, ignoring anything the browser claims", () => {
    const r = priceOrder({ lines: [{ itemId: "chai", qty: 2 }, { itemId: "thali", qty: 1, variantId: "f" }] }, ctx);
    expect(r.lines).toEqual([
      { itemId: "chai", name: "Masala Chai", qty: 2, unitMinor: 4000, options: null },
      { itemId: "thali", name: "Thali", qty: 1, unitMinor: 25000, options: "Full" },
    ]);
    expect(r.totalMinor).toBe(33000);
  });

  it("merges duplicate lines", () => {
    const r = priceOrder({ lines: [{ itemId: "chai", qty: 1 }, { itemId: "chai", qty: 3 }] }, ctx);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].qty).toBe(4);
  });

  it("rejects unknown, sold-out, out-of-hours and incomplete items", () => {
    expect(() => priceOrder({ lines: [{ itemId: "nope", qty: 1 }] }, ctx)).toThrow(OrderError);
    expect(() => priceOrder({ lines: [{ itemId: "gone", qty: 1 }] }, ctx)).toThrow(/sold out/);
    expect(() => priceOrder({ lines: [{ itemId: "brekkie", qty: 1 }] }, ctx)).toThrow(/isn't available/);
    expect(() => priceOrder({ lines: [{ itemId: "thali", qty: 1 }] }, ctx)).toThrow(/Choose a size/);
  });

  it("applies happy hour only to marked items, only in the window", () => {
    const hh = { enabled: true, percent: 50, from: "16:00", to: "19:00" };
    const during = priceOrder({ lines: [{ itemId: "chai", qty: 1 }, { itemId: "thali", qty: 1, variantId: "h" }] }, { ...ctx, happyHour: hh, now: FIVE_PM_IST });
    expect(during.happyHour).toBe(true);
    expect(during.lines.map((l) => l.unitMinor)).toEqual([2000, 15000]);
    const before = priceOrder({ lines: [{ itemId: "chai", qty: 1 }] }, { ...ctx, happyHour: hh });
    expect(before.lines[0].unitMinor).toBe(4000);
  });

  it("coupons: only when allowed by the plan, validated on the server", () => {
    const coupon: CouponRule = { code: "TEN", kind: "percent", value: 10, minOrderMinor: 0, active: true, expiresAt: null, maxUses: null, uses: 0 };
    const ok = priceOrder({ lines: [{ itemId: "thali", qty: 2, variantId: "f" }], coupon: "TEN" }, { ...ctx, coupon, couponsAllowed: true });
    expect(ok).toMatchObject({ subtotalMinor: 50000, discountMinor: 5000, totalMinor: 45000, couponCode: "TEN" });
    expect(() => priceOrder({ lines: [{ itemId: "chai", qty: 1 }], coupon: "TEN" }, { ...ctx, coupon, couponsAllowed: false })).toThrow(/aren't available/);
    expect(() => priceOrder({ lines: [{ itemId: "chai", qty: 1 }], coupon: "NOPE" }, { ...ctx, coupon: null, couponsAllowed: true })).toThrow(/isn't valid/);
  });

  it("validates the guest payload shape", () => {
    expect(placeOrderSchema.safeParse({ r: "x", lines: [] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ r: "x", lines: [{ itemId: "a", qty: 100 }] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ r: "x", lines: [{ itemId: "a", qty: 1, priceMinor: 1 }] }).success).toBe(true); // extra keys are ignored
  });

  it("kitchen flow new → preparing → ready → done", () => {
    expect(nextStatus("new")).toBe("preparing");
    expect(nextStatus("preparing")).toBe("ready");
    expect(nextStatus("ready")).toBe("done");
    expect(nextStatus("done")).toBeNull();
    expect(nextStatus("cancelled")).toBeNull();
  });
});
