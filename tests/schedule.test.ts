import { describe, expect, it } from "vitest";
import { applyPercent, describeAvailability, evaluateCoupon, isAvailableAt, isHappyHourNow, localDate, normalizeCouponCode, type CouponRule } from "@/lib/schedule";

// 2026-10-12 is a Monday. 09:00 IST = 03:30 UTC.
const at = (iso: string) => new Date(iso);
const TZ = "Asia/Kolkata";

describe("availability", () => {
  it("no rule = always available", () => {
    expect(isAvailableAt(null, TZ, at("2026-10-12T03:30:00Z"))).toBe(true);
  });

  it("breakfast window 08:00–11:30 in the restaurant's timezone", () => {
    const breakfast = { from: "08:00", to: "11:30" };
    expect(isAvailableAt(breakfast, TZ, at("2026-10-12T03:30:00Z"))).toBe(true); // 09:00 IST
    expect(isAvailableAt(breakfast, TZ, at("2026-10-12T07:00:00Z"))).toBe(false); // 12:30 IST
    expect(isAvailableAt(breakfast, "Europe/London", at("2026-10-12T03:30:00Z"))).toBe(false); // 04:30 London
  });

  it("day-of-week rules (0 = Monday)", () => {
    expect(isAvailableAt({ days: [5, 6] }, TZ, at("2026-10-12T06:00:00Z"))).toBe(false);
    expect(isAvailableAt({ days: [0] }, TZ, at("2026-10-12T06:00:00Z"))).toBe(true);
  });

  it("overnight windows belong to the day they start", () => {
    const lateFriday = { days: [4], from: "22:00", to: "02:00" };
    // Saturday 2026-10-17 01:00 IST (Fri 19:30 UTC)
    expect(isAvailableAt(lateFriday, TZ, at("2026-10-16T19:30:00Z"))).toBe(true);
    // Saturday 23:00 IST — Saturday isn't in the rule
    expect(isAvailableAt(lateFriday, TZ, at("2026-10-17T17:30:00Z"))).toBe(false);
  });

  it("describes schedules for guests", () => {
    expect(describeAvailability({ days: [5, 6], from: "08:00", to: "12:00" })).toBe("Sat, Sun · 08:00–12:00");
    expect(describeAvailability({ days: [0, 1, 2, 3, 4, 5, 6] })).toBeNull();
    expect(describeAvailability(null)).toBeNull();
  });
});

describe("happy hour", () => {
  const hh = { enabled: true, percent: 25, from: "16:00", to: "19:00" };
  it("is active only inside its window and when enabled", () => {
    expect(isHappyHourNow(hh, TZ, at("2026-10-12T11:30:00Z"))).toBe(true); // 17:00 IST
    expect(isHappyHourNow(hh, TZ, at("2026-10-12T14:00:00Z"))).toBe(false); // 19:30 IST
    expect(isHappyHourNow({ ...hh, enabled: false }, TZ, at("2026-10-12T11:30:00Z"))).toBe(false);
    expect(isHappyHourNow(null, TZ)).toBe(false);
  });
  it("rounds discounted prices to whole minor units", () => {
    expect(applyPercent(19900, 25)).toBe(14925);
    expect(applyPercent(999, 33)).toBe(669);
    expect(applyPercent(100, 100)).toBe(0);
  });
});

describe("coupons", () => {
  const base: CouponRule = { code: "WELCOME10", kind: "percent", value: 10, minOrderMinor: 0, active: true, expiresAt: null, maxUses: null, uses: 0 };
  it("percent and fixed amount, capped at the subtotal", () => {
    expect(evaluateCoupon(base, 45000, "2026-10-12")).toEqual({ ok: true, discountMinor: 4500 });
    expect(evaluateCoupon({ ...base, kind: "amount", value: 10000 }, 6000, "2026-10-12")).toEqual({ ok: true, discountMinor: 6000 });
  });
  it("rejects inactive, expired, used-up and below-minimum", () => {
    expect(evaluateCoupon({ ...base, active: false }, 1000, "2026-10-12").ok).toBe(false);
    expect(evaluateCoupon({ ...base, expiresAt: "2026-10-11" }, 1000, "2026-10-12").ok).toBe(false);
    expect(evaluateCoupon({ ...base, expiresAt: "2026-10-12" }, 1000, "2026-10-12").ok).toBe(true);
    expect(evaluateCoupon({ ...base, maxUses: 5, uses: 5 }, 1000, "2026-10-12").ok).toBe(false);
    expect(evaluateCoupon({ ...base, minOrderMinor: 50000 }, 49999, "2026-10-12").ok).toBe(false);
    expect(evaluateCoupon(null, 1000, "2026-10-12").ok).toBe(false);
  });
  it("normalizes codes and computes local dates", () => {
    expect(normalizeCouponCode(" welcome 10 ")).toBe("WELCOME10");
    expect(localDate(at("2026-10-12T20:00:00Z"), TZ)).toBe("2026-10-13");
    expect(localDate(at("2026-10-12T20:00:00Z"), "America/New_York")).toBe("2026-10-12");
  });
});
