import type { AiClient } from "@/lib/ai/client";
import { checkTranslation, findGlossaryMatches, type GlossaryEntry, type GlossaryIssue } from "@/lib/glossary";
import { languageInfo } from "@/lib/languages";

export type TranslateInput = { id: string; name: string; description: string | null };
export type TranslateOutput = { name: string; description: string | null; issues?: GlossaryIssue[] };

/** Scripts where we ask for the Latin dish name in brackets so guests can say it to staff (and we can check it). */
const LATIN_SCRIPT = new Set(["en", "fr", "de", "es", "it", "ms"]);
export const isLatinScript = (lang: string) => LATIN_SCRIPT.has(lang);

/** Glossary entries relevant to this batch (mentioned in any name or description). */
export function glossaryForBatch(texts: TranslateInput[], glossary: GlossaryEntry[]): GlossaryEntry[] {
  const used = new Set<GlossaryEntry>();
  for (const t of texts) {
    for (const m of findGlossaryMatches(t.name, glossary)) used.add(m.entry);
    for (const m of findGlossaryMatches(t.description, glossary)) used.add(m.entry);
  }
  return [...used];
}

/**
 * One self-contained user prompt (Gemma on Google AI Studio has no system instruction
 * and no JSON mode, so the rules and the output contract are spelled out here).
 */
export function buildTranslatePrompt(texts: TranslateInput[], lang: string, glossary: GlossaryEntry[]): string {
  const info = languageInfo(lang);
  const latin = isLatinScript(lang);
  const protectedList = glossaryForBatch(texts, glossary);
  const lines = [
    `You translate restaurant menus. Translate each entry into ${info.label} (ISO code "${lang}").`,
    "",
    "Rules:",
    "1. Translate descriptions naturally and briefly. Never invent ingredients.",
    "2. Dish names listed under PROTECTED DISHES are proper names. Never translate them word by word.",
    latin
      ? '   Keep the protected name exactly as written in Latin letters (e.g. "Vada Pav" stays "Vada Pav").'
      : `   Write the protected name transliterated into the ${info.label} script, then the original Latin name in brackets, e.g. "<transliteration> (Vada Pav)".`,
    "3. For a protected dish, start the translated description with its explanation (translated), then the rest of the original description. If the original description is empty, use only the explanation.",
    '4. Other words in a name (e.g. "Cheese", "Jain", "Special") may be translated.',
    '5. Output ONLY a JSON object, no prose, no code fences: {"<id>": {"name": string, "description": string | null}, ...} with every id from the input.',
  ];
  if (protectedList.length) {
    lines.push("", "PROTECTED DISHES (name — explanation):");
    for (const e of protectedList) lines.push(`- ${e.term}${e.aliases?.length ? ` (also: ${e.aliases.join(", ")})` : ""} — ${e.explanation}`);
  }
  lines.push("", "ENTRIES:", JSON.stringify(texts));
  return lines.join("\n");
}

/** Validate and clamp the model's JSON, then post-check every entry against the glossary. */
export function finalizeTranslations(texts: TranslateInput[], out: unknown, glossary: GlossaryEntry[]): Record<string, TranslateOutput> {
  const obj = (out && typeof out === "object" ? out : {}) as Record<string, { name?: unknown; description?: unknown } | undefined>;
  const result: Record<string, TranslateOutput> = {};
  for (const t of texts) {
    const v = obj[t.id];
    if (!v || typeof v.name !== "string" || !v.name.trim()) continue;
    const translated = { name: v.name.trim().slice(0, 100), description: typeof v.description === "string" && v.description.trim() ? v.description.trim().slice(0, 400) : null };
    const issues = checkTranslation(t, translated, glossary);
    result[t.id] = issues.length ? { ...translated, issues } : translated;
  }
  return result;
}

export async function translateMenu(client: AiClient, texts: TranslateInput[], lang: string, glossary: GlossaryEntry[]): Promise<Record<string, TranslateOutput>> {
  if (!texts.length) return {};
  const out = await client.generateJson({ prompt: buildTranslatePrompt(texts, lang, glossary), temperature: 0.1 });
  return finalizeTranslations(texts, out, glossary);
}

/* ------------------------------------------------------------- Menu photo import */

export const MENU_PHOTO_PROMPT =
  "This is a photo of a restaurant menu. Extract every dish you can read. " +
  'Output ONLY a JSON object, no prose, no code fences: {"items":[{"category":string,"name":string,"description":string|null,"price":string,"diet":"veg"|"nonveg"|"vegan"|"egg"|null,"variants":string|null}]}. ' +
  "price is the number only (no currency symbol). If a dish has several sizes, put them in variants as Half:120|Full:200 and leave price empty. " +
  "Keep dish names exactly as printed (do not translate them). Do not invent dishes or prices.";

export function menuRowsFromJson(out: unknown): string[][] {
  const items = (out && typeof out === "object" && Array.isArray((out as { items?: unknown }).items) ? (out as { items: unknown[] }).items : []) as Record<string, unknown>[];
  const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
  const rows: string[][] = [["category", "name", "description", "price", "diet", "variants"]];
  for (const it of items) {
    if (!it || typeof it !== "object" || !str(it.name)) continue;
    rows.push([str(it.category), str(it.name), str(it.description), str(it.price), str(it.diet), str(it.variants)]);
  }
  return rows;
}

export async function readMenuImage(client: AiClient, base64: string, mimeType: string): Promise<string[][]> {
  const out = await client.generateJson({ prompt: MENU_PHOTO_PROMPT, image: { base64, mimeType }, temperature: 0.1, timeoutMs: 90_000 });
  return menuRowsFromJson(out);
}
