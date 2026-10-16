import type { AiUsage } from "@/lib/ai/client";

/**
 * Open vs closed translation scorecard helpers (used by scripts/eval-translate.ts). Pure, tested.
 *
 * COST RATES ARE ESTIMATES. USD per 1M tokens, standard paid tier, from Google's Gemini API pricing page
 * https://ai.google.dev/gemini-api/docs/pricing (checked 2026-10-16):
 *  - Gemma on Google AI Studio: "Free of charge" on the free tier; the paid tier lists "Not available".
 *    So the hosted Gemma cost is $0 within free-tier rate limits. Self-hosting (Ollama) costs your own
 *    hardware/electricity, which is not modelled here.
 *  - gemini-3.5-flash-lite: $0.30 input (text/image/video/audio) and $2.50 output (incl. thinking tokens).
 * Override at run time with --rate model=input/output (e.g. --rate gemini-3.5-flash-lite=0.3/2.5).
 */
export type CostRate = { inputPer1M: number; outputPer1M: number; note: string };

export const COST_RATES: Record<string, CostRate> = {
  "gemma*": { inputPer1M: 0, outputPer1M: 0, note: "Gemma on Google AI Studio free tier (no paid tier offered)" },
  "gemma3*": { inputPer1M: 0, outputPer1M: 0, note: "local Gemma via Ollama — hardware cost not modelled" },
  "gemini-3.5-flash-lite": { inputPer1M: 0.3, outputPer1M: 2.5, note: "Gemini API paid tier, standard" },
};

export const DEFAULT_GEMINI_BASELINE_MODEL = "gemini-3.5-flash-lite";

/** Rough tokens for text when the provider didn't report usage (≈4 characters per token). Marked as estimated. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function rateFor(model: string, rates: Record<string, CostRate> = COST_RATES): CostRate | null {
  if (rates[model]) return rates[model];
  const wild = Object.keys(rates)
    .filter((k) => k.endsWith("*") && model.startsWith(k.slice(0, -1)))
    .sort((a, b) => b.length - a.length)[0];
  return wild ? rates[wild] : null;
}

/** Estimated USD for one call, or null if we have no rate for the model. */
export function estimateCostUsd(model: string, usage: AiUsage, rates: Record<string, CostRate> = COST_RATES): number | null {
  const r = rateFor(model, rates);
  if (!r) return null;
  return (usage.inputTokens * r.inputPer1M + usage.outputTokens * r.outputPer1M) / 1_000_000;
}

/** Parse "--rate model=in/out" overrides. */
export function parseRateOverride(spec: string): [string, CostRate] | null {
  const m = /^([^=]+)=([\d.]+)\/([\d.]+)$/.exec(spec.trim());
  if (!m) return null;
  return [m[1], { inputPer1M: Number(m[2]), outputPer1M: Number(m[3]), note: "override from --rate" }];
}

export function formatUsd(v: number | null): string {
  if (v == null) return "n/a";
  if (v === 0) return "$0";
  return v < 0.01 ? `$${v.toFixed(5)}` : `$${v.toFixed(4)}`;
}

/** Markdown table from header + rows (cells already formatted). */
export function markdownTable(header: string[], rows: string[][]): string {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]) => `| ${cells.map((c, i) => c.padEnd(widths[i])).join(" | ")} |`;
  return [line(header), `|${widths.map((w) => "-".repeat(w + 2)).join("|")}|`, ...rows.map(line)].join("\n");
}
