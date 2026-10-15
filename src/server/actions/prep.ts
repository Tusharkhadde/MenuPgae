"use server";

import { z } from "zod";
import { assertFeature } from "@/lib/limits";
import { rateLimit } from "@/lib/rate-limit";
import { historyDays, MIN_HISTORY_DAYS } from "@/lib/prep/history";
import type { PrepPlan } from "@/lib/prep/types";
import { getPlanForUser, requireRestaurantAccessOrThrow } from "@/server/session";
import { buildPrepRequest, callPrepAgent, loadOrderHistory, syntheticHistory } from "@/server/prep";
import { run, UserError, type ActionResult } from "@/server/actions/result";

const schema = z.object({ horizonDays: z.number().int().min(1).max(7), source: z.enum(["orders", "synthetic"]) });

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
