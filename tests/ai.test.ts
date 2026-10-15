import { describe, expect, it, vi } from "vitest";
import { ModelJsonError, extractFirstJson, parseModelJson, stripFences } from "@/lib/ai/json";
import { aiConfigProblem, chatCompletionsUrl, resolveAiConfig } from "@/lib/ai/config";
import { AiError, buildGoogleRequest, buildOpenAiCompatRequest, createAiClient, textFromGoogle } from "@/lib/ai/client";
import { menuRowsFromJson, readMenuImage } from "@/lib/ai/translate";

describe("parseModelJson", () => {
  it("parses plain JSON", () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
  });
  it("strips ```json fences and surrounding prose", () => {
    expect(parseModelJson('Here you go:\n```json\n{"a": {"b": 2}}\n```\nEnjoy!')).toEqual({ a: { b: 2 } });
    expect(stripFences("```\n{}\n```")).toBe("{}");
  });
  it("extracts the first balanced object, ignoring braces inside strings", () => {
    const text = 'Sure! {"name": "Vada Pav {spicy}", "n": [1, {"x": "}"}]} and then {"other": true}';
    expect(extractFirstJson(text)).toBe('{"name": "Vada Pav {spicy}", "n": [1, {"x": "}"}]}');
    expect(parseModelJson(text)).toEqual({ name: "Vada Pav {spicy}", n: [1, { x: "}" }] });
  });
  it("handles escaped quotes and trailing commas", () => {
    expect(parseModelJson('{"q": "say \\"hi\\"", "list": [1, 2,],}')).toEqual({ q: 'say "hi"', list: [1, 2] });
  });
  it("rejects non-objects and garbage", () => {
    expect(() => parseModelJson("")).toThrow(ModelJsonError);
    expect(() => parseModelJson("I can't help with that.")).toThrow(ModelJsonError);
    expect(() => parseModelJson("[1,2]")).toThrow(ModelJsonError);
    expect(parseModelJson("[1,2]", { allowArray: true })).toEqual([1, 2]);
  });
});

describe("AI provider switch", () => {
  it("is off with no configuration", () => {
    expect(resolveAiConfig({})).toBeNull();
    expect(aiConfigProblem({})).toMatch(/No AI provider/);
  });
  it("defaults to Gemma on Google AI Studio and accepts GEMINI_API_KEY as an alias", () => {
    const c = resolveAiConfig({ GEMINI_API_KEY: "k" });
    expect(c).toMatchObject({ provider: "google", apiKey: "k", model: "gemma-3-27b-it", visionModel: "gemma-3-27b-it" });
    expect(resolveAiConfig({ GOOGLE_AI_API_KEY: "g", GEMINI_API_KEY: "old" })).toMatchObject({ apiKey: "g" });
  });
  it("honours GEMMA_MODEL, ignores a non-Gemma GEMINI_MODEL", () => {
    expect(resolveAiConfig({ GOOGLE_AI_API_KEY: "k", GEMMA_MODEL: "gemma-3-12b-it" })).toMatchObject({ model: "gemma-3-12b-it" });
    expect(resolveAiConfig({ GOOGLE_AI_API_KEY: "k", GEMINI_MODEL: "gemini-3.5-flash-lite" })).toMatchObject({ model: "gemma-3-27b-it" });
    expect(resolveAiConfig({ GOOGLE_AI_API_KEY: "k", GEMMA_FALLBACK_MODEL: "none" })).toMatchObject({ fallbackModel: null });
  });
  it("switches to a local OpenAI-compatible server with AI_PROVIDER=ollama", () => {
    expect(resolveAiConfig({ AI_PROVIDER: "ollama", GOOGLE_AI_API_KEY: "k" })).toMatchObject({
      provider: "ollama",
      endpoint: "http://localhost:11434/v1/chat/completions",
      model: "gemma3:4b",
    });
    expect(resolveAiConfig({ OPENAI_COMPAT_BASE_URL: "http://lm:1234/v1", OLLAMA_MODEL: "gemma3:12b" })).toMatchObject({
      provider: "ollama",
      endpoint: "http://lm:1234/v1/chat/completions",
      model: "gemma3:12b",
    });
  });
  it("rejects unknown providers and google without a key", () => {
    expect(resolveAiConfig({ AI_PROVIDER: "openai", GOOGLE_AI_API_KEY: "k" })).toBeNull();
    expect(aiConfigProblem({ AI_PROVIDER: "google" })).toMatch(/GOOGLE_AI_API_KEY/);
  });
  it("normalises chat-completions URLs", () => {
    expect(chatCompletionsUrl("http://localhost:11434/")).toBe("http://localhost:11434/v1/chat/completions");
    expect(chatCompletionsUrl("http://x/v1/chat/completions")).toBe("http://x/v1/chat/completions");
  });
});

