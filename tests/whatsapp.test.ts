import { describe, expect, it } from "vitest";
import { buildOrderMessage, cartTotalMinor, normalizeWhatsAppNumber, sanitizeTable, whatsappLink } from "@/lib/whatsapp";

const lines = [
  { id: "a", name: "Masala Chai", qty: 2, priceMinor: 4000 },
  { id: "b", name: "Vada Pav", qty: 1, priceMinor: 3500 },
];

describe("whatsapp", () => {
  it("normalizes numbers to wa.me format", () => {
    expect(normalizeWhatsAppNumber("+91 98765 43210")).toBe("919876543210");
    expect(normalizeWhatsAppNumber("0044 20 7946 0958")).toBe("442079460958");
    expect(normalizeWhatsAppNumber("(971) 50-123-4567")).toBe("971501234567");
    expect(normalizeWhatsAppNumber("12345")).toBeNull();
    expect(normalizeWhatsAppNumber("")).toBeNull();
    expect(normalizeWhatsAppNumber(null)).toBeNull();
  });

  it("totals the cart", () => {
    expect(cartTotalMinor(lines)).toBe(11500);
  });

  it("builds a readable order message", () => {
    const msg = buildOrderMessage({ restaurantName: "Chai & Crumbs", lines, currency: "INR", table: "5", note: "Less sugar", customerName: "Asha" });
    expect(msg).toBe(
      [
        "Hi Chai & Crumbs! I'd like to order:",
        "",
        "• 2 × Masala Chai — ₹80",
        "• 1 × Vada Pav — ₹35",
        "",
        "Total: ₹115",
        "Table: 5",
        "Name: Asha",
        "Note: Less sugar",
        "",
        "(sent from our menu page)",
      ].join("\n"),
    );
  });

  it("omits empty optional fields and zero-qty lines", () => {
    const msg = buildOrderMessage({ restaurantName: "X", lines: [...lines, { id: "c", name: "Ghost", qty: 0, priceMinor: 100 }], currency: "USD", table: "  ", note: null });
    expect(msg).not.toContain("Table:");
    expect(msg).not.toContain("Note:");
    expect(msg).not.toContain("Ghost");
    expect(msg).toContain("Total: $115");
  });

  it("creates an encoded wa.me link", () => {
    expect(whatsappLink("+91 98765 43210", "Hi & bye\nok")).toBe("https://wa.me/919876543210?text=Hi%20%26%20bye%0Aok");
    expect(whatsappLink("+91 98765 43210")).toBe("https://wa.me/919876543210");
    expect(whatsappLink("abc", "x")).toBeNull();
  });

  it("sanitizes table numbers from QR codes", () => {
    expect(sanitizeTable("5")).toBe("5");
    expect(sanitizeTable(" A3 ")).toBe("A3");
    expect(sanitizeTable("Patio-2")).toBe("Patio-2");
    expect(sanitizeTable("<script>")).toBeNull();
    expect(sanitizeTable("x".repeat(40))).toBe("x".repeat(12));
    expect(sanitizeTable(null)).toBeNull();
  });
});
