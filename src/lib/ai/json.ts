/**
 * Robust JSON extraction from model output.
 *
 * Gemma on the Google AI Studio API has no JSON mode (no responseMimeType) and
 * small local models (Ollama) often wrap answers in prose or ``` fences. We ask
 * for JSON in the prompt and then dig the first complete JSON object/array out
 * of whatever came back.
 */

export class ModelJsonError extends Error {
  constructor(message = "The AI answer couldn't be read as JSON.") {
    super(message);
    this.name = "ModelJsonError";
  }
}

/** Remove ``` / ```json fences, keeping what is inside the first fenced block if there is one. */
export function stripFences(text: string): string {
  const fenced = /```(?:json|JSON)?\s*\n?([\s\S]*?)```/.exec(text);
  if (fenced) return fenced[1].trim();
  return text.replace(/^\s*```(?:json|JSON)?/, "").replace(/```\s*$/, "").trim();
}

/**
 * Find the first balanced `{…}` (or `[…]` when `allowArray`) in the text, respecting
 * strings and escapes. Returns null if none closes.
 */
export function extractFirstJson(text: string, allowArray = false): string | null {
  const openers = allowArray ? ["{", "["] : ["{"];
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (openers.includes(text[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") {
      if (stack.pop() !== ch) return null;
      if (stack.length === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Remove trailing commas before } or ] (a common small-model slip), outside strings. */
function removeTrailingCommas(json: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      while (j < json.length && /\s/.test(json[j])) j++;
      if (json[j] === "}" || json[j] === "]") continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Parse a JSON object out of free-form model text.
 * Order: direct parse → fenced block → first balanced object → same with trailing commas removed.
 */
export function parseModelJson<T = unknown>(text: string, opts: { allowArray?: boolean } = {}): T {
  const candidates: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) throw new ModelJsonError("The AI returned an empty answer.");
  candidates.push(trimmed);
  const unfenced = stripFences(trimmed);
  if (unfenced !== trimmed) candidates.push(unfenced);
  const first = extractFirstJson(unfenced, opts.allowArray) ?? extractFirstJson(trimmed, opts.allowArray);
  if (first) candidates.push(first);
  for (const c of candidates) {
    for (const variant of [c, removeTrailingCommas(c)]) {
      try {
        const v = JSON.parse(variant) as unknown;
        if (v !== null && typeof v === "object" && (opts.allowArray || !Array.isArray(v))) return v as T;
      } catch {
        /* try next */
      }
    }
  }
  throw new ModelJsonError();
}
