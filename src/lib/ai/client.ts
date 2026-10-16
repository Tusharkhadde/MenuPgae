import type { AiConfig } from "@/lib/ai/config";
import { parseModelJson } from "@/lib/ai/json";

/**
 * Minimal provider layer for open-weight models (Gemma). Pure: takes the config and
 * a fetch implementation, so it runs in Next.js, in scripts and in tests.
 *
 *  - google: POST generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 *            No responseMimeType / systemInstruction (Gemma 3 on that API rejects them):
 *            everything goes in the user turn and we parse JSON ourselves.
 *  - ollama: POST {base}/v1/chat/completions (OpenAI-compatible; also LM Studio, llama.cpp, vLLM).
 *            Images go as data: URLs in image_url parts.
 */

export type AiErrorKind = "unreachable" | "rate_limited" | "model_not_found" | "http" | "empty" | "parse";

export class AiError extends Error {
  constructor(
    public readonly kind: AiErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export type AiImage = { base64: string; mimeType: string };
export type AiRequest = { prompt: string; image?: AiImage; temperature?: number; maxOutputTokens?: number; timeoutMs?: number };
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type BuiltRequest = { url: string; init: RequestInit };

export function buildGoogleRequest(apiKey: string, model: string, req: AiRequest): BuiltRequest {
  const parts: unknown[] = [{ text: req.prompt }];
  if (req.image) parts.push({ inline_data: { mime_type: req.image.mimeType, data: req.image.base64 } });
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: req.temperature ?? 0.2, maxOutputTokens: req.maxOutputTokens ?? 8192 },
      }),
    },
  };
}

export function buildOpenAiCompatRequest(endpoint: string, apiKey: string | null, model: string, req: AiRequest): BuiltRequest {
  const content: unknown = req.image
    ? [
        { type: "text", text: req.prompt },
        { type: "image_url", image_url: { url: `data:${req.image.mimeType};base64,${req.image.base64}` } },
      ]
    : req.prompt;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return {
    url: endpoint,
    init: {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        temperature: req.temperature ?? 0.2,
        max_tokens: req.maxOutputTokens ?? 8192,
        stream: false,
      }),
    },
  };
}

type GoogleResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
};
type OpenAiResponse = {
  choices?: { message?: { content?: string | { type?: string; text?: string }[] | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/** Token counts as reported by the provider (output includes thinking tokens, which are billed as output). */
export type AiUsage = { inputTokens: number; outputTokens: number };

export function usageFromGoogle(data: GoogleResponse): AiUsage | null {
  const u = data.usageMetadata;
  if (!u || typeof u.promptTokenCount !== "number") return null;
  return { inputTokens: u.promptTokenCount, outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) };
}

export function usageFromOpenAi(data: OpenAiResponse): AiUsage | null {
  const u = data.usage;
  if (!u || typeof u.prompt_tokens !== "number") return null;
  return { inputTokens: u.prompt_tokens, outputTokens: u.completion_tokens ?? 0 };
}

/** Join the answer text, skipping "thought" parts that thinking-capable models may return. */
export function textFromGoogle(data: GoogleResponse): string {
  return data.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
}

export function textFromOpenAi(data: OpenAiResponse): string {
  const c = data.choices?.[0]?.message?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((p) => p.text ?? "").join("");
  return "";
}

async function send(fetchImpl: FetchLike, built: BuiltRequest, timeoutMs: number): Promise<Response> {
  try {
    return await fetchImpl(built.url, { ...built.init, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new AiError("unreachable", "The AI service didn't respond. Try again in a minute.");
  }
}

async function failFor(res: Response, label: string): Promise<never> {
  const body = await res.text().catch(() => "");
  if (res.status === 429) throw new AiError("rate_limited", "The AI free-tier limit was reached. Try again in a minute.", 429);
  if (res.status === 404) throw new AiError("model_not_found", `${label}: model not found (${body.slice(0, 200)})`, 404);
  throw new AiError("http", `${label} returned HTTP ${res.status}: ${body.slice(0, 300)}`, res.status);
}

export type AiClient = {
  config: AiConfig;
  /** The model that actually answered last (differs from config when the Google fallback kicked in). */
  lastModel: () => string;
  /** Token usage of the last call, when the provider reported it. */
  lastUsage: () => AiUsage | null;
  generateText: (req: AiRequest) => Promise<string>;
  generateJson: <T = unknown>(req: AiRequest) => Promise<T>;
};

export function createAiClient(config: AiConfig, fetchImpl: FetchLike = fetch): AiClient {
  let last = config.model;
  let usage: AiUsage | null = null;

  async function generateText(req: AiRequest): Promise<string> {
    usage = null;
    const timeout = req.timeoutMs ?? 60_000;
    if (config.provider === "google") {
      const primary = req.image ? config.visionModel : config.model;
      const models = [primary, ...(config.fallbackModel && config.fallbackModel !== primary ? [config.fallbackModel] : [])];
      for (let i = 0; i < models.length; i++) {
        const res = await send(fetchImpl, buildGoogleRequest(config.apiKey, models[i], req), timeout);
        if (res.status === 404 && i < models.length - 1) {
          console.warn(`[menupage] AI model ${models[i]} not found on Google AI Studio; retrying with ${models[i + 1]}. Set GEMMA_MODEL to silence this.`);
          continue;
        }
        if (!res.ok) await failFor(res, "Google AI Studio");
        last = models[i];
        const data = (await res.json()) as GoogleResponse;
        usage = usageFromGoogle(data);
        const text = textFromGoogle(data);
        if (!text.trim()) throw new AiError("empty", "The AI returned an empty answer.");
        return text;
      }
      throw new AiError("model_not_found", "No configured Gemma model is available.");
    }
    const model = req.image ? config.visionModel : config.model;
    const res = await send(fetchImpl, buildOpenAiCompatRequest(config.endpoint, config.apiKey, model, req), timeout);
    if (!res.ok) await failFor(res, "Local model server");
    last = model;
    const data = (await res.json()) as OpenAiResponse;
    usage = usageFromOpenAi(data);
    const text = textFromOpenAi(data);
    if (!text.trim()) throw new AiError("empty", "The AI returned an empty answer.");
    return text;
  }

  return {
    config,
    lastModel: () => last,
    lastUsage: () => usage,
    generateText,
    async generateJson<T>(req: AiRequest): Promise<T> {
      const text = await generateText(req);
      try {
        return parseModelJson<T>(text);
      } catch {
        throw new AiError("parse", "The AI answer couldn't be read. Try again.");
      }
    },
  };
}
