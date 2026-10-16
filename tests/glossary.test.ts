import { describe, expect, it, vi } from "vitest";
import { DISH_GLOSSARY, checkTranslation, cleanGlossaryInput, findGlossaryMatches, keepsProtectedName, mergeGlossary, normalizeTerm } from "@/lib/glossary";
import { buildTranslatePrompt, finalizeTranslations, glossaryForBatch, translateMenu } from "@/lib/ai/translate";
import { createAiClient } from "@/lib/ai/client";
import { resolveAiConfig } from "@/lib/ai/config";

describe("built-in dish glossary", () => {
  it("has ~60+ unique entries with explanations", () => {
    expect(DISH_GLOSSARY.length).toBeGreaterThanOrEqual(60);
    const keys = DISH_GLOSSARY.map((e) => normalizeTerm(e.term));
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of DISH_GLOSSARY) expect(e.explanation.length).toBeGreaterThan(5);
    for (const t of ["misal pav", "vada pav", "poha", "paneer tikka", "dal makhani", "thali"]) expect(keys).toContain(t);
  });
});

describe("findGlossaryMatches", () => {
  it("matches whole words, case/diacritic/hyphen-insensitive", () => {
    expect(findGlossaryMatches("Kolhapuri MISAL-PAV", DISH_GLOSSARY).map((m) => m.entry.term)).toEqual(["Misal Pav"]);
    expect(findGlossaryMatches("Paneer Tikka Masala", DISH_GLOSSARY).map((m) => m.entry.term)).toEqual(["Paneer Tikka"]);
    expect(findGlossaryMatches("Pohay", DISH_GLOSSARY)).toEqual([]);
  });
  it("prefers the longest match (Masala Dosa, not Dosa)", () => {
    expect(findGlossaryMatches("Mysore Masala Dosa", DISH_GLOSSARY).map((m) => m.entry.term)).toEqual(["Masala Dosa"]);
    expect(findGlossaryMatches("Plain Dosa", DISH_GLOSSARY).map((m) => m.entry.term)).toEqual(["Dosa"]);
  });
  it("finds several dishes and aliases", () => {
    const terms = findGlossaryMatches("Idli Sambhar with Golgappa", DISH_GLOSSARY).map((m) => m.entry.term).sort();
    expect(terms).toEqual(["Idli", "Pani Puri", "Sambar"]);
  });
});

describe("checkTranslation (post-check)", () => {
  const orig = { name: "Vada Pav", description: "With garlic chutney" };
  it("passes when the name is kept (Latin) or bracketed after a transliteration", () => {
    expect(checkTranslation(orig, { name: "Vada Pav", description: "Beignet de pomme de terre épicé dans un petit pain" }, DISH_GLOSSARY)).toEqual([]);
    expect(checkTranslation(orig, { name: "वडा पाव (Vada Pav)", description: "मसालेदार बटाटा वडा" }, DISH_GLOSSARY)).toEqual([]);
  });
  it("flags a literal translation", () => {
    const issues = checkTranslation(orig, { name: "Pain aux beignets", description: "x" }, DISH_GLOSSARY);
    expect(issues.map((i) => i.kind)).toEqual(["name_not_kept"]);
  });
  it("flags known literal traps (Bombay Duck is a fish)", () => {
    const issues = checkTranslation({ name: "Bombay Duck Fry", description: null }, { name: "Fried duck (Bombay Duck)", description: "Fish" }, DISH_GLOSSARY);
    expect(issues.map((i) => i.kind)).toEqual(["literal_trap"]);
  });
  it("soft-warns when no explanation was added", () => {
    expect(checkTranslation({ name: "Poha", description: null }, { name: "Poha", description: null }, DISH_GLOSSARY).map((i) => i.kind)).toEqual(["explanation_missing"]);
  });
  it("ignores dishes that aren't in the glossary", () => {
    expect(checkTranslation({ name: "Cold Coffee", description: null }, { name: "Café froid", description: null }, DISH_GLOSSARY)).toEqual([]);
  });
});

describe("restaurant glossary entries", () => {
  it("override built-ins by name and add new ones", () => {
    const merged = mergeGlossary([
      { term: "misal pav", explanation: "our Puneri misal, medium spicy" },
      { term: "Kothimbir Vadi", aliases: ["Kothimbir Wadi"], explanation: "steamed then fried coriander and gram-flour squares" },
    ]);
    expect(merged.length).toBe(DISH_GLOSSARY.length + 1);
    expect(findGlossaryMatches("Misal Pav", merged)[0].entry.explanation).toBe("our Puneri misal, medium spicy");
    expect(keepsProtectedName("Kothimbir Wadi", findGlossaryMatches("Kothimbir Vadi", merged)[0].entry)).toBe(true);
  });
  it("validates owner input", () => {
    expect(cleanGlossaryInput({ term: " Kothimbir   Vadi ", aliases: "Kothimbir Wadi, , kothimbir vadi", explanation: "coriander squares" })).toEqual({
      term: "Kothimbir Vadi",
      aliases: ["Kothimbir Wadi"],
      explanation: "coriander squares",
    });
    expect(cleanGlossaryInput({ term: "x", explanation: "something" })).toMatch(/2–60/);
    expect(cleanGlossaryInput({ term: "Usal", explanation: "" })).toMatch(/Explanation/);
  });
});

describe("translation prompt + finalize", () => {
  const texts = [
    { id: "a", name: "Misal Pav", description: "Extra tari on request" },
    { id: "b", name: "Cold Coffee", description: null },
  ];
  it("lists only the protected dishes in the batch, with script-specific rules", () => {
    expect(glossaryForBatch(texts, DISH_GLOSSARY).map((e) => e.term)).toEqual(["Misal Pav"]);
    const hi = buildTranslatePrompt(texts, "hi", DISH_GLOSSARY);
    expect(hi).toContain("Hindi");
    expect(hi).toContain("original Latin name in brackets");
    expect(hi).toContain("- Misal Pav (also: Misal) — spicy sprouted moth-bean curry");
    expect(hi).not.toContain("Vada Pav —");
    expect(buildTranslatePrompt(texts, "fr", DISH_GLOSSARY)).toContain("Keep the protected name exactly as written in Latin letters");
  });
  it("clamps output, drops unknown ids and attaches issues", () => {
    const out = finalizeTranslations(texts, { a: { name: "Pain épicé", description: "Curry" }, b: { name: "Café froid", description: null }, z: { name: "?" } }, DISH_GLOSSARY);
    expect(Object.keys(out)).toEqual(["a", "b"]);
    expect(out.a.issues?.[0].kind).toBe("name_not_kept");
    expect(out.b.issues).toBeUndefined();
  });
  it("translateMenu end-to-end with a mocked Gemma", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"a":{"name":"मिसळ पाव (Misal Pav)","description":"मसालेदार उसळ"},"b":{"name":"कोल्ड कॉफी","description":null}}' }] } }] }), { status: 200 }),
    );
    const ai = createAiClient(resolveAiConfig({ GOOGLE_AI_API_KEY: "k" })!, fetchMock);
    const out = await translateMenu(ai, texts, "mr", DISH_GLOSSARY);
    expect(out.a).toEqual({ name: "मिसळ पाव (Misal Pav)", description: "मसालेदार उसळ" });
    expect(out.b.name).toBe("कोल्ड कॉफी");
  });
});
