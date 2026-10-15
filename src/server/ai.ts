import "server-only";
import { env, features } from "@/lib/env";
import { UserError } from "@/server/actions/result";

/**
 * Optional AI helpers through the Gemini API (free tier is enough).
 * Everything here is OFF unless GEMINI_API_KEY is set; callers show a friendly
 * "not configured" state. Default model: gemini-3.5-flash-lite (override with GEMINI_MODEL).
 */
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

async function generateJson(parts: unknown[]): Promise<unknown> {
  if (!features.gemini()) throw new UserError("AI tools aren't set up on this server (GEMINI_API_KEY is missing).");
  const model = env().GEMINI_MODEL ?? DEFAULT_MODEL;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env().GEMINI_API_KEY! },
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } }),
    signal: AbortSignal.timeout(45_000),
  }).catch(() => null);
  if (!res) throw new UserError("The AI service didn't respond. Try again in a minute.");
  if (res.status === 429) throw new UserError("The AI free-tier limit was reached. Try again in a minute.");
  if (!res.ok) {
    console.error("[menupage] gemini error", res.status, await res.text().catch(() => ""));
    throw new UserError("The AI service returned an error. Try again later.");
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new UserError("The AI answer couldn't be read. Try again.");
  }
}

export async function geminiTranslate(
  texts: { id: string; name: string; description: string | null }[],
  lang: string,
): Promise<Record<string, { name: string; description: string | null }>> {
  if (!texts.length) return {};
  const prompt =
    `Translate these restaurant menu entries into the language with ISO code "${lang}". ` +
    "Keep dish names that are proper nouns recognisable (transliterate rather than literally translate when natural). " +
    'Return ONLY a JSON object mapping each id to {"name": string, "description": string|null}.\n\n' +
    JSON.stringify(texts);
  const out = (await generateJson([{ text: prompt }])) as Record<string, { name?: unknown; description?: unknown }>;
  const result: Record<string, { name: string; description: string | null }> = {};
  for (const t of texts) {
    const v = out?.[t.id];
    if (v && typeof v.name === "string") {
      result[t.id] = { name: v.name.slice(0, 100), description: typeof v.description === "string" ? v.description.slice(0, 400) : null };
    }
  }
  return result;
}

/** Read a photo of a printed menu into CSV-like rows: [category, name, description, price]. */
export async function geminiMenuFromImage(base64: string, mimeType: string): Promise<string[][]> {
  const prompt =
    "This is a photo of a restaurant menu. Extract every dish. " +
    'Return ONLY JSON: {"items":[{"category":string,"name":string,"description":string|null,"price":string,"diet":"veg"|"nonveg"|"vegan"|"egg"|null}]}. ' +
    "price is the number only (no currency symbol). If a dish has several sizes, use the format Half:120|Full:200 in a \"variants\" field and leave price empty. Do not invent dishes.";
  const out = (await generateJson([{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }])) as {
    items?: { category?: unknown; name?: unknown; description?: unknown; price?: unknown; diet?: unknown; variants?: unknown }[];
  };
  const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
  const rows: string[][] = [["category", "name", "description", "price", "diet", "variants"]];
  for (const it of out?.items ?? []) {
    if (!str(it.name)) continue;
    rows.push([str(it.category), str(it.name), str(it.description), str(it.price), str(it.diet), str(it.variants)]);
  }
  return rows;
}
