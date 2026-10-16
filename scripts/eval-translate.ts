/**
 * Glossary-preservation eval for menu translation.
 *
 * Translates ~20 real Indian dish entries with the configured open model and scores how often
 * protected dish names survive (not literally translated), whether literal "traps" appear, and
 * whether an explanation was added. Prints a table — paste the REAL numbers into docs/HACKATHON.md.
 *
 *   npx tsx scripts/eval-translate.ts                       # uses AI_PROVIDER / GOOGLE_AI_API_KEY / OLLAMA_* from env
 *   npx tsx scripts/eval-translate.ts --langs hi,fr,ar --models gemma-3-27b-it,gemma-3-12b-it
 *   npx tsx scripts/eval-translate.ts --baseline            # also run WITHOUT the glossary in the prompt, for comparison
 *   npx tsx scripts/eval-translate.ts --dry-run             # print the prompt, call nothing
 *   npx tsx scripts/eval-translate.ts --json eval.json      # also write raw results
 *
 *   # Open vs closed scorecard: Gemma + glossary, Gemma without glossary, and a closed baseline
 *   # (Gemini, GEMINI_BASELINE_MODEL, default gemini-3.5-flash-lite) on the same GOOGLE_AI_API_KEY.
 *   # Writes docs/results/translate-scorecard.md (only when at least one model call succeeded).
 *   npx tsx scripts/eval-translate.ts --scorecard --langs hi,mr,fr,ar
 *   npx tsx scripts/eval-translate.ts --scorecard --closed-glossary   # also give Gemini the glossary
 *   npx tsx scripts/eval-translate.ts --scorecard --rate gemini-3.5-flash-lite=0.3/2.5 --md docs/results/x.md
 *
 * Cost per menu is an ESTIMATE from token counts (provider-reported, else ≈chars/4) × the rates in
 * src/lib/ai/scorecard.ts. Nothing here is invented: if no provider is configured the script exits
 * without results, and failed calls are reported as failed.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveAiConfig, describeAiConfig, aiConfigProblem, type AiConfig, type AiEnv } from "../src/lib/ai/config";
import { createAiClient } from "../src/lib/ai/client";
import { parseModelJson } from "../src/lib/ai/json";
import { buildTranslatePrompt, finalizeTranslations, type TranslateInput } from "../src/lib/ai/translate";
import { DISH_GLOSSARY, findGlossaryMatches } from "../src/lib/glossary";
import {
  COST_RATES,
  DEFAULT_GEMINI_BASELINE_MODEL,
  estimateCostUsd,
  estimateTokens,
  formatUsd,
  markdownTable,
  parseRateOverride,
  rateFor,
  type CostRate,
} from "../src/lib/ai/scorecard";

/** Menu entries as Indian cafés commonly write them. */
export const FIXTURES: TranslateInput[] = [
  { id: "f01", name: "Misal Pav", description: "Kolhapuri style, extra tari on request." },
  { id: "f02", name: "Vada Pav", description: "With dry garlic chutney and fried green chilli." },
  { id: "f03", name: "Pav Bhaji", description: "Amul butter, chopped onion, lemon." },
  { id: "f04", name: "Kanda Poha", description: "Topped with sev and pomegranate." },
  { id: "f05", name: "Sabudana Khichdi", description: null },
  { id: "f06", name: "Thalipeeth", description: "Served with white butter and curd." },
  { id: "f07", name: "Masala Dosa", description: "With coconut chutney and sambar." },
  { id: "f08", name: "Idli Sambar", description: "Two idlis, one bowl of sambar." },
  { id: "f09", name: "Medu Vada", description: null },
  { id: "f10", name: "Paneer Tikka", description: "Six pieces, mint chutney." },
  { id: "f11", name: "Dal Makhani", description: "Slow-cooked overnight." },
  { id: "f12", name: "Butter Chicken", description: "Boneless, mild." },
  { id: "f13", name: "Chicken Biryani", description: "Hyderabadi dum style, with raita." },
  { id: "f14", name: "Maharashtrian Thali", description: "Two sabzi, dal, rice, three chapati, sweet." },
  { id: "f15", name: "Chole Bhature", description: null },
  { id: "f16", name: "Pani Puri", description: "Six puris, sweet and spicy water." },
  { id: "f17", name: "Bombay Duck Fry", description: "Rava coated, Malvani masala." },
  { id: "f18", name: "Gulab Jamun", description: "Two pieces, served warm." },
  { id: "f19", name: "Masala Chai", description: "Cutting or full cup." },
  { id: "f20", name: "Sol Kadhi", description: null },
  { id: "f21", name: "Jain Pav Bhaji", description: "No onion, no garlic, no potato." },
];

