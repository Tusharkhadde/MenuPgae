import { describe, expect, it } from "vitest";
import { itemOptionsSchema, normalizeOptions, resolveSelection, startingPrice, type ItemOptions } from "@/lib/options";

const pizza: ItemOptions = {
  variants: [
    { id: "s", name: "Small", priceMinor: 19900 },
    { id: "l", name: "Large", priceMinor: 39900 },
  ],
  groups: [
    { id: "crust", name: "Crust", min: 1, max: 1, options: [{ id: "thin", name: "Thin", priceMinor: 0 }, { id: "cheese", name: "Cheese burst", priceMinor: 9900 }] },
    { id: "top", name: "Extra toppings", min: 0, max: 2, options: [{ id: "olive", name: "Olives", priceMinor: 3000 }, { id: "jal", name: "Jalapeño", priceMinor: 3000 }, { id: "pan", name: "Paneer", priceMinor: 5000 }] },
  ],
};

describe("item options", () => {
  it("prices a valid selection: variant + required + optional add-ons", () => {
    const r = resolveSelection("p1", 0, pizza, { variantId: "l", modifiers: { crust: ["cheese"], top: ["pan", "olive"] } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.unitMinor).toBe(39900 + 9900 + 3000 + 5000);
    // label keeps the owner's option order, not the click order
    expect(r.label).toBe("Large, Cheese burst, Olives, Paneer");
    expect(r.key).toBe("p1|l|crust=cheese|top=olive+pan");
  });

  it("same choices in a different order give the same cart key", () => {
    const a = resolveSelection("p1", 0, pizza, { variantId: "s", modifiers: { crust: ["thin"], top: ["jal", "olive"] } });
    const b = resolveSelection("p1", 0, pizza, { variantId: "s", modifiers: { top: ["olive", "jal"], crust: ["thin"] } });
    expect(a.ok && b.ok && a.key === b.key).toBe(true);
  });

  it("rejects missing size, missing required group, too many add-ons and unknown ids", () => {
    expect(resolveSelection("p1", 0, pizza, { modifiers: { crust: ["thin"] } })).toEqual({ ok: false, error: "Choose a size" });
    expect(resolveSelection("p1", 0, pizza, { variantId: "s" })).toEqual({ ok: false, error: "Choose Crust" });
    expect(resolveSelection("p1", 0, pizza, { variantId: "s", modifiers: { crust: ["thin"], top: ["olive", "jal", "pan"] } }).ok).toBe(false);
    expect(resolveSelection("p1", 0, pizza, { variantId: "xl", modifiers: { crust: ["thin"] } }).ok).toBe(false);
    expect(resolveSelection("p1", 0, pizza, { variantId: "s", modifiers: { crust: ["stuffed"] } }).ok).toBe(false);
    expect(resolveSelection("p1", 0, pizza, { variantId: "s", modifiers: { crust: ["thin"], hack: ["x"] } }).ok).toBe(false);
  });

  it("plain items use the base price and a stable key", () => {
    const r = resolveSelection("chai", 4000, null, {});
    expect(r).toMatchObject({ ok: true, unitMinor: 4000, label: "", key: "chai|" });
    expect(resolveSelection("chai", 4000, null, { variantId: "x" }).ok).toBe(false);
  });

  it("starting price = cheapest size + cheapest required add-ons", () => {
    expect(startingPrice(0, pizza)).toBe(19900);
    expect(startingPrice(5000, null)).toBe(5000);
    const req: ItemOptions = { variants: [], groups: [{ id: "g", name: "Pick 2", min: 2, max: 2, options: [{ id: "a", name: "A", priceMinor: 500 }, { id: "b", name: "B", priceMinor: 100 }, { id: "c", name: "C", priceMinor: 300 }] }] };
    expect(startingPrice(1000, req)).toBe(1400);
  });

  it("validates the owner's options", () => {
    expect(itemOptionsSchema.safeParse(pizza).success).toBe(true);
    expect(itemOptionsSchema.safeParse({ variants: [{ id: "a", name: "Only", priceMinor: 1 }], groups: [] }).success).toBe(false);
    expect(itemOptionsSchema.safeParse({ variants: [], groups: [{ id: "g", name: "G", min: 3, max: 2, options: [{ id: "a", name: "A", priceMinor: 0 }] }] }).success).toBe(false);
    expect(itemOptionsSchema.safeParse({ variants: [], groups: [{ id: "g", name: "G", min: 2, max: 2, options: [{ id: "a", name: "A", priceMinor: 0 }] }] }).success).toBe(false);
    expect(normalizeOptions("garbage")).toEqual({ variants: [], groups: [] });
  });
});
