import { describe, expect, it } from "vitest";
import { defaultHours, describeStatus, getOpenStatus, localClock, toOpeningHoursSpecification, type WeeklyHours } from "@/lib/hours";

// 2026-10-12 is a Monday.
const at = (iso: string) => new Date(iso);

function hours(overrides: Partial<WeeklyHours> = {}): WeeklyHours {
  return { ...defaultHours(), ...overrides };
}

describe("localClock", () => {
  it("converts to the restaurant's timezone", () => {
    // 2026-10-12 18:30 UTC = 2026-10-13 00:00 IST (Tuesday)
    expect(localClock(at("2026-10-12T18:30:00Z"), "Asia/Kolkata")).toEqual({ day: 1, minutes: 0 });
    expect(localClock(at("2026-10-12T18:30:00Z"), "Europe/London")).toEqual({ day: 0, minutes: 19 * 60 + 30 });
  });

  it("falls back to UTC for an invalid timezone", () => {
    expect(localClock(at("2026-10-12T10:00:00Z"), "Not/AZone")).toEqual({ day: 0, minutes: 600 });
  });
});

describe("getOpenStatus", () => {
  it("is unknown without hours", () => {
    expect(getOpenStatus(null, "Asia/Kolkata")).toEqual({ state: "unknown" });
  });

  it("is open within a range", () => {
    // Monday 12:00 IST
    const s = getOpenStatus(hours(), "Asia/Kolkata", at("2026-10-12T06:30:00Z"));
    expect(s).toEqual({ state: "open", closesAt: "22:00" });
    expect(describeStatus(s)).toBe("Open now · until 10:00 PM");
  });

  it("is closed before opening and says when it opens today", () => {
    // Monday 09:00 IST
    const s = getOpenStatus(hours(), "Asia/Kolkata", at("2026-10-12T03:30:00Z"));
    expect(s).toMatchObject({ state: "closed", opensAt: "11:00", opensToday: true });
    expect(describeStatus(s)).toBe("Closed · opens 11:00 AM");
  });

  it("handles split shifts", () => {
    const h = hours({ mon: { closed: false, ranges: [{ open: "12:00", close: "15:00" }, { open: "19:00", close: "23:00" }] } });
    expect(getOpenStatus(h, "Asia/Kolkata", at("2026-10-12T11:30:00Z")).state).toBe("closed"); // 17:00
    expect(getOpenStatus(h, "Asia/Kolkata", at("2026-10-12T11:30:00Z"))).toMatchObject({ opensAt: "19:00", opensToday: true });
    expect(getOpenStatus(h, "Asia/Kolkata", at("2026-10-12T14:30:00Z"))).toEqual({ state: "open", closesAt: "23:00" }); // 20:00
  });

  it("handles ranges past midnight (yesterday's late night)", () => {
    const h = hours({ mon: { closed: false, ranges: [{ open: "18:00", close: "02:00" }] }, tue: { closed: true, ranges: [] } });
    // Tuesday 01:00 IST → still open from Monday
    expect(getOpenStatus(h, "Asia/Kolkata", at("2026-10-12T19:30:00Z"))).toEqual({ state: "open", closesAt: "02:00" });
    // Tuesday 02:30 IST → closed
    expect(getOpenStatus(h, "Asia/Kolkata", at("2026-10-12T21:00:00Z")).state).toBe("closed");
    // Monday 23:00 IST → open
    expect(getOpenStatus(h, "Asia/Kolkata", at("2026-10-12T17:30:00Z")).state).toBe("open");
  });

  it("treats a 00:00 close as midnight", () => {
    const h = hours({ mon: { closed: false, ranges: [{ open: "10:00", close: "00:00" }] } });
    expect(getOpenStatus(h, "Asia/Kolkata", at("2026-10-12T18:00:00Z")).state).toBe("open"); // 23:30
  });

  it("finds the next opening day when closed today", () => {
    const h = hours({ mon: { closed: true, ranges: [] } });
    const s = getOpenStatus(h, "Asia/Kolkata", at("2026-10-12T06:30:00Z"));
    expect(s).toMatchObject({ state: "closed", opensDay: "tue", opensAt: "11:00", opensToday: false });
    expect(describeStatus(s)).toBe("Closed · opens Tue 11:00 AM");
  });

  it("reports closed with no next opening when closed all week", () => {
    const closed = Object.fromEntries(Object.keys(defaultHours()).map((d) => [d, { closed: true, ranges: [] }])) as unknown as WeeklyHours;
    expect(describeStatus(getOpenStatus(closed, "UTC", at("2026-10-12T12:00:00Z")))).toBe("Closed");
  });
});

describe("toOpeningHoursSpecification", () => {
  it("emits schema.org entries for open days only", () => {
    const h = hours({ sun: { closed: true, ranges: [] } });
    const spec = toOpeningHoursSpecification(h);
    expect(spec).toHaveLength(6);
    expect(spec[0]).toEqual({ "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Monday", opens: "11:00", closes: "22:00" });
  });
});
