/**
 * AI provider configuration. Pure (no server-only import) so scripts and tests can use it.
 *
 *   AI_PROVIDER=google  → Gemma via the Google AI Studio API (default)
 *   AI_PROVIDER=ollama  → Ollama or any OpenAI-compatible server (local, no cloud)
 *
 * When AI_PROVIDER is unset: google if a Google key is present, otherwise ollama if a
 * local base URL is present, otherwise AI is off.
 */

export type AiProviderId = "google" | "ollama";

export const DEFAULT_GEMMA_MODEL = "gemma-3-27b-it";
/** Used once if the configured Google model id is not found (404) — Google rotates hosted Gemma ids. */
export const DEFAULT_GEMMA_FALLBACK_MODEL = "gemma-4-26b-a4b-it";
export const DEFAULT_LOCAL_MODEL = "gemma3:4b";
export const DEFAULT_OLLAMA_URL = "http://localhost:11434";

export type AiConfig =
  | {
      provider: "google";
      apiKey: string;
      model: string;
      visionModel: string;
      fallbackModel: string | null;
    }
  | {
      provider: "ollama";
      /** Chat-completions endpoint, e.g. http://localhost:11434/v1/chat/completions */
      endpoint: string;
      apiKey: string | null;
      model: string;
      visionModel: string;
    };

export type AiEnv = Partial<
  Record<
    | "AI_PROVIDER"
    | "GOOGLE_AI_API_KEY"
    | "GEMINI_API_KEY"
    | "GEMMA_MODEL"
    | "GEMMA_VISION_MODEL"
    | "GEMMA_FALLBACK_MODEL"
    | "GEMINI_MODEL"
    | "OLLAMA_BASE_URL"
    | "OPENAI_COMPAT_BASE_URL"
    | "OPENAI_COMPAT_API_KEY"
    | "OLLAMA_MODEL"
    | "OLLAMA_VISION_MODEL",
    string | undefined
  >
>;

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

/** Turn a base URL (with or without /v1, with or without /chat/completions) into the chat-completions endpoint. */
export function chatCompletionsUrl(base: string): string {
  const b = base.trim().replace(/\/+$/, "");
  if (/\/chat\/completions$/.test(b)) return b;
  if (/\/v\d+$/.test(b)) return `${b}/chat/completions`;
  return `${b}/v1/chat/completions`;
}

/** Explain why AI is off, or null when it is configured. */
export function aiConfigProblem(e: AiEnv): string | null {
  const provider = clean(e.AI_PROVIDER)?.toLowerCase();
  if (provider && provider !== "google" && provider !== "ollama") return `AI_PROVIDER must be "google" or "ollama" (got "${provider}").`;
  if (provider === "google" && !clean(e.GOOGLE_AI_API_KEY) && !clean(e.GEMINI_API_KEY)) return "AI_PROVIDER=google needs GOOGLE_AI_API_KEY.";
  if (!provider && !clean(e.GOOGLE_AI_API_KEY) && !clean(e.GEMINI_API_KEY) && !clean(e.OLLAMA_BASE_URL) && !clean(e.OPENAI_COMPAT_BASE_URL)) {
    return "No AI provider configured (set GOOGLE_AI_API_KEY, or AI_PROVIDER=ollama).";
  }
  return null;
}

export function resolveAiConfig(e: AiEnv): AiConfig | null {
  if (aiConfigProblem(e)) return null;
  const googleKey = clean(e.GOOGLE_AI_API_KEY) ?? clean(e.GEMINI_API_KEY);
  const localBase = clean(e.OPENAI_COMPAT_BASE_URL) ?? clean(e.OLLAMA_BASE_URL);
  const explicit = clean(e.AI_PROVIDER)?.toLowerCase() as AiProviderId | undefined;
  const provider: AiProviderId = explicit ?? (googleKey ? "google" : "ollama");

  if (provider === "google") {
    // GEMINI_MODEL is honoured only if it names a Gemma model; this layer is Gemma-first.
    const legacy = clean(e.GEMINI_MODEL);
    const model = clean(e.GEMMA_MODEL) ?? (legacy && /^gemma/i.test(legacy) ? legacy : undefined) ?? DEFAULT_GEMMA_MODEL;
    const fallback = clean(e.GEMMA_FALLBACK_MODEL) ?? DEFAULT_GEMMA_FALLBACK_MODEL;
    return {
      provider: "google",
      apiKey: googleKey!,
      model,
      visionModel: clean(e.GEMMA_VISION_MODEL) ?? model,
      fallbackModel: fallback === "none" || fallback === model ? null : fallback,
    };
  }
  const model = clean(e.OLLAMA_MODEL) ?? DEFAULT_LOCAL_MODEL;
  return {
    provider: "ollama",
    endpoint: chatCompletionsUrl(localBase ?? DEFAULT_OLLAMA_URL),
    apiKey: clean(e.OPENAI_COMPAT_API_KEY) ?? null,
    model,
    visionModel: clean(e.OLLAMA_VISION_MODEL) ?? model,
  };
}

/** Short human label, e.g. "gemma-3-27b-it via Google AI Studio". */
export function describeAiConfig(c: AiConfig): string {
  return c.provider === "google" ? `${c.model} via Google AI Studio` : `${c.model} via ${c.endpoint.replace(/\/v\d+\/chat\/completions$/, "")}`;
}
