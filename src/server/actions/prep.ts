"use server";

import { z } from "zod";
import { assertFeature } from "@/lib/limits";
import { rateLimit } from "@/lib/rate-limit";
import { addDays, historyDays, MIN_BACKTEST_DAYS, MIN_HISTORY_DAYS, type HistoryRow } from "@/lib/prep/history";
import { historySourceFor, notEnoughOrdersMessage } from "@/lib/prep/readiness";
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

// The data source is decided on the server from the signed-in account, never from the client:
// real accounts → their own orders only; demo sandbox accounts → synthetic "Demo data" only.
const schema = z.object({ horizonDays: z.number().int().min(1).max(7) });
const backtestSchema = z.object({ holdoutDays: z.number().int().min(7).max(28).default(14) });
const askSchema = z.object({ question: z.string().trim().min(2).max(300) });

/**
 * Loads history for any prep feature with the access rules shared by all of them:
 * Pro (or a demo sandbox, which only ever sees synthetic demo data), a rate limit, and enough real days.
 */
async function historyFor(restaurantId: string, minDays: number, limitKey: string, limit: number) {
  const { user, restaurant } = await requireRestaurantAccessOrThrow(restaurantId, "manager");
  const source = historySourceFor(user);
  if (source === "orders") assertFeature(await getPlanForUser(restaurant.ownerId), "prepPlanner");
  if (!rateLimit(`${limitKey}:${user.id}`, limit, 60 * 60_000).ok) throw new UserError("Too many requests this hour. Try again later.");
  const history: HistoryRow[] = source === "synthetic" ? await syntheticHistory(restaurant) : await loadOrderHistory(restaurant);
  if (source === "orders" && historyDays(history) < minDays) throw new UserError(notEnoughOrdersMessage(historyDays(history), minDays));
  return { restaurant, history, synthetic: source === "synthetic" };
}

/** Prep planner (Pro): TabPFN forecasts per-dish demand from order history, Gemma writes the prep list. */
export async function generatePrepPlan(restaurantId: string, input: unknown): Promise<ActionResult<PrepPlan>> {
  return run(async () => {
    const data = schema.parse(input);
    const { restaurant, history, synthetic } = await historyFor(restaurantId, MIN_HISTORY_DAYS, "prep", 12);
    return callPrepAgent(buildPrepRequest(restaurant, history, data.horizonDays, synthetic));
  });
}

/**
 * Forecast accuracy: the agent holds out the last N days, forecasts them with TabPFN trained on the days
 * before, and scores it against "same weekday last week" and "4-week weekday mean". Nothing is stored.
 */
export async function runBacktest(restaurantId: string, input: unknown): Promise<ActionResult<BacktestResult>> {
  return run(async () => {
    const data = backtestSchema.parse(input);
    const { restaurant, history, synthetic } = await historyFor(restaurantId, MIN_BACKTEST_DAYS, "backtest", 6);
    const last = history.at(-1)?.date ?? localDate(new Date(), restaurant.timezone);
    return callBacktestAgent({ ...buildHistoryPayload(restaurant, history, last, synthetic), holdout_days: data.holdoutDays });
  });
}

/** "Ask the planner": Gemma turns the question into a forecast tool call; TabPFN supplies every number. */
export async function askPlanner(restaurantId: string, input: unknown): Promise<ActionResult<AskResult>> {
  return run(async () => {
    const data = askSchema.parse(input);
    const { restaurant, history, synthetic } = await historyFor(restaurantId, MIN_HISTORY_DAYS, "ask", 20);
    const today = localDate(new Date(), restaurant.timezone);
    return callAskAgent({ ...buildHistoryPayload(restaurant, history, addDays(today, 8), synthetic), question: data.question, today });
  });
}
