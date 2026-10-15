import { formatMoney } from "@/lib/money";

export type DigestData = {
  restaurantName: string;
  currency: string;
  periodLabel: string;
  views: number;
  scans: number;
  orders: number;
  revenueMinor: number;
  topItems: { name: string; qty: number }[];
  ratingAvg: number | null;
  ratingCount: number;
  privateFeedback: number;
  pendingReservations: number;
  dashboardUrl: string;
};

/** Plain-text + simple HTML body for the weekly owner digest. Pure, so it's unit-tested. */
export function buildDigest(d: DigestData): { subject: string; text: string; rows: [string, string][]; highlights: string[] } {
  const rows: [string, string][] = [
    ["Menu views", d.views.toLocaleString("en-US")],
    ["QR scans", d.scans.toLocaleString("en-US")],
    ["Orders", d.orders.toLocaleString("en-US")],
    ["Sales (orders inbox)", formatMoney(d.revenueMinor, d.currency)],
    ["Average rating", d.ratingCount ? `${d.ratingAvg?.toFixed(1)} ★ (${d.ratingCount})` : "—"],
  ];
  const highlights: string[] = [];
  if (d.topItems.length) highlights.push(`Top dishes: ${d.topItems.slice(0, 3).map((t) => `${t.name} (${t.qty})`).join(", ")}`);
  if (d.privateFeedback) highlights.push(`${d.privateFeedback} private feedback message${d.privateFeedback === 1 ? "" : "s"} to read`);
  if (d.pendingReservations) highlights.push(`${d.pendingReservations} reservation request${d.pendingReservations === 1 ? "" : "s"} waiting for an answer`);
  if (!d.views && !d.orders) highlights.push("Quiet week — put your QR codes on every table and share your link in your Instagram bio.");
  const subject = `${d.restaurantName}: ${d.orders} order${d.orders === 1 ? "" : "s"} and ${d.views} view${d.views === 1 ? "" : "s"} last week`;
  const text = [`${d.restaurantName} — ${d.periodLabel}`, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", ...highlights.map((h) => `• ${h}`), "", `Open your dashboard: ${d.dashboardUrl}`].join("\n");
  return { subject, text, rows, highlights };
}

/** The digest is worth sending only when something happened or needs attention. */
export function shouldSendDigest(d: Pick<DigestData, "views" | "scans" | "orders" | "ratingCount" | "pendingReservations">): boolean {
  return d.views + d.scans + d.orders + d.ratingCount + d.pendingReservations > 0;
}
