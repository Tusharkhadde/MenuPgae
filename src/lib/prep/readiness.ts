import { MIN_BACKTEST_DAYS, MIN_HISTORY_DAYS } from "@/lib/prep/history";

/**
 * Where prep-planner history comes from. Only demo sandbox accounts (the hidden judge demo) ever get
 * the synthetic "Demo data" history; every real account uses its own orders, with no fallback.
 */
export type HistorySource = "orders" | "synthetic";

export function historySourceFor(user: { isDemo: boolean }): HistorySource {
  return user.isDemo === true ? "synthetic" : "orders";
}

/** Days of orders after which every prep feature (plan, Ask the planner, forecast accuracy) works. */
export const FULL_HISTORY_DAYS = MIN_BACKTEST_DAYS;

export type Readiness = {
  days: number;
  target: number;
  percent: number;
  planner: { ready: boolean; needed: number; min: number };
  accuracy: { ready: boolean; needed: number; min: number };
};

/** Progress of a real restaurant's order history toward the prep features. */
export function prepReadiness(orderDays: number): Readiness {
  const days = Math.max(0, Math.floor(Number.isFinite(orderDays) ? orderDays : 0));
  const step = (min: number) => ({ ready: days >= min, needed: Math.max(0, min - days), min });
  return {
    days,
    target: FULL_HISTORY_DAYS,
    percent: Math.min(100, Math.round((days / FULL_HISTORY_DAYS) * 100)),
    planner: step(MIN_HISTORY_DAYS),
    accuracy: step(MIN_BACKTEST_DAYS),
  };
}

export function needsMoreDays(needed: number): string {
  return `Needs ${needed} more day${needed === 1 ? "" : "s"} of orders`;
}

/** The error a real account gets when it doesn't have enough orders yet. Never suggests synthetic data. */
export function notEnoughOrdersMessage(have: number, min: number): string {
  return `${needsMoreDays(Math.max(0, min - have))} (${have} of ${min} days with orders so far). The planner only uses your real orders.`;
}
