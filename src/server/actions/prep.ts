"use server";

import { z } from "zod";
import { assertFeature } from "@/lib/limits";
import { rateLimit } from "@/lib/rate-limit";
import { addDays, historyDays, MIN_BACKTEST_DAYS, MIN_HISTORY_DAYS, type HistoryRow } from "@/lib/prep/history";
import type { AskResult, BacktestResult, PrepPlan } from "@/lib/prep/types";
import { localDate } from "@/lib/schedule";
import { getPlanForUser, requireRestaurantAccessOrThrow } from "@/server/session";
import {
  buildHistoryPayload,
  buildPrepRequest,
  callAskAgent,
  callBacktestAgent,
  callPrepAgent,
  loadOrderHistory,
  syntheticHistory,
} from "@/server/prep";
import { run, UserError, type ActionResult } from "@/server/actions/result";

const source = z.enum(["orders", "synthetic"]);
const schema = z.object({ horizonDays: z.number().int().min(1).max(7), source });
const backtestSchema = z.object({ holdoutDays: z.number().int().min(7).max(28).default(14), source });
const askSchema = z.object({ question: z.string().trim().min(2).max(300), source });

/**
 * Prep planner (Pro): TabPFN forecasts per-dish demand from order history, Gemma writes the prep list.
 * Demo sandbox accounts may run it on the clearly-labelled synthetic dataset only.
 */
export async function generatePrepPlan(restaurantId: string, input: unknown): Promise<ActionResult<PrepPlan>> {
  return run(async () => {
    const { user, restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
    const data = schema.parse(input);
    const plan = await getPlanForUser(restaurant.ownerId);
    if (!(user.isDemo && data.source === "synthetic")) assertFeature(plan, "prepPlanner");
    if (!rateLimit(`prep:${user.id}`, 12, 60 * 60_000).ok) throw new UserError("Too many prep plans this hour. Try again later.");
    const history = data.source === "synthetic" ? await syntheticHistory(restaurant) : await loadOrderHistory(restaurant);
    if (data.source === "orders" && historyDays(history) < MIN_HISTORY_DAYS) {
      throw new UserError(`The forecast needs at least ${MIN_HISTORY_DAYS} days with orders (you have ${historyDays(history)}). Try the synthetic demo data meanwhile.`);
    }
    return callPrepAgent(buildPrepRequest(restaurant, history, data.horizonDays, data.source === "synthetic"));
  });
}

/** Same access rules as the prep plan: Pro, or the demo sandbox on synthetic data. */
async function historyFor(restaurantId: string, src: "orders" | "synthetic", minDays: number, limitKey: string, limit: number) {
  const { user, restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
  const plan = await getPlanForUser(restaurant.ownerId);
  if (!(user.isDemo && src === "synthetic")) assertFeature(plan, "prepPlanner");
  if (!rateLimit(`${limitKey}:${user.id}`, limit, 60 * 60_000).ok) throw new UserError("Too many requests this hour. Try again later.");
  const history: HistoryRow[] = src === "synthetic" ? await syntheticHistory(restaurant) : await loadOrderHistory(restaurant);
  if (src === "orders" && historyDays(history) < minDays) {
    throw new UserError(`This needs at least ${minDays} days with orders (you have ${historyDays(history)}). Try the synthetic demo data meanwhile.`);
  }
  return { restaurant, history };
}

/**
 * Forecast accuracy: the agent holds out the last N days, forecasts them with TabPFN trained on the days
 * before, and scores it against "same weekday last week" and "4-week weekday mean". Nothing is stored.
 */
export async function runBacktest(restaurantId: string, input: unknown): Promise<ActionResult<BacktestResult>> {
  return run(async () => {
    const data = backtestSchema.parse(input);
    const { restaurant, history } = await historyFor(restaurantId, data.source, MIN_BACKTEST_DAYS, "backtest", 6);
    const last = history.at(-1)?.date ?? localDate(new Date(), restaurant.timezone);
    return callBacktestAgent({ ...buildHistoryPayload(restaurant, history, last, data.source === "synthetic"), holdout_days: data.holdoutDays });
  });
}

/** "Ask the planner": Gemma turns the question into a forecast tool call; TabPFN supplies every number. */
export async function askPlanner(restaurantId: string, input: unknown): Promise<ActionResult<AskResult>> {
  return run(async () => {
    const data = askSchema.parse(input);
    const { restaurant, history } = await historyFor(restaurantId, data.source, MIN_HISTORY_DAYS, "ask", 20);
    const today = localDate(new Date(), restaurant.timezone);
    return callAskAgent({ ...buildHistoryPayload(restaurant, history, addDays(today, 8), data.source === "synthetic"), question: data.question, today });
  });
}
