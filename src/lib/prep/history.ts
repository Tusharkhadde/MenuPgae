import { localDate } from "@/lib/schedule";
import type { OrderLine, OrderStatus } from "@/lib/order";

/**
 * Turns MenuPage orders into the flat table the TabPFN prep agent learns from:
 * one row per (restaurant-local date, hour, dish) with the quantity sold.
 * Weekday, hour bucket and holiday features are derived on the agent side from these.
 */
export type HistoryRow = {
  date: string; // YYYY-MM-DD, restaurant-local
  hour: number; // 0–23, restaurant-local
  item: string;
  category: string;
  qty: number;
  price: number; // major units (₹), unit price at the time of the order
};

export type OrderForHistory = { day: string; createdAt: Date; status: OrderStatus; lines: OrderLine[] };

export function localHour(at: Date, timeZone: string): number {
  try {
    const h = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(at);
    const n = Number.parseInt(h, 10);
    return Number.isFinite(n) ? n % 24 : at.getUTCHours();
  } catch {
    return at.getUTCHours();
  }
}

export function ordersToHistory(
  orders: OrderForHistory[],
  catalog: Map<string, { name: string; category: string }>,
  timeZone: string,
  minorPerMajor = 100,
): HistoryRow[] {
  const acc = new Map<string, HistoryRow>();
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    const hour = localHour(o.createdAt, timeZone);
    for (const l of o.lines) {
      if (!l || !Number.isFinite(l.qty) || l.qty <= 0) continue;
      const known = catalog.get(l.itemId);
      const item = known?.name ?? l.name;
      const category = known?.category ?? "Other";
      const key = `${o.day}|${hour}|${item}`;
      const row = acc.get(key);
      if (row) row.qty += l.qty;
      else acc.set(key, { date: o.day, hour, item, category, qty: l.qty, price: Math.round(l.unitMinor) / minorPerMajor });
    }
  }
  return [...acc.values()].sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour || a.item.localeCompare(b.item));
}

/** Distinct days that have at least one order. */
export function historyDays(rows: HistoryRow[]): number {
  return new Set(rows.map((r) => r.date)).size;
}

/** Days with orders a real restaurant needs before the prep plan and "Ask the planner" work. */
export const MIN_HISTORY_DAYS = 14;

/** The backtest needs this many days with orders: 14 to learn from + a 14-day holdout. */
export const MIN_BACKTEST_DAYS = 28;

/**
 * Fixed-date public holidays in India (month-day). Movable festivals (Diwali, Holi, Eid, Ganesh
 * Chaturthi …) are in src/lib/prep/festivals.ts and sent to the agent as separate features.
 */
export const FIXED_HOLIDAYS_IN = ["01-26", "05-01", "08-15", "10-02", "12-25"] as const;

export function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Holiday dates (YYYY-MM-DD) between from and to inclusive. */
export function holidaysBetween(from: string, to: string, monthDays: readonly string[] = FIXED_HOLIDAYS_IN): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (monthDays.includes(d.slice(5))) out.push(d);
  return out;
}

/** Tomorrow in the restaurant's timezone — the first forecast day. */
export function tomorrowLocal(timeZone: string, now = new Date()): string {
  return addDays(localDate(now, timeZone), 1);
}
