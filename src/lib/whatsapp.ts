import { formatMoney } from "@/lib/money";

export type CartLine = {
  id: string;
  name: string;
  qty: number;
  /** Unit price (incl. size/add-ons and any happy-hour discount). */
  priceMinor: number;
  /** Size and add-ons, e.g. "Full, Extra cheese". */
  options?: string | null;
};

/** Digits only, as wa.me expects (country code, no +, no leading zeros or spaces). */
export function normalizeWhatsAppNumber(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/[^\d]/g, "");
  if (input.trim().startsWith("00")) digits = digits.replace(/^00/, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function cartTotalMinor(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.priceMinor * l.qty, 0);
}

export function buildOrderMessage(opts: {
  restaurantName: string;
  lines: CartLine[];
  currency: string;
  table?: string | null;
  note?: string | null;
  customerName?: string | null;
  discountMinor?: number;
  couponCode?: string | null;
  /** Short reference that also appears in the dashboard inbox. */
  ref?: string | null;
}): string {
  const lines = opts.lines.filter((l) => l.qty > 0);
  const out: string[] = [];
  out.push(`Hi ${opts.restaurantName}! I'd like to order:`);
  out.push("");
  for (const l of lines) {
    const extra = l.options?.trim() ? ` (${l.options.trim()})` : "";
    out.push(`• ${l.qty} × ${l.name}${extra} — ${formatMoney(l.priceMinor * l.qty, opts.currency)}`);
  }
  out.push("");
  const subtotal = cartTotalMinor(lines);
  const discount = Math.min(subtotal, Math.max(0, opts.discountMinor ?? 0));
  if (discount > 0) {
    out.push(`Subtotal: ${formatMoney(subtotal, opts.currency)}`);
    out.push(`Discount${opts.couponCode ? ` (${opts.couponCode})` : ""}: −${formatMoney(discount, opts.currency)}`);
  }
  out.push(`Total: ${formatMoney(subtotal - discount, opts.currency)}`);
  const table = opts.table?.trim();
  if (table) out.push(`Table: ${table}`);
  const name = opts.customerName?.trim();
  if (name) out.push(`Name: ${name}`);
  const note = opts.note?.trim();
  if (note) out.push(`Note: ${note}`);
  const ref = opts.ref?.trim();
  if (ref) out.push(`Order ref: ${ref}`);
  out.push("");
  out.push("(sent from our menu page)");
  return out.join("\n");
}

export function whatsappLink(number: string, message?: string): string | null {
  const n = normalizeWhatsAppNumber(number);
  if (!n) return null;
  return message ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : `https://wa.me/${n}`;
}

/** Table numbers from QR codes: short, alphanumeric (e.g. "5", "A3", "Patio-2"). */
export function sanitizeTable(input: string | null | undefined): string | null {
  if (!input) return null;
  const t = input.trim().slice(0, 12);
  return /^[A-Za-z0-9 _-]+$/.test(t) ? t : null;
}

/** Short, unambiguous order reference (no 0/O/1/I). */
export function newOrderRef(random: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(random() * alphabet.length)];
  return out;
}
