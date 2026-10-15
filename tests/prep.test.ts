import { describe, expect, it } from "vitest";
import { addDays, historyDays, holidaysBetween, localHour, ordersToHistory, tomorrowLocal } from "@/lib/prep/history";
import { generateSyntheticHistory, prng } from "@/lib/prep/synthetic";
import { PLANS } from "@/config/plans";
import { LimitError, assertFeature, hasFeature } from "@/lib/limits";
import { tabsForRole } from "@/lib/roles";

describe("order history export", () => {
  const catalog = new Map([
    ["i1", { name: "Vada Pav", category: "Snacks" }],
    ["i2", { name: "Masala Chai", category: "Chai" }],
  ]);
  const at = (iso: string) => new Date(iso);
  it("aggregates per local date/hour/dish, skips cancelled, converts minor units", () => {
    const rows = ordersToHistory(
      [
        { day: "2026-10-10", createdAt: at("2026-10-10T11:45:00Z"), status: "done", lines: [{ itemId: "i1", name: "Vada Pav", qty: 2, unitMinor: 2000, options: null }] },
        { day: "2026-10-10", createdAt: at("2026-10-10T11:50:00Z"), status: "new", lines: [{ itemId: "i1", name: "Vada Pav", qty: 1, unitMinor: 2000, options: null }, { itemId: "i2", name: "Masala Chai", qty: 3, unitMinor: 2500, options: null }] },
        { day: "2026-10-10", createdAt: at("2026-10-10T12:00:00Z"), status: "cancelled", lines: [{ itemId: "i1", name: "Vada Pav", qty: 9, unitMinor: 2000, options: null }] },
        { day: "2026-10-11", createdAt: at("2026-10-11T03:00:00Z"), status: "done", lines: [{ itemId: "gone", name: "Old Dish", qty: 1, unitMinor: 5000, options: null }] },
      ],
      catalog,
      "Asia/Kolkata",
    );
    expect(rows).toEqual([
      { date: "2026-10-10", hour: 17, item: "Masala Chai", category: "Chai", qty: 3, price: 25 },
      { date: "2026-10-10", hour: 17, item: "Vada Pav", category: "Snacks", qty: 3, price: 20 },
      { date: "2026-10-11", hour: 8, item: "Old Dish", category: "Other", qty: 1, price: 50 },
    ]);
    expect(historyDays(rows)).toBe(2);
  });
  it("computes restaurant-local hour and tomorrow", () => {
    expect(localHour(at("2026-10-10T20:00:00Z"), "Asia/Kolkata")).toBe(1);
    expect(tomorrowLocal("Asia/Kolkata", at("2026-10-15T20:00:00Z"))).toBe("2026-10-17");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("lists fixed-date Indian holidays in a range", () => {
    expect(holidaysBetween("2026-09-25", "2026-10-05")).toEqual(["2026-10-02"]);
    expect(holidaysBetween("2027-01-01", "2027-01-31")).toEqual(["2027-01-26"]);
  });
});

describe("synthetic demo history", () => {
  const items = [
    { name: "Masala Chai", category: "Chai & Coffee", price: 25 },
    { name: "Vada Pav", category: "Street food", price: 20 },
    { name: "Paneer Tikka", category: "Mains", price: 260 },
  ];
  it("is deterministic for a seed and covers the window", () => {
    const a = generateSyntheticHistory({ items, days: 28, endDate: "2026-10-14", seed: 1 });
    const b = generateSyntheticHistory({ items, days: 28, endDate: "2026-10-14", seed: 1 });
    expect(a).toEqual(b);
    expect(historyDays(a)).toBe(28);
    expect(a[0].date).toBe("2026-09-17");
    expect(a.every((r) => r.qty > 0 && Number.isInteger(r.qty))).toBe(true);
    expect(generateSyntheticHistory({ items, days: 28, endDate: "2026-10-14", seed: 2 })).not.toEqual(a);
  });
  it("sells more on weekends than midweek on average", () => {
    const rows = generateSyntheticHistory({ items, days: 56, endDate: "2026-10-14", seed: 3 });
    const byDow = new Map<number, number>();
    for (const r of rows) {
      const d = new Date(`${r.date}T00:00:00Z`).getUTCDay();
      byDow.set(d, (byDow.get(d) ?? 0) + r.qty);
    }
    expect(byDow.get(6)!).toBeGreaterThan(byDow.get(2)!);
  });
  it("prng is in [0,1)", () => {
    const r = prng(9);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("prep planner gating", () => {
  it("is Pro-only", () => {
    expect(PLANS.free.limits.prepPlanner).toBe(false);
    expect(PLANS.pro.limits.prepPlanner).toBe(true);
    expect(hasFeature("pro", "prepPlanner")).toBe(true);
    expect(() => assertFeature("free", "prepPlanner")).toThrow(LimitError);
  });
  it("is visible to managers and owners, not staff", () => {
    expect(tabsForRole("manager")).toContain("insights");
    expect(tabsForRole("owner")).toContain("insights");
    expect(tabsForRole("staff")).not.toContain("insights");
  });
});
