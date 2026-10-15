import type { HistoryRow } from "@/lib/prep/history";

/** Request sent to the Python prep agent (/agent, POST /v1/prep-plan). */
export type PrepRequest = {
  restaurant: { name: string; timezone: string; currency: string };
  history: HistoryRow[];
  holidays: string[];
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
    summary: string;
    items: { item: string; quantity: number; note: string | null }[];
    risk_notes: { item: string; note: string }[];
  };
  warnings: string[];
};
