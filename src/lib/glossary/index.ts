import { DISH_GLOSSARY, type GlossaryEntry } from "@/lib/glossary/dishes";

export { DISH_GLOSSARY, type GlossaryEntry };

/** Lower-case, strip diacritics, unify hyphens/whitespace so "Misal-Pav" == "misal pav". */
export function normalizeTerm(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Built-in entries + restaurant entries; a restaurant entry replaces a built-in one with the same name. */
export function mergeGlossary(custom: GlossaryEntry[], base: GlossaryEntry[] = DISH_GLOSSARY): GlossaryEntry[] {
  const byKey = new Map<string, GlossaryEntry>();
  for (const e of base) byKey.set(normalizeTerm(e.term), e);
  for (const e of custom) {
    const key = normalizeTerm(e.term);
    if (key) byKey.set(key, e);
  }
  return [...byKey.values()];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word, normalized occurrences of `needle` in `hay` (both already normalized). */
function wordSpans(hay: string, needle: string): [number, number][] {
  if (!needle) return [];
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRe(needle)})(?=$|[^\\p{L}\\p{N}])`, "gu");
  const out: [number, number][] = [];
  for (let m = re.exec(hay); m; m = re.exec(hay)) {
    const start = m.index + m[1].length;
    out.push([start, start + m[2].length]);
    re.lastIndex = start + 1;
  }
  return out;
}

export type GlossaryMatch = { entry: GlossaryEntry; matched: string };

/**
 * Glossary entries mentioned in `text`. Longest match wins, so "Masala Dosa" is not also
 * reported as "Dosa".
 */
export function findGlossaryMatches(text: string | null | undefined, entries: GlossaryEntry[]): GlossaryMatch[] {
  if (!text) return [];
  const hay = normalizeTerm(text);
  const hits: { entry: GlossaryEntry; matched: string; span: [number, number] }[] = [];
  for (const entry of entries) {
    for (const form of [entry.term, ...(entry.aliases ?? [])]) {
      for (const span of wordSpans(hay, normalizeTerm(form))) hits.push({ entry, matched: form, span });
    }
  }
  hits.sort((a, b) => b.span[1] - b.span[0] - (a.span[1] - a.span[0]) || a.span[0] - b.span[0]);
  const taken: [number, number][] = [];
  const seen = new Set<GlossaryEntry>();
  const result: GlossaryMatch[] = [];
  for (const h of hits) {
    if (taken.some(([s, e]) => h.span[0] < e && h.span[1] > s)) continue;
    taken.push(h.span);
    if (seen.has(h.entry)) continue;
    seen.add(h.entry);
    result.push({ entry: h.entry, matched: h.matched });
  }
  return result;
}

/** True if `text` keeps the protected name (canonical or any alias), in Latin letters. */
export function keepsProtectedName(text: string | null | undefined, entry: GlossaryEntry): boolean {
  if (!text) return false;
  const hay = normalizeTerm(text);
  return [entry.term, ...(entry.aliases ?? [])].some((f) => wordSpans(hay, normalizeTerm(f)).length > 0);
}

export type GlossaryIssue = {
  term: string;
  kind: "name_not_kept" | "literal_trap" | "explanation_missing";
  detail: string;
};

/**
 * Post-check one translated menu entry against the glossary.
 *  - name_not_kept:        a protected dish in the original name is missing from the translated name
 *                          (usually a literal translation, e.g. "Pain de pomme de terre" for Vada Pav)
 *  - literal_trap:         a known literal gloss appears in the name (e.g. "duck" for Bombay Duck)
 *  - explanation_missing:  a protected dish got no description at all (soft warning)
 */
export function checkTranslation(
  original: { name: string; description: string | null },
  translated: { name: string; description: string | null },
  entries: GlossaryEntry[],
): GlossaryIssue[] {
  const issues: GlossaryIssue[] = [];
  for (const { entry } of findGlossaryMatches(original.name, entries)) {
    if (!keepsProtectedName(translated.name, entry)) {
      issues.push({ term: entry.term, kind: "name_not_kept", detail: `"${entry.term}" was not kept in the translated name "${translated.name}"` });
    }
    let stripped = normalizeTerm(translated.name);
    for (const f of [entry.term, ...(entry.aliases ?? [])]) stripped = stripped.split(normalizeTerm(f)).join(" ");
    for (const trap of entry.traps ?? []) {
      if (wordSpans(stripped, normalizeTerm(trap)).length) {
        issues.push({ term: entry.term, kind: "literal_trap", detail: `"${trap}" looks like a literal translation of "${entry.term}"` });
      }
    }
    if (!translated.description?.trim()) {
      issues.push({ term: entry.term, kind: "explanation_missing", detail: `No explanation was added for "${entry.term}"` });
    }
  }
  return issues;
}

/** Shape validation for an owner-entered glossary entry. Returns a cleaned entry or an error string. */
export function cleanGlossaryInput(input: { term: string; aliases?: string; explanation: string }): GlossaryEntry | string {
  const term = input.term.trim().replace(/\s+/g, " ");
  const explanation = input.explanation.trim().replace(/\s+/g, " ");
  if (term.length < 2 || term.length > 60) return "Dish name must be 2–60 characters.";
  if (explanation.length < 3 || explanation.length > 200) return "Explanation must be 3–200 characters.";
  const aliases = (input.aliases ?? "")
    .split(",")
    .map((a) => a.trim().replace(/\s+/g, " "))
    .filter((a) => a.length >= 2 && a.length <= 60 && normalizeTerm(a) !== normalizeTerm(term))
    .slice(0, 8);
  return { term, explanation, ...(aliases.length ? { aliases } : {}) };
}
