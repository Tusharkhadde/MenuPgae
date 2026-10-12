import { formatMoney } from "@/lib/money";

export type CartLine = { id: string; name: string; qty: number; priceMinor: number };

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
}): string {
  const lines = opts.lines.filter((l) => l.qty > 0);
  const out: string[] = [];
  out.push(`Hi ${opts.restaurantName}! I'd like to order:`);
  out.push("");
  for (const l of lines) {
    out.push(`• ${l.qty} × ${l.name} — ${formatMoney(l.priceMinor * l.qty, opts.currency)}`);
  }
  out.push("");
  out.push(`Total: ${formatMoney(cartTotalMinor(lines), opts.currency)}`);
  const table = opts.table?.trim();
  if (table) out.push(`Table: ${table}`);
  const name = opts.customerName?.trim();
  if (name) out.push(`Name: ${name}`);
  const note = opts.note?.trim();
  if (note) out.push(`Note: ${note}`);
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