describe("request builders", () => {
  it("Google: no JSON mode or system instruction (unsupported for Gemma), image as inline_data", () => {
    const r = buildGoogleRequest("key", "gemma-3-27b-it", { prompt: "hi", image: { base64: "AAA", mimeType: "image/png" } });
    expect(r.url).toContain("/models/gemma-3-27b-it:generateContent");
    const body = JSON.parse(String(r.init.body));
    expect(body.generationConfig.responseMimeType).toBeUndefined();
    expect(body.systemInstruction).toBeUndefined();
    expect(body.contents[0].parts[1]).toEqual({ inline_data: { mime_type: "image/png", data: "AAA" } });
    expect((r.init.headers as Record<string, string>)["x-goog-api-key"]).toBe("key");
  });
  it("OpenAI-compatible: image as data URL, optional bearer", () => {
    const r = buildOpenAiCompatRequest("http://o/v1/chat/completions", null, "gemma3:4b", { prompt: "p", image: { base64: "BBB", mimeType: "image/jpeg" } });
    const body = JSON.parse(String(r.init.body));
    expect(body.model).toBe("gemma3:4b");
    expect(body.messages[0].content[1].image_url.url).toBe("data:image/jpeg;base64,BBB");
    expect((r.init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
  it("skips thought parts in Google answers", () => {
    expect(textFromGoogle({ candidates: [{ content: { parts: [{ text: "thinking…", thought: true }, { text: '{"ok":1}' }] } }] })).toBe('{"ok":1}');
  });
});

describe("createAiClient", () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("parses fenced JSON from Gemma and records the model", async () => {
    const fetchMock = vi.fn(async () => json({ candidates: [{ content: { parts: [{ text: '```json\n{"a":1}\n```' }] } }] }));
    const ai = createAiClient(resolveAiConfig({ GOOGLE_AI_API_KEY: "k" })!, fetchMock);
    await expect(ai.generateJson({ prompt: "x" })).resolves.toEqual({ a: 1 });
    expect(ai.lastModel()).toBe("gemma-3-27b-it");
  });

  it("falls back once to the next Gemma id on 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: { message: "not found" } }, 404))
      .mockResolvedValueOnce(json({ candidates: [{ content: { parts: [{ text: '{"b":2}' }] } }] }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ai = createAiClient(resolveAiConfig({ GOOGLE_AI_API_KEY: "k" })!, fetchMock);
    await expect(ai.generateJson({ prompt: "x" })).resolves.toEqual({ b: 2 });
    expect(fetchMock.mock.calls[1][0]).toContain("gemma-4-26b-a4b-it");
    expect(ai.lastModel()).toBe("gemma-4-26b-a4b-it");
    warn.mockRestore();
  });

  it("maps 429 and network failures to AiError kinds", async () => {
    const ai = createAiClient(resolveAiConfig({ GOOGLE_AI_API_KEY: "k" })!, async () => json({}, 429));
    await expect(ai.generateText({ prompt: "x" })).rejects.toMatchObject({ kind: "rate_limited" });
    const down = createAiClient(resolveAiConfig({ AI_PROVIDER: "ollama" })!, async () => {
      throw new Error("ECONNREFUSED");
    });
    await expect(down.generateText({ prompt: "x" })).rejects.toBeInstanceOf(AiError);
  });

  it("menu photo import uses the vision model on Ollama and returns CSV rows", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.model).toBe("gemma3:12b");
      return json({ choices: [{ message: { content: 'Found these: {"items":[{"category":"Snacks","name":"Vada Pav","description":null,"price":"20","diet":"veg"},{"name":""}]}' } }] });
    });
    const ai = createAiClient(resolveAiConfig({ AI_PROVIDER: "ollama", OLLAMA_VISION_MODEL: "gemma3:12b" })!, fetchMock);
    const rows = await readMenuImage(ai, "AAA", "image/jpeg");
    expect(rows).toEqual([
      ["category", "name", "description", "price", "diet", "variants"],
      ["Snacks", "Vada Pav", "", "20", "veg", ""],
    ]);
    expect(menuRowsFromJson(null)).toHaveLength(1);
  });
});
