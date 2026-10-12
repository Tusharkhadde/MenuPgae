import { describe, expect, it } from "vitest";
import { formatMoney, minorDigits, minorToInput, parsePriceToMinor } from "@/lib/money";

describe("money", () => {
  it("knows minor units per currency", () => {
    expect(minorDigits("INR")).toBe(2);
    expect(minorDigits("USD")).toBe(2);
    expect(minorDigits("JPY")).toBe(0);
  });

  it("parses user-typed prices into minor units", () => {
    expect(parsePriceToMinor("149", "INR")).toBe(14900);
    expect(parsePriceToMinor("149.5", "INR")).toBe(14950);
    expect(parsePriceToMinor("1,299.99", "USD")).toBe(129999);
    expect(parsePriceToMinor("500", "JPY")).toBe(500);
    expect(parsePriceToMinor("5.5", "JPY")).toBeNull();
    expect(parsePriceToMinor("1.999", "EUR")).toBeNull();
    expect(parsePriceToMinor("-3", "EUR")).toBeNull();
    expect(parsePriceToMinor("abc", "EUR")).toBeNull();
    expect(parsePriceToMinor("", "EUR")).toBeNull();
  });

  it("formats prices for the currency's locale", () => {
    expect(formatMoney(14900, "INR")).toBe("₹149");
    expect(formatMoney(14950, "INR")).toBe("₹149.50");
    expect(formatMoney(129999, "INR")).toBe("₹1,299.99");
    expect(formatMoney(500, "USD")).toBe("$5");
    expect(formatMoney(1250, "EUR")).toMatch(/12\.50|12,50/);
    expect(formatMoney(1900, "AED")).toContain("19");
    expect(formatMoney(500, "JPY")).toMatch(/500/);
  });

  it("round-trips to an input value", () => {
    expect(minorToInput(14900, "INR")).toBe("149");
    expect(minorToInput(14950, "INR")).toBe("149.50");
  });
});
