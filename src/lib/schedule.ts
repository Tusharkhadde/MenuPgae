import { z } from "zod";
import { TIME_RE, localClock, toMinutes } from "@/lib/hours";

/**
 * Menu scheduling: when a category or item can be ordered.
 * `days` uses 0 = Monday … 6 = Sunday (same as `localClock`). Empty/absent = every day.
 * `from`/`to` are "HH:MM" in the restaurant's timezone; `to` ≤ `from` runs past midnight.
 */
export type Availability = { days?: number[]; from?: string | null; to?: string | null };

export const availabilitySchema = z
  .object({
    days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    from: z.string().regex(TIME_RE).nullable().optional(),
    to: z.string().regex(TIME_RE).nullable().optional(),
  })
  .refine((a) => !!a.from === !!a.to, "Set both a start and an end time")
  .nullable();

export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function isScheduled(a: Availability | null | undefined): boolean {
  if (!a) return false;
  const n = a.days?.length ?? 0;
  return (n > 0 && n < 7) || !!(a.from && a.to);
}

/** Is `now` inside the availability window (evaluated in `timeZone`)? */
export function isAvailableAt(a: Availability | null | undefined, timeZone: string, now = new Date()): boolean {
  if (!a) return true;
  const { day, minutes } = localClock(now, timeZone);
  const days = a.days && a.days.length ? a.days : null;
  if (!(a.from && a.to)) return !days || days.includes(day);
  const start = toMinutes(a.from);
  const end = toMinutes(a.to);
  if (end > start) return (!days || days.includes(day)) && minutes >= start && minutes < end;
  // Overnight window: today's evening part, or yesterday's spill-over after midnight.
  if (minutes >= start) return !days || days.includes(day);
  if (minutes < end) return !days || days.includes((day + 6) % 7);
  return false;
}

export function describeAvailability(a: Availability | null | undefined): string | null {
  if (!isScheduled(a)) return null;
  const parts: string[] = [];
  if (a!.days && a!.days.length && a!.days.length < 7) parts.push([...a!.days].sort().map((d) => DAY_SHORT[d]).join(", "));
  if (a!.from && a!.to) parts.push(`${a!.from}–${a!.to}`);
  return parts.join(" · ");
}

/* ---------------------------------------------------------------- Happy hour */

export type HappyHour = { enabled: boolean; percent: number; days?: number[]; from: string; to: string; label?: string | null };

export const happyHourSchema = z
  .object({
    enabled: z.boolean(),
    percent: z.number().int().min(1).max(90),
    days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    from: z.string().regex(TIME_RE),
    to: z.string().regex(TIME_RE),
    label: z.string().trim().max(40).nullable().optional(),
  })
  .nullable();

export function isHappyHourNow(h: HappyHour | null | undefined, timeZone: string, now = new Date()): boolean {
  if (!h || !h.enabled) return false;
  return isAvailableAt({ days: h.days, from: h.from, to: h.to }, timeZone, now);
}

/** Discounted price, rounded to a whole minor unit (never below 0). */
export function applyPercent(priceMinor: number, percent: number): number {
  return Math.max(0, Math.round((priceMinor * (100 - percent)) / 100));
}

/* ------------------------------------------------------------------- Coupons */

export type CouponRule = {
  code: string;
  kind: "percent" | "amount";
  /** Percent (1–90) or a fixed amount in minor units. */
  value: number;
  minOrderMinor: number;
  active: boolean;
  expiresAt: string | null; // YYYY-MM-DD, inclusive, restaurant-local date
  maxUses: number | null;
  uses: number;
};

export const COUPON_CODE_RE = /^[A-Z0-9_-]{3,20}$/;

export function normalizeCouponCode(input: string | null | undefined): string {
  return (input ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

/** Local calendar date (YYYY-MM-DD) in a timezone. */
export function localDate(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export type CouponResult = { ok: true; discountMinor: number } | { ok: false; error: string };

export function evaluateCoupon(c: CouponRule | null | undefined, subtotalMinor: number, today: string): CouponResult {
  if (!c || !c.active) return { ok: false, error: "That code isn't valid." };
  if (c.expiresAt && today > c.expiresAt) return { ok: false, error: "That code has expired." };
  if (c.maxUses !== null && c.uses >= c.maxUses) return { ok: false, error: "That code has been fully used." };
  if (subtotalMinor < c.minOrderMinor) return { ok: false, error: "Your order is below the minimum for this code." };
  const raw = c.kind === "percent" ? Math.round((subtotalMinor * c.value) / 100) : c.value;
  return { ok: true, discountMinor: Math.min(subtotalMinor, Math.max(0, raw)) };
}
