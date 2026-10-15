import "server-only";
import { eq } from "drizzle-orm";
import { aiConfig } from "@/lib/env";
import { AiError, createAiClient, type AiClient } from "@/lib/ai/client";
import { readMenuImage, translateMenu, type TranslateInput, type TranslateOutput } from "@/lib/ai/translate";
import { mergeGlossary, type GlossaryEntry } from "@/lib/glossary";
import { getDb } from "@/lib/db";
import { glossaryEntries } from "@/lib/db/schema";
import { UserError } from "@/server/actions/result";

/**
 * Optional AI helpers on open-weight Gemma models.
 *   AI_PROVIDER=google (default): Gemma via Google AI Studio (GOOGLE_AI_API_KEY; GEMINI_API_KEY accepted)
 *   AI_PROVIDER=ollama:           Ollama / any OpenAI-compatible server (OLLAMA_BASE_URL, OLLAMA_MODEL)
 * Everything here is OFF unless one is configured; callers show a friendly "not configured" state.
 */

function client(): AiClient {
  const cfg = aiConfig();
  if (!cfg) throw new UserError("AI tools aren't set up on this server (set GOOGLE_AI_API_KEY, or AI_PROVIDER=ollama).");
  return createAiClient(cfg);
}

/** Map provider errors to messages an owner can act on (details go to the server log). */
async function friendly<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AiError) {
      if (err.kind === "http" || err.kind === "model_not_found") console.error("[menupage] AI error", err.message);
      if (err.kind === "rate_limited" || err.kind === "unreachable" || err.kind === "parse" || err.kind === "empty") throw new UserError(err.message);
      throw new UserError("The AI service returned an error. Try again later.");
    }
    throw err;
  }
}

/** Built-in glossary merged with this restaurant's own entries. */
export async function glossaryFor(restaurantId: string): Promise<GlossaryEntry[]> {
  const db = await getDb();
  const rows = await db.select().from(glossaryEntries).where(eq(glossaryEntries.restaurantId, restaurantId));
  return mergeGlossary(rows.map((r) => ({ term: r.term, explanation: r.explanation, aliases: r.aliases.length ? r.aliases : undefined })));
}

export async function aiTranslate(restaurantId: string, texts: TranslateInput[], lang: string): Promise<Record<string, TranslateOutput>> {
  if (!texts.length) return {};
  const ai = client();
  const glossary = await glossaryFor(restaurantId);
  return friendly(() => translateMenu(ai, texts, lang, glossary));
}

/** Read a photo of a printed menu into CSV-like rows (Gemma vision): [category, name, description, price, diet, variants]. */
export async function aiMenuFromImage(base64: string, mimeType: string): Promise<string[][]> {
  const ai = client();
  return friendly(() => readMenuImage(ai, base64, mimeType));
}
