import { z } from "zod";
import { resolveSelection, type ItemOptions } from "@/lib/options";
import { applyPercent, evaluateCoupon, isAvailableAt, isHappyHourNow, type Availability, type CouponRule, type HappyHour } from "@/lib/schedule";

/** What the guest's browser sends: ids and choices only — never prices. */
export const placeOrderSchema = z.object({
  r: z.string().min(1).max(64),
  lines: z
    .array(
      z.object({
        itemId: z.string().min(1).max(64),
        qty: z.number().int().min(1).max(99),
        variantId: z.string().max(40).nullable().optional(),
        modifiers: z.record(z.string().max(40), z.array(z.string().max(40)).max(30)).optional(),
      }),
    )
    .min(1)
    .max(60),
  table: z.string().max(12).nullable().optional(),
  name: z.string().trim().max(60).nullable().optional(),
  phone: z.string().trim().max(24).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
  coupon: z.string().trim().max(20).nullable().optional(),
});
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export type PricingItem = {
  id: string;
  name: string;
  priceMinor: number;
  soldOut: boolean;
  options: ItemOptions | null;
  happyHour: boolean;
  availability: Availability | null;
  categoryAvailability: Availability | null;
};

export type OrderLine = {
  itemId: string;
  name: string;
  qty: number;
  unitMinor: number;
  /** "Full, Extra cheese" — size and add-ons, for the kitchen. */
  options: string | null;
};

export type PricedOrder = {
  lines: OrderLine[];
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  happyHour: boolean;
  couponCode: string | null;
};

export type PricingContext = {
  items: Map<string, PricingItem>;
  timezone: string;
  happyHour: HappyHour | null;
  now?: Date;
  coupon?: CouponRule | null;
  /** Coupons are a Pro feature; on Free any code is rejected. */
  couponsAllowed?: boolean;
  today?: string;
};

export class OrderError extends Error {}

/**
 * Re-price an order on the server from the database menu. The browser's
 * numbers are never used. Throws OrderError with a guest-friendly message.
 */
export function priceOrder(input: Pick<PlaceOrderInput, "lines" | "coupon">, ctx: PricingContext): PricedOrder {
  const now = ctx.now ?? new Date();
  const hh = isHappyHourNow(ctx.happyHour, ctx.timezone, now);
  const out: OrderLine[] = [];
  for (const l of input.lines) {
    const item = ctx.items.get(l.itemId);
    if (!item) throw new OrderError("An item in your cart is no longer on the menu. Please review your order.");
    if (item.soldOut) throw new OrderError(`${item.name} just sold out. Please remove it and try again.`);
    if (!isAvailableAt(item.categoryAvailability, ctx.timezone, now) || !isAvailableAt(item.availability, ctx.timezone, now)) {
      throw new OrderError(`${item.name} isn't available right now.`);
    }
    const sel = resolveSelection(item.id, item.priceMinor, item.options, { variantId: l.variantId, modifiers: l.modifiers });
    if (!sel.ok) throw new OrderError(`${item.name}: ${sel.error}`);
    const unit = hh && item.happyHour && ctx.happyHour ? applyPercent(sel.unitMinor, ctx.happyHour.percent) : sel.unitMinor;
    // Merge identical lines.
    const existing = out.find((o) => o.itemId === item.id && o.options === (sel.label || null) && o.unitMinor === unit);
    if (existing) existing.qty = Math.min(99, existing.qty + l.qty);
    else out.push({ itemId: item.id, name: item.name, qty: l.qty, unitMinor: unit, options: sel.label || null });
  }
  const subtotalMinor = out.reduce((s, l) => s + l.unitMinor * l.qty, 0);
  let discountMinor = 0;
  let couponCode: string | null = null;
  if (input.coupon && input.coupon.trim()) {
    if (!ctx.couponsAllowed) throw new OrderError("Coupon codes aren't available on this menu.");
    const res = evaluateCoupon(ctx.coupon ?? null, subtotalMinor, ctx.today ?? now.toISOString().slice(0, 10));
    if (!res.ok) throw new OrderError(res.error);
    discountMinor = res.discountMinor;
    couponCode = ctx.coupon!.code;
  }
  return { lines: out, subtotalMinor, discountMinor, totalMinor: subtotalMinor - discountMinor, happyHour: hh, couponCode };
}

/* --------------------------------------------------------------- Statuses */

export const ORDER_STATUSES = ["new", "preparing", "ready", "done", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New",
  preparing: "Preparing",
  ready: "Ready",
  done: "Done",
  cancelled: "Cancelled",
};

/** The next step in the kitchen flow (new → preparing → ready → done). */
export function nextStatus(s: OrderStatus): OrderStatus | null {
  const flow: OrderStatus[] = ["new", "preparing", "ready", "done"];
  const i = flow.indexOf(s);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null;
}

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v);
}