type Mode = "glossary" | "baseline";
type Row = {
  model: string;
  label: string;
  lang: string;
  mode: Mode;
  tokensIn: number;
  tokensOut: number;
  tokensEstimated: boolean;
  costUsd: number | null;
  ok: boolean;
  error?: string;
  latencyMs: number;
  protectedTotal: number;
  namesKept: number;
  traps: number;
  explanations: number;
  returned: number;
  failures: string[];
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function withModel(cfg: AiConfig, model: string | undefined): AiConfig {
  if (!model) return cfg;
  return cfg.provider === "google" ? { ...cfg, model, visionModel: model, fallbackModel: null } : { ...cfg, model, visionModel: model };
}

function argsAll(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]);
  });
  return out;
}

const rates: Record<string, CostRate> = { ...COST_RATES };

async function runOne(cfg: AiConfig, lang: string, mode: Mode, label = ""): Promise<Row> {
  const client = createAiClient(cfg);
  const promptGlossary = mode === "glossary" ? DISH_GLOSSARY : [];
  const prompt = buildTranslatePrompt(FIXTURES, lang, promptGlossary);
  const started = Date.now();
  const base: Row = {
    model: cfg.model,
    label: label || `${cfg.model} ${mode === "glossary" ? "+ glossary" : "(no glossary)"}`,
    lang,
    mode,
    tokensIn: 0,
    tokensOut: 0,
    tokensEstimated: false,
    costUsd: null,
    ok: false,
    latencyMs: 0,
    protectedTotal: 0,
    namesKept: 0,
    traps: 0,
    explanations: 0,
    returned: 0,
    failures: [],
  };
  for (const f of FIXTURES) base.protectedTotal += findGlossaryMatches(f.name, DISH_GLOSSARY).length;
  try {
    const text = await client.generateText({ prompt, temperature: 0.1, timeoutMs: 120_000 });
    base.latencyMs = Date.now() - started;
    const usage = client.lastUsage();
    base.tokensIn = usage?.inputTokens ?? estimateTokens(prompt);
    base.tokensOut = usage?.outputTokens ?? estimateTokens(text);
    base.tokensEstimated = !usage;
    base.costUsd = estimateCostUsd(client.lastModel(), { inputTokens: base.tokensIn, outputTokens: base.tokensOut }, rates);
    const raw = parseModelJson(text);
    // Always score against the full glossary, so baseline and glossary runs are comparable.
    const out = finalizeTranslations(FIXTURES, raw, DISH_GLOSSARY);
    base.ok = true;
    base.model = client.lastModel();
    for (const f of FIXTURES) {
      const t = out[f.id];
      const matches = findGlossaryMatches(f.name, DISH_GLOSSARY);
      if (!t) {
        if (matches.length) base.failures.push(`${f.name}: missing from output`);
        continue;
      }
      base.returned++;
      const issues = t.issues ?? [];
      for (const m of matches) {
        const mine = issues.filter((i) => i.term === m.entry.term);
        if (!mine.some((i) => i.kind === "name_not_kept")) base.namesKept++;
        else base.failures.push(`${f.name} → "${t.name}"`);
        if (mine.some((i) => i.kind === "literal_trap")) base.traps++;
        if (!mine.some((i) => i.kind === "explanation_missing")) base.explanations++;
      }
    }
  } catch (err) {
    base.latencyMs = Date.now() - started;
    base.error = err instanceof Error ? err.message : String(err);
  }
  return base;
}

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(0)}%` : "—");

async function main() {
  const langs = (arg("langs") ?? "hi,mr,fr,ar").split(",").map((s) => s.trim()).filter(Boolean);
  if (flag("dry-run")) {
    console.log(buildTranslatePrompt(FIXTURES, langs[0], DISH_GLOSSARY));
    return;
  }
  const problem = aiConfigProblem(process.env as AiEnv);
  const cfg = resolveAiConfig(process.env as AiEnv);
  if (problem || !cfg) {
    console.error(`No AI provider configured: ${problem}\nSet GOOGLE_AI_API_KEY (Gemma on Google AI Studio) or AI_PROVIDER=ollama. No results were produced.`);
    process.exit(2);
  }
  for (const spec of argsAll("rate")) {
    const parsed = parseRateOverride(spec);
    if (!parsed) {
      console.error(`Bad --rate "${spec}" (expected model=input/output USD per 1M tokens)`);
      process.exit(2);
    }
    rates[parsed[0]] = parsed[1];
  }
  const models = (arg("models") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const scorecard = flag("scorecard");
  const modes: Mode[] = flag("baseline") || scorecard ? ["glossary", "baseline"] : ["glossary"];
  const rows: Row[] = [];
  console.log(`Provider: ${describeAiConfig(cfg)} · ${FIXTURES.length} fixtures · languages ${langs.join(", ")}\n`);
  for (const m of models.length ? models : [undefined]) {
    const c = withModel(cfg, m);
    for (const lang of langs) {
      for (const mode of modes) {
        process.stdout.write(`… ${c.model} ${lang} ${mode}\r`);
        rows.push(await runOne(c, lang, mode, `${c.model} (open) ${mode === "glossary" ? "+ glossary" : "no glossary"}`));
      }
    }
  }
  // Closed baseline: Gemini on the same Google AI Studio key.
  let closedNote = "";
  if (scorecard) {
    const closedModel = process.env.GEMINI_BASELINE_MODEL?.trim() || DEFAULT_GEMINI_BASELINE_MODEL;
    if (cfg.provider !== "google") {
      closedNote = `Closed baseline skipped: it needs GOOGLE_AI_API_KEY (provider is ${cfg.provider}).`;
    } else {
      const closed: AiConfig = { ...cfg, model: closedModel, visionModel: closedModel, fallbackModel: null };
      const closedModes: Mode[] = flag("closed-glossary") ? ["baseline", "glossary"] : ["baseline"];
      for (const lang of langs) {
        for (const mode of closedModes) {
          process.stdout.write(`… ${closedModel} ${lang} ${mode}\r`);
          rows.push(await runOne(closed, lang, mode, `${closedModel} (closed) ${mode === "glossary" ? "+ glossary" : "no glossary"}`));
        }
      }
    }
  }
  const header = ["model", "lang", "parsed", "entries", "names kept", "literal traps", "explained", "latency / menu", "tokens in/out", "est. cost / menu"];
  const table = rows.map((r) => [
    r.label,
    r.lang,
    r.ok ? "yes" : "NO",
    `${r.returned}/${FIXTURES.length}`,
    r.ok ? `${r.namesKept}/${r.protectedTotal} (${pct(r.namesKept, r.protectedTotal)})` : "—",
    r.ok ? String(r.traps) : "—",
    r.ok ? `${r.explanations}/${r.protectedTotal} (${pct(r.explanations, r.protectedTotal)})` : "—",
    `${(r.latencyMs / 1000).toFixed(1)}s`,
    r.ok ? `${r.tokensIn}/${r.tokensOut}${r.tokensEstimated ? " (est.)" : ""}` : "—",
    r.ok ? formatUsd(r.costUsd) : "—",
  ]);
  const md = markdownTable(header, table);
  console.log(md);
  if (closedNote) console.log(`\n${closedNote}`);
  for (const r of rows) {
    if (r.error) console.log(`\n${r.model} ${r.lang} ${r.mode}: ERROR ${r.error}`);
    else if (r.failures.length) console.log(`\n${r.model} ${r.lang} ${r.mode} — names not kept:\n  ${r.failures.join("\n  ")}`);
  }
  if (scorecard && rows.some((r) => r.ok)) {
    const file = arg("md") ?? path.join("docs", "results", "translate-scorecard.md");
    mkdirSync(path.dirname(file), { recursive: true });
    const usedRates = [...new Set(rows.map((r) => r.model))].map((m) => {
      const rt = rateFor(m, rates);
      return `- \`${m}\`: ${rt ? `$${rt.inputPer1M} in / $${rt.outputPer1M} out per 1M tokens — ${rt.note}` : "no rate configured (cost n/a)"}`;
    });
    writeFileSync(
      file,
      [
        "# Menu translation scorecard: open vs closed",
        "",
        `Run ${new Date().toISOString()} with \`scripts/eval-translate.ts --scorecard\` · ${FIXTURES.length} menu entries per language · scored against the full dish glossary.`,
        "",
        md,
        "",
        "Latency is one whole menu (all entries in one request). **Cost per menu is an estimate**: tokens (provider-reported unless marked est.) × the rates below (`src/lib/ai/scorecard.ts`, source: https://ai.google.dev/gemini-api/docs/pricing).",
        "",
        ...usedRates,
        ...(closedNote ? ["", closedNote] : []),
        "",
      ].join("\n"),
    );
    console.log(`\nWrote ${file}`);
  } else if (scorecard) {
    console.log("\nNo successful model call — docs/results was not written.");
  }
  const out = arg("json");
  if (out) {
    writeFileSync(out, JSON.stringify({ ranAt: new Date().toISOString(), fixtures: FIXTURES.length, rows }, null, 2));
    console.log(`\nWrote ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
