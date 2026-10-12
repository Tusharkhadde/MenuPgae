import { describe, expect, it } from "vitest";
import { buildUpiLink, normalizeUpiId, upiAvailable } from "@/lib/upi";
import { feedbackRoute } from "@/lib/reviews";
import { checkReservationDate, reservationSchema, reservationWhatsAppText } from "@/lib/reservations";
import { cleanTranslations, isRtl, localize } from "@/lib/languages";
import { buildDigest, shouldSendDigest } from "@/lib/digest";
import { roleAtLeast, tabsForRole } from "@/lib/roles";
import { buildOrderMessage, newOrderRef } from "@/lib/whatsapp";

describe("UPI", () => {
  it("builds an upi://pay link with the exact amount", () => {
    expect(buildUpiLink({ upiId: "chaicrumbs@okaxis", payeeName: "Chai & Crumbs", amountMinor: 34950, note: "Order #12" })).toBe(
      "upi://pay?pa=chaicrumbs%40okaxis&pn=Chai%20%26%20Crumbs&am=349.50&cu=INR&tn=Order%20%2312",
    );
  });
  it("validates VPAs and only offers UPI for INR", () => {
    expect(normalizeUpiId(" 9876543210@ybl ")).toBe("9876543210@ybl");
    expect(normalizeUpiId("not-a-vpa")).toBeNull();
    expect(normalizeUpiId("a@b")).toBeNull();
    expect(upiAvailable("INR", "shop@okhdfcbank")).toBe(true);
    expect(upiAvailable("USD", "shop@okhdfcbank")).toBe(false);
    expect(buildUpiLink({ upiId: "shop@okaxis", payeeName: "X", amountMinor: 0 })).toBeNull();
  });
});

describe("reviews funnel", () => {
  it("4–5★ go to Google when a link exists, everything else stays private", () => {
    expect(feedbackRoute(5, "https://g.page/r/x")).toBe("google");
    expect(feedbackRoute(4, "https://g.page/r/x")).toBe("google");
    expect(feedbackRoute(3, "https://g.page/r/x")).toBe("private");
    expect(feedbackRoute(5, null)).toBe("private");
  });
});

describe("reservations", () => {
  it("accepts today up to 90 days ahead", () => {
    expect(checkReservationDate("2026-10-12", "2026-10-12")).toBeNull();
    expect(checkReservationDate("2026-10-11", "2026-10-12")).toMatch(/passed/);
    expect(checkReservationDate("2027-03-01", "2026-10-12")).toMatch(/90 days/);
    expect(checkReservationDate("2026-13-01", "2026-10-12")).toMatch(/valid/);
  });
  it("validates the form and builds a WhatsApp text", () => {
    const ok = reservationSchema.safeParse({ r: "x", name: "Asha", phone: "+91 98765 43210", email: "", date: "2026-10-20", time: "19:30", partySize: 4 });
    expect(ok.success).toBe(true);
    expect(reservationSchema.safeParse({ r: "x", name: "A", phone: "1", date: "x", time: "25:00", partySize: 0 }).success).toBe(false);
    expect(reservationWhatsAppText({ restaurantName: "Chai", name: "Asha", date: "2026-10-20", time: "19:30", partySize: 4 })).toContain("Guests: 4");
  });
});

describe("multi-language menus", () => {
  const row = { name: "Masala Chai", description: "Spiced tea", translations: { hi: { name: "मसाला चाय" }, ar: { name: "شاي", description: "شاي بالتوابل" } } };
  it("falls back to the original per field", () => {
    expect(localize(row, "hi")).toEqual({ name: "मसाला चाय", description: "Spiced tea" });
    expect(localize(row, "ar")).toEqual({ name: "شاي", description: "شاي بالتوابل" });
    expect(localize(row, "fr")).toEqual({ name: "Masala Chai", description: "Spiced tea" });
    expect(localize(row, "")).toEqual({ name: "Masala Chai", description: "Spiced tea" });
  });
  it("cleans input to enabled languages and knows RTL", () => {
    expect(cleanTranslations({ hi: { name: " चाय ", description: "" }, fr: { name: "Thé" }, xx: { name: "?" } }, ["hi"])).toEqual({ hi: { name: "चाय" } });
    expect(isRtl("ar")).toBe(true);
    expect(isRtl("hi")).toBe(false);
  });
});

describe("weekly digest", () => {
  const data = {
    restaurantName: "Chai & Crumbs", currency: "INR", periodLabel: "x", views: 120, scans: 40, orders: 9, revenueMinor: 345000,
    topItems: [{ name: "Masala Chai", qty: 14 }], ratingAvg: 4.5, ratingCount: 6, privateFeedback: 1, pendingReservations: 2, dashboardUrl: "https://x/d",
  };
  it("summarises the week", () => {
    const d = buildDigest(data);
    expect(d.subject).toBe("Chai & Crumbs: 9 orders and 120 views last week");
    expect(d.text).toContain("Sales (orders inbox): ₹3,450");
    expect(d.highlights.join(" ")).toContain("Masala Chai (14)");
    expect(d.highlights.join(" ")).toContain("2 reservation requests");
  });
  it("is skipped for a completely empty week", () => {
    expect(shouldSendDigest({ views: 0, scans: 0, orders: 0, ratingCount: 0, pendingReservations: 0 })).toBe(false);
    expect(shouldSendDigest({ views: 1, scans: 0, orders: 0, ratingCount: 0, pendingReservations: 0 })).toBe(true);
  });
});

describe("team roles", () => {
  it("ranks owner > manager > staff", () => {
    expect(roleAtLeast("owner", "manager")).toBe(true);
    expect(roleAtLeast("manager", "manager")).toBe(true);
    expect(roleAtLeast("staff", "manager")).toBe(false);
    expect(tabsForRole("staff")).toEqual(["orders"]);
    expect(tabsForRole("manager")).not.toContain("settings");
    expect(tabsForRole("owner")).toContain("team");
  });
});

describe("WhatsApp message with options, discount and ref", () => {
  it("includes add-ons, discount and order ref", () => {
    const msg = buildOrderMessage({
      restaurantName: "Pizza Co",
      lines: [{ id: "p", name: "Margherita", qty: 2, priceMinor: 45000, options: "Large, Cheese burst" }],
      currency: "INR",
      discountMinor: 9000,
      couponCode: "TEN",
      ref: "K7Q2M",
    });
    expect(msg).toContain("• 2 × Margherita (Large, Cheese burst) — ₹900");
    expect(msg).toContain("Subtotal: ₹900");
    expect(msg).toContain("Discount (TEN): −₹90");
    expect(msg).toContain("Total: ₹810");
    expect(msg).toContain("Order ref: K7Q2M");
  });
  it("order refs avoid look-alike characters", () => {
    const ref = newOrderRef();
    expect(ref).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
  });
});
