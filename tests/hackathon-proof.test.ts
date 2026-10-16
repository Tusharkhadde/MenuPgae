import { describe, expect, it, vi } from "vitest";
import { FESTIVALS, FESTIVAL_HORIZON_DAYS, FESTIVAL_SOURCES, festivalPayload, festivalsBetween, nextFestival } from "@/lib/prep/festivals";
import { COST_RATES, estimateCostUsd, estimateTokens, formatUsd, markdownTable, parseRateOverride, rateFor } from "@/lib/ai/scorecard";
import { createAiClient, usageFromGoogle, usageFromOpenAi } from "@/lib/ai/client";
import { resolveAiConfig } from "@/lib/ai/config";
import { withAgentSpan } from "@/lib/observability";

describe("festival calendar (shared with the agent)", () => {
  it("covers every festival for 2024–2027 with sources", () => {
    const keys = new Set(FESTIVALS.map((f) => f.key));
    expect([...keys].sort()).toEqual(["christmas", "diwali", "dussehra", "eid_al_adha", "eid_al_fitr", "ganesh_chaturthi", "holi", "navratri"]);
    for (const k of keys) {
      expect(FESTIVALS.filter((f) => f.key === k).map((f) => f.date.slice(0, 4))).toEqual(["2024", "2025", "2026", "2027"]);
    }
    for (const y of ["2024", "2025", "2026", "2027"]) expect(FESTIVAL_SOURCES[y]).toMatch(/^https:\/\//);
  });

  it("finds festivals in a window and counts down to the next one", () => {
    expect(festivalsBetween("2026-10-01", "2026-11-30").map((f) => f.key)).toEqual(["navratri", "dussehra", "diwali"]);
    expect(nextFestival("2026-11-05")).toMatchObject({ key: "diwali", date: "2026-11-08", days: 3 });
    expect(nextFestival("2026-11-08")?.days).toBe(0);
    expect(nextFestival("2026-06-01")).toBeNull(); // nothing within the 30-day horizon
    expect(FESTIVAL_HORIZON_DAYS).toBe(30);
    expect(festivalPayload("2025-08-27", "2025-08-27")).toEqual([{ date: "2025-08-27", key: "ganesh_chaturthi" }]);
  });
});

describe("open vs closed scorecard helpers", () => {
  it("prices Gemma at $0 and Gemini Flash-Lite from the configured rates", () => {
    expect(rateFor("gemma-3-27b-it")?.inputPer1M).toBe(0);
    expect(rateFor("gemma3:4b")?.outputPer1M).toBe(0);
    expect(estimateCostUsd("gemini-3.5-flash-lite", { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBeCloseTo(
      COST_RATES["gemini-3.5-flash-lite"].inputPer1M + COST_RATES["gemini-3.5-flash-lite"].outputPer1M,
    );
    expect(estimateCostUsd("some-unknown-model", { inputTokens: 10, outputTokens: 10 })).toBeNull();
  });

  it("parses rate overrides and formats output", () => {
    expect(parseRateOverride("gemini-3.5-flash-lite=0.3/2.5")).toEqual(["gemini-3.5-flash-lite", { inputPer1M: 0.3, outputPer1M: 2.5, note: "override from --rate" }]);
    expect(parseRateOverride("nope")).toBeNull();
    expect(estimateTokens("abcdefgh")).toBe(2);
    expect(formatUsd(null)).toBe("n/a");
    expect(formatUsd(0)).toBe("$0");
    expect(markdownTable(["a", "bb"], [["1", "2"]]).split("\n")).toHaveLength(3);
  });

  it("reads token usage from both providers (thinking tokens count as output)", () => {
    expect(usageFromGoogle({ usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 3 } })).toEqual({ inputTokens: 10, outputTokens: 8 });
    expect(usageFromGoogle({})).toBeNull();
    expect(usageFromOpenAi({ usage: { prompt_tokens: 7, completion_tokens: 2 } })).toEqual({ inputTokens: 7, outputTokens: 2 });
  });

  it("client exposes lastUsage", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 1 } }), { status: 200 }),
    );
    const ai = createAiClient(resolveAiConfig({ GOOGLE_AI_API_KEY: "k" })!, fetchMock);
    await ai.generateText({ prompt: "hi" });
    expect(ai.lastUsage()).toEqual({ inputTokens: 4, outputTokens: 1 });
  });
});

describe("Sentry wrapper", () => {
  it("is a plain pass-through without SENTRY_DSN", async () => {
    const fn = vi.fn(async () => 42);
    await expect(withAgentSpan("ask", fn, undefined)).resolves.toBe(42);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("passes through when a DSN is set but Sentry was never initialised", async () => {
    await expect(withAgentSpan("ask", async () => "ok", "https://public@example.invalid/1")).resolves.toBe("ok");
  });

  it("propagates errors", async () => {
    await expect(withAgentSpan("ask", async () => Promise.reject(new Error("boom")), undefined)).rejects.toThrow("boom");
  });
});
