/**
 * Export an order history in the prep agent's format, for the command-line backtest (agent/backtest.py).
 *
 *   npm run prep:export -- --synthetic                       # SYNTHETIC demo history from the sample menu → .data/history-synthetic.json
 *   npm run prep:export -- --synthetic --end 2026-10-15 --days 56
 *   npm run prep:export -- --restaurant my-cafe              # REAL orders (last 90 days) from DATABASE_URL → .data/history-my-cafe.json
 *
 * Then:  cd agent && PRIORLABS_API_KEY=... python backtest.py --input ../.data/history-synthetic.json
 * The file says whether it is synthetic; the backtest prints that next to every number.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { and, asc, eq, gte } from "drizzle-orm";
import { scriptDb } from "./db";
import { categories, items, orders, restaurants } from "../src/lib/db/schema";
import { minorDigits } from "../src/lib/money";
import { localDate } from "../src/lib/schedule";
import { addDays, historyDays, holidaysBetween, ordersToHistory, type HistoryRow } from "../src/lib/prep/history";
import { festivalPayload, festivalsBetween } from "../src/lib/prep/festivals";
import { generateSyntheticHistory } from "../src/lib/prep/synthetic";
import { SAMPLE_MENU } from "../src/server/sample-menu";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

type Export = {
  restaurant: { name: string; timezone: string; currency: string };
  history: HistoryRow[];
  holidays: string[];
  festivals: { date: string; key: string }[];
  synthetic: boolean;
  exported_at: string;
  note: string;
};

function calendar(history: HistoryRow[]) {
  const first = history[0]?.date ?? "2024-01-01";
  const last = history.at(-1)?.date ?? first;
  return { holidays: holidaysBetween(first, last), festivals: festivalPayload(first, addDays(last, 31)) };
}

async function synthetic(): Promise<Export> {
  const days = Number(arg("days") ?? 56);
  const end = arg("end") ?? addDays(localDate(new Date(), "Asia/Kolkata"), -1);
  const start = addDays(end, -(days - 1));
  const menu = SAMPLE_MENU.flatMap((c) => c.items.map((i) => ({ name: i.name, category: c.name, price: i.price, bestseller: !!i.bestseller })));
  const picked = [...menu.filter((i) => i.bestseller), ...menu.filter((i) => !i.bestseller)].slice(0, 25);
  const history = generateSyntheticHistory({
    items: picked,
    days,
    endDate: end,
    seed: 42,
    holidays: [...holidaysBetween(start, end), ...festivalsBetween(start, end).map((f) => f.date)],
  });
  return {
    restaurant: { name: "MenuPage demo café (synthetic)", timezone: "Asia/Kolkata", currency: "INR" },
    history,
    ...calendar(history),
    synthetic: true,
    exported_at: new Date().toISOString(),
    note: "SYNTHETIC demo data generated from the sample menu (src/lib/prep/synthetic.ts). Not real sales.",
  };
}

async function real(slug: string): Promise<Export> {
  const { db, close } = await scriptDb();
  try {
    const [r] = await db.select().from(restaurants).where(eq(restaurants.slug, slug)).limit(1);
    if (!r) throw new Error(`No restaurant with slug "${slug}" in this database.`);
    const since = addDays(localDate(new Date(), r.timezone), -90);
    const [rows, its, cats] = await Promise.all([
      db
        .select({ day: orders.day, createdAt: orders.createdAt, status: orders.status, lines: orders.lines })
        .from(orders)
        .where(and(eq(orders.restaurantId, r.id), gte(orders.day, since)))
        .orderBy(asc(orders.createdAt)),
      db.select({ id: items.id, name: items.name, categoryId: items.categoryId }).from(items).where(eq(items.restaurantId, r.id)),
      db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.restaurantId, r.id)),
    ]);
    const catName = new Map(cats.map((c) => [c.id, c.name]));
    const catalog = new Map(its.map((i) => [i.id, { name: i.name, category: catName.get(i.categoryId) ?? "Other" }]));
    const history = ordersToHistory(rows, catalog, r.timezone, 10 ** minorDigits(r.currency));
    return {
      restaurant: { name: r.name, timezone: r.timezone, currency: r.currency },
      history,
      ...calendar(history),
      synthetic: false,
      exported_at: new Date().toISOString(),
      note: `Real MenuPage orders for /r/${slug}, last 90 days (${historyDays(history)} days with orders). Keep this file private.`,
    };
  } finally {
    await close();
  }
}

async function main() {
  const slug = arg("restaurant");
  const data = slug ? await real(slug) : await synthetic();
  if (!data.history.length) throw new Error("No order rows to export.");
  const out = arg("out") ?? path.join(".data", `history-${slug ?? "synthetic"}.json`);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(data, null, 2));
  console.log(`Wrote ${out}: ${data.history.length} rows over ${historyDays(data.history)} days${data.synthetic ? " (SYNTHETIC)" : ""}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
