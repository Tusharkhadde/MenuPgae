import "server-only";
import { and, asc, eq, gte } from "drizzle-orm";
import { env, features } from "@/lib/env";
import { getDb } from "@/lib/db";
import { categories, items, orders, type Restaurant } from "@/lib/db/schema";
import { minorDigits } from "@/lib/money";
import { localDate } from "@/lib/schedule";
import { festivalPayload, festivalsBetween } from "@/lib/prep/festivals";
import { addDays, holidaysBetween, ordersToHistory, tomorrowLocal, type HistoryRow } from "@/lib/prep/history";
import { generateSyntheticHistory } from "@/lib/prep/synthetic";
import type { AskResult, BacktestResult, HistoryPayload, PrepPlan, PrepRequest } from "@/lib/prep/types";
import { withAgentSpan } from "@/lib/observability";
import { UserError } from "@/server/actions/result";

const HISTORY_DAYS = 90;
const SYNTHETIC_DAYS = 56;

/** Real order history for the last 90 days, as agent rows. */
export async function loadOrderHistory(restaurant: Restaurant): Promise<HistoryRow[]> {
  const db = await getDb();
  const since = addDays(localDate(new Date(), restaurant.timezone), -HISTORY_DAYS);
  const [rows, its, cats] = await Promise.all([
    db
      .select({ day: orders.day, createdAt: orders.createdAt, status: orders.status, lines: orders.lines })
      .from(orders)
      .where(and(eq(orders.restaurantId, restaurant.id), gte(orders.day, since)))
      .orderBy(asc(orders.createdAt)),
    db.select({ id: items.id, name: items.name, categoryId: items.categoryId }).from(items).where(eq(items.restaurantId, restaurant.id)),
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.restaurantId, restaurant.id)),
  ]);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const catalog = new Map(its.map((i) => [i.id, { name: i.name, category: catName.get(i.categoryId) ?? "Other" }]));
  return ordersToHistory(rows, catalog, restaurant.timezone, 10 ** minorDigits(restaurant.currency));
}

/** Clearly-labelled synthetic history built from this restaurant's own menu (for demos / new restaurants). */
export async function syntheticHistory(restaurant: Restaurant): Promise<HistoryRow[]> {
  const db = await getDb();
  const [its, cats] = await Promise.all([
    db
      .select({ name: items.name, categoryId: items.categoryId, priceMinor: items.priceMinor, bestseller: items.bestseller })
      .from(items)
      .where(eq(items.restaurantId, restaurant.id))
      .orderBy(asc(items.position)),
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.restaurantId, restaurant.id)),
  ]);
  if (!its.length) throw new UserError("Add some dishes to your menu first — the demo data is generated from your menu.");
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const div = 10 ** minorDigits(restaurant.currency);
  const picked = [...its.filter((i) => i.bestseller), ...its.filter((i) => !i.bestseller)].slice(0, 25);
  const end = localDate(new Date(), restaurant.timezone);
  return generateSyntheticHistory({
    items: picked.map((i) => ({ name: i.name, category: catName.get(i.categoryId) ?? "Other", price: i.priceMinor / div })),
    days: SYNTHETIC_DAYS,
    endDate: end,
    seed: [...restaurant.id].reduce((a, c) => a + c.charCodeAt(0), 0),
    // Synthetic demo bump on fixed holidays and the movable festivals (Diwali, Ganesh Chaturthi, …).
    holidays: [...holidaysBetween(addDays(end, -SYNTHETIC_DAYS), end), ...festivalsBetween(addDays(end, -SYNTHETIC_DAYS), end).map((f) => f.date)],
  });
}

/** History + calendar features for any agent endpoint. Festivals run 30 days past `until` so days-to-festival is right. */
export function buildHistoryPayload(restaurant: Restaurant, history: HistoryRow[], until: string, synthetic: boolean): HistoryPayload {
  const first = history[0]?.date ?? until;
  return {
    restaurant: { name: restaurant.name, timezone: restaurant.timezone, currency: restaurant.currency },
    history,
    holidays: holidaysBetween(first, until),
    festivals: festivalPayload(first, addDays(until, 31)),
    synthetic,
  };
}

export function buildPrepRequest(restaurant: Restaurant, history: HistoryRow[], horizonDays: number, synthetic: boolean): PrepRequest {
  const start = tomorrowLocal(restaurant.timezone);
  return { ...buildHistoryPayload(restaurant, history, addDays(start, horizonDays), synthetic), start_date: start, horizon_days: horizonDays };
}

export async function callPrepAgent(req: PrepRequest): Promise<PrepPlan> {
  return callAgent<PrepPlan>("/v1/prep-plan", req, "prep-plan");
}

export async function callBacktestAgent(req: HistoryPayload & { holdout_days: number }): Promise<BacktestResult> {
  return callAgent<BacktestResult>("/v1/backtest", req, "backtest");
}

export async function callAskAgent(req: HistoryPayload & { question: string; today: string }): Promise<AskResult> {
  return callAgent<AskResult>("/v1/ask", req, "ask");
}

/** Call the Python agent. Render free instances sleep when idle, so the first call can take ~a minute. */
async function callAgent<T>(path: string, body: unknown, task: string): Promise<T> {
  return withAgentSpan(task, () => postAgent<T>(path, body));
}

async function postAgent<T>(path: string, req: unknown): Promise<T> {
  if (!features.prepAgent()) throw new UserError("The prep planner isn't set up on this server (AGENT_URL / AGENT_SECRET).");
  const url = `${env().AGENT_URL!.replace(/\/+$/, "")}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env().AGENT_SECRET}` },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(150_000),
    cache: "no-store",
  }).catch(() => null);
  if (!res) throw new UserError("The prep agent didn't answer in time. If it runs on a free Render instance it may be waking up — try again in a minute.");
  if (res.status === 401) throw new UserError("The prep agent rejected our secret — AGENT_SECRET must match on both sides.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[menupage] prep agent error", res.status, body.slice(0, 500));
    let detail = "";
    try {
      const j = JSON.parse(body) as { detail?: unknown };
      if (typeof j.detail === "string") detail = j.detail;
    } catch {
      /* not JSON */
    }
    throw new UserError(detail ? `Prep agent: ${detail}` : "The prep agent returned an error. Try again later.");
  }
  return (await res.json()) as T;
}
