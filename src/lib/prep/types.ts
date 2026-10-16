import type { HistoryRow } from "@/lib/prep/history";

/** Request sent to the Python prep agent (/agent, POST /v1/prep-plan). */
export type PrepRequest = {
  restaurant: { name: string; timezone: string; currency: string };
  history: HistoryRow[];
  holidays: string[];
  /** Movable festivals in the window (src/lib/prep/festivals.ts) — used as forecast features by the agent. */
  festivals: { date: string; key: string }[];
  start_date: string;
  horizon_days: number;
  synthetic: boolean;
};

export type ForecastRow = { date: string; item: string; category: string; low: number; median: number; prep: number; high: number; peak_bucket: string | null };
export type DailyTotal = { date: string; low: number; median: number; high: number };
export type Anomaly = { date: string; item: string | null; kind: "spike" | "drop"; actual: number; expected: number; low: number; high: number };
export type RiskItem = { item: string; date: string; high: number; usual: number; ratio: number };

/** Response from the prep agent. Numbers come from TabPFN; only the wording comes from Gemma. */
export type PrepPlan = {
  generated_at: string;
  synthetic: boolean;
  start_date: string;
  horizon_days: number;
  models: { forecaster: string; narrator: string };
  data: { days: number; rows: number; items: number; training_rows: number };
  forecast: ForecastRow[];
  daily_totals: DailyTotal[];
  anomalies: Anomaly[];
  risk: RiskItem[];
  prep: {
    source: "gemma" | "template";
    /** The day the prep list is for (first forecast day). */
    date: string;
    summary: string;
    items: { item: string; quantity: number; note: string | null }[];
    risk_notes: { item: string; note: string }[];
  };
  warnings: string[];
};

/** Request body shared by /v1/backtest and /v1/ask. */
export type HistoryPayload = Pick<PrepRequest, "restaurant" | "history" | "holidays" | "festivals" | "synthetic">;

export type ModelScore = { mae: number; wape: number | null };
export type BacktestModel = "tabpfn" | "last_week" | "weekday_mean_4w";

/** Response from POST /v1/backtest. Every number is computed by the agent from the held-out days. */
export type BacktestResult = {
  generated_at: string;
  synthetic: boolean;
  holdout_days: number;
  holdout: { start: string; end: string };
  train: { days: number; rows: number };
  dish_days: number;
  models: Record<BacktestModel, string> & { tabpfn_detail: string };
  overall: Record<BacktestModel, ModelScore>;
  per_dish: ({ item: string; actual_total: number; days: number } & Record<BacktestModel, ModelScore>)[];
  best_by_wape: BacktestModel | null;
};

/** Response from POST /v1/ask. Quantities come from TabPFN; the language model only parses and words. */
export type AskResult = {
  generated_at: string;
  synthetic: boolean;
  question: string;
  intent: {
    tool: "forecast_demand";
    arguments: { dishes: string[]; start_date: string; end_date: string };
    parser: "gemma" | "rules";
    unmatched: string[];
  };
  rows: ForecastRow[];
  totals: { item: string; prep: number; median: number; low: number; high: number }[];
  answer: string;
  answer_source: "gemma" | "template";
  models: { forecaster: string; language: string };
  notes: string[];
};
