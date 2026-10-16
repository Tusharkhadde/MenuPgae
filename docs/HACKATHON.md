# MenuPage × open models — hackathon write-up kit

DEV / Hacktoberfest "Side Hustle" challenge: *build something with open-weight / open-source AI at its core that someone would pay for.*
Target categories: **Best Use of Gemma**, **Best Use of TabPFN (Prior Labs)**, **Best Use of Render**, plus the **Sentry Agent Tracing** partner prize.

MenuPage is a QR-menu + one-page-website SaaS for small Indian restaurants and food stalls (Pro placeholder price ₹299/month, see `src/config/plans.ts`). This branch puts two open models at the centre of the two Pro features owners would actually pay for:

| Feature | Open piece that makes it work | Where |
| --- | --- | --- |
| **Menu translation that doesn't butcher dish names** (+ menu-photo import) | **Gemma** (open weights) + a curated **dish glossary** | `src/lib/ai/*`, `src/lib/glossary/*`, Menu → Translations |
| **Prep planner**: "how many portions of each dish tomorrow?" + "86 risk" | **TabPFN** (tabular foundation model) for the numbers, **Gemma** for the wording | `agent/` (Python, on **Render**), Dashboard → Prep planner |
| **Forecast accuracy** (backtest vs naive baselines) | **TabPFN** | `agent/app/backtest.py`, Prep planner → Forecast accuracy (§7) |
| **Ask the planner**: "how much paneer for Saturday?" | **Gemma** tool call → **TabPFN** → Gemma wording | `agent/app/ask.py`, Prep planner → Ask the planner (§10) |
| **Festival-aware forecasts** (Diwali, Ganesh Chaturthi, Eid …) | features for **TabPFN** | `agent/app/data/festivals_in.json` (§9) |
| **Open vs closed scorecard** | Gemma vs Gemini, same key | `npm run eval:translate -- --scorecard` (§8) |
| **Agent tracing** | Sentry spans for Gemma + TabPFN calls | `agent/app/tracing.py`, `src/instrumentation.ts` (§11) |

> Nothing in this document is a measured result yet. Every number in the DEV post outline below is a placeholder to be filled from real runs (`npm run eval:translate`, a real restaurant's prep plan). No testimonials, user counts or metrics are invented anywhere in the repo.

---

## 1. Architecture

```
                        ┌──────────────────────────── Vercel (Hobby, $0) ────────────────────────────┐
 Owner's browser ──────▶│ Next.js 16 app (MenuPage)                                                  │
                        │  • Translations → src/server/ai.ts → src/lib/ai (provider layer)            │
                        │        AI_PROVIDER=google ─▶ Gemma on Google AI Studio (gemma-3-27b-it)     │
                        │        AI_PROVIDER=ollama ─▶ Ollama / any OpenAI-compatible server (gemma3) │
                        │     prompt = rules + only the glossary entries used in this batch           │
                        │     answer → robust JSON parse → glossary post-check → owner reviews        │
                        │  • Prep planner → src/server/prep.ts                                        │
                        │        orders (Neon) → (date, hour, dish, category, qty, price) rows        │
                        │        or SYNTHETIC demo rows generated from the menu (clearly labelled)    │
                        └──────────────┬─────────────────────────────────────────────────────────────┘
                                       │ POST /v1/prep-plan  (Bearer AGENT_SECRET)
                        ┌──────────────▼─────────────── Render (free web service) ───────────────────┐
                        │ agent/ FastAPI                                                              │
                        │  features: day × dish × meal period, weekday, weekend, holiday, trend,      │
                        │            dish, category, price (categorical columns flagged)              │
                        │  TabPFNRegressor (tabpfn-client) → quantiles 10/50/75/90 for 1–7 days       │
                        │  out-of-sample anomaly check on the last 14 days (fit on the days before)   │
                        │  86 risk = high case ≥ 1.3× usual for that weekday                          │
                        │  Gemma writes summary + notes; quantities re-attached from the forecast     │
                        └─────────────────────────────────────────────────────────────────────────────┘
```

Key design choices:

- **Gemma on AI Studio has no JSON mode or system instruction**, so every prompt is a single self-contained user turn that spells out the output contract, and `parseModelJson` (`src/lib/ai/json.ts`, mirrored in `agent/app/llm.py`) strips fences, finds the first balanced `{…}` (string-aware), and tolerates trailing commas.
- **Model ids move.** Default `gemma-3-27b-it` (override `GEMMA_MODEL`). Google's "Gemma on the Gemini API" page (checked Oct 2026) lists Gemma 4 ids (`gemma-4-31b-it`, `gemma-4-26b-a4b-it`); if the configured id returns 404 the client retries once with `GEMMA_FALLBACK_MODEL` (default `gemma-4-26b-a4b-it`, `none` to disable) and logs it.
- **Menu photo import** uses the same provider with Gemma's vision input (`inline_data` on Google, `image_url` data URL on Ollama; `GEMMA_VISION_MODEL` / `OLLAMA_VISION_MODEL` to use a different model).
- **The language model never produces the numbers** in the prep plan. TabPFN does; Gemma only writes words, and the agent overwrites any quantity Gemma returns (`agent/app/narrator.py`, tested).

### Dish glossary

- `src/lib/glossary/dishes.ts`: 70 curated entries (misal pav, vada pav, poha, paneer tikka, dal makhani, thali, …) — protected name, common spellings, one-line explanation, optional literal-translation "traps" (e.g. *Bombay Duck* is a fish).
- Per-restaurant entries: table `glossary_entries` (migration `drizzle/0002_glossary.sql`), edited at **Menu → Translations → Dish glossary**; they override built-ins by name.
- Prompting: only the entries that appear in the batch are sent. Latin-script targets keep the name as-is; other scripts get a transliteration **plus the Latin name in brackets** (so guests can say it to staff — and so it's machine-checkable).
- Post-check (`checkTranslation`): flags `name_not_kept` (literal translation), `literal_trap`, and soft `explanation_missing`. Flagged rows are highlighted in the translations editor; nothing is saved until the owner reviews.

### Eval (for honest numbers)

`scripts/eval-translate.ts` translates 21 real-style menu entries and scores glossary-name preservation per model and language:

```bash
GOOGLE_AI_API_KEY=... npm run eval:translate -- --langs hi,mr,fr,ar --baseline            # glossary vs no-glossary
GOOGLE_AI_API_KEY=... npm run eval:translate -- --models gemma-3-27b-it,gemma-3-12b-it
AI_PROVIDER=ollama OLLAMA_MODEL=gemma3:4b npm run eval:translate -- --json eval-local.json
npm run eval:translate -- --dry-run                                                       # see the prompt, call nothing
```

It prints a markdown table (parsed?, entries returned, names kept, literal traps, explanations added, latency). It exits without results if no provider is configured — it never fabricates.

---

## 2. Why open models (the business case)

- **Cost at a ₹299/month price point.** A small restaurant translates its menu a handful of times and runs a prep plan at most daily. Gemma is available on Google AI Studio's free tier and runs locally via Ollama at zero marginal cost; there is no per-seat AI bill that eats the margin. (Check current free-tier limits at <https://ai.google.dev/pricing> before quoting them.)
- **Local / offline.** `AI_PROVIDER=ollama` + `gemma3:4b` runs translation and photo import on a laptop with no cloud and no key — useful for a self-hosted install or a café with patchy internet.
- **Glossary + model swap.** The domain knowledge (what "misal" is) lives in an editable glossary, not in a proprietary model. Swapping `gemma-3-27b-it` → `gemma-3-12b-it` → a local `gemma3:4b` is one env var, and the eval script shows what each swap costs in quality.
- **No lock-in.** The provider layer speaks the generic Google `generateContent` and OpenAI-compatible chat APIs; anything that serves Gemma (Ollama, LM Studio, llama.cpp, vLLM) works.
- **TabPFN fits restaurant data.** Restaurants have small tables (weeks of orders × a few dozen dishes). A tabular foundation model predicts from that without per-restaurant training pipelines or tuning.

### TabPFN licensing — read before charging money

- The `tabpfn-client` code is Apache-2.0. The hosted API is used under Prior Labs' terms; Prior Labs' docs say moving from testing to production needs "a commercial license or API agreement" (<https://docs.priorlabs.ai/models>). Their pricing page lists a free tier for **non-commercial** use (<https://priorlabs.ai/pricing>).
- TabPFN-2.5 / 2.6 / 3 / 3.5 **weights** are under non-commercial licenses; **TabPFNv2** weights are under the Prior Labs License (Apache-2.0 with an attribution requirement) and support up to 10,000 training rows — the agent already caps training at 10,000 rows. Self-hosting v2 is the fully open, commercially usable route (not built in this PR).
- So: the hackathon demo on a free key is fine; **before charging restaurants for the prep planner, confirm the API terms with Prior Labs or self-host TabPFNv2.**

---

## 3. Setup

### Google AI Studio (Gemma)
1. <https://aistudio.google.com/apikey> → Create API key.
2. Vercel → Settings → Environment Variables: `GOOGLE_AI_API_KEY=<key>` (old `GEMINI_API_KEY` still works). Optional `GEMMA_MODEL` (default `gemma-3-27b-it`).
3. Redeploy. Pro restaurants now see **Draft with AI** in Menu → Translations and **Read a menu photo** in Menu → Import.

### Local, no cloud (Ollama)
```bash
ollama pull gemma3:4b          # vision-capable Gemma 3
AI_PROVIDER=ollama OLLAMA_BASE_URL=http://localhost:11434 npm run dev
```
(Any OpenAI-compatible server: `OPENAI_COMPAT_BASE_URL=http://host:port/v1`, optional `OPENAI_COMPAT_API_KEY`.) A Vercel deployment can't reach `localhost`; this mode is for local dev and self-hosting.

### Prior Labs (TabPFN)
1. Sign up at <https://platform.priorlabs.ai>, accept the terms, and create a key at <https://platform.priorlabs.ai/account/api-keys>.
2. It goes on the **agent** (Render), not on Vercel: `PRIORLABS_API_KEY=<token>` (`TABPFN_TOKEN` also works). Optional `TABPFN_MODEL_PATH` to pin a model (default: the server's latest) — see <https://docs.priorlabs.ai/models/selecting-model-version>.

### Render (the agent)
1. Render dashboard → **New → Blueprint** → select this repo. `render.yaml` creates `menupage-prep-agent` (Python, **free** plan, region Singapore, root `agent/`, health check `/health`).
2. When prompted, paste `PRIORLABS_API_KEY` and (optional) `GOOGLE_AI_API_KEY`. `AGENT_SECRET` is generated — copy it from the service's Environment tab.
3. Open `https://<service>.onrender.com/health` → `"status": "ok"`, `"tabpfn_configured": true`.
4. Vercel: set `AGENT_URL=https://<service>.onrender.com` and `AGENT_SECRET=<same value>`, redeploy.
5. Free instances sleep after inactivity; the first prep plan after a nap can take about a minute (the page says so). The Next.js app stays on Vercel ($0 hosting rule).

### Try it without real orders
Dashboard → a restaurant → **Prep planner** → Data: *Synthetic demo data*. The history is generated from that restaurant's own menu (weekend lift, meal-time profiles, a holiday bump, one injected spike and one sell-out) and every screen labels it as synthetic. Demo sandbox accounts can run it on synthetic data; real-order forecasts are Pro.

---

## 4. Draft DEV post outline

**Title idea:** "I taught an open model what *misal pav* is — and built a prep planner for ₹299/month restaurants"

1. **Hook** — the problem: small Indian restaurants, QR menus, guests from elsewhere; machine translation turns *Vada Pav* into "potato bread burger"; owners over- or under-prep every weekend.
   - _[FIRST-USER STORY: real restaurant/vendor, with their permission — what they said, what changed. Leave out until it exists.]_
2. **What I built** — MenuPage (link), the two Pro features, 60-second demo GIF _[record]_.
3. **Gemma at the core**
   - Provider layer: Google AI Studio ↔ Ollama with one env var; no JSON mode → robust parser.
   - Dish glossary + post-check; screenshot of a flagged literal translation _[screenshot]_.
   - Eval results — paste the real table from `npm run eval:translate -- --baseline`:
     - Names kept with glossary: _[X/Y per language]_ vs without: _[X/Y]_
     - Local `gemma3:4b` vs hosted `gemma-3-27b-it`: _[numbers]_
     - Honest failure cases: _[list from the script output]_
4. **TabPFN at the core**
   - Why a tabular foundation model fits tiny restaurant datasets; features used.
   - Quantile forecast → prep = 75th percentile; out-of-sample anomaly check; 86 risk.
   - Screenshot of a prep plan _[label synthetic if it is]_; real-data run _[only if a restaurant agrees]_.
5. **Render** — `render.yaml`, free plan, health check, cold-start trade-off and why the web app stays on Vercel.
6. **Why open = a viable business** — cost at ₹299, offline mode, no lock-in, licensing caveat for TabPFN (section 2).
7. **Proof, not vibes** — forecast accuracy table (§7), open vs closed scorecard (§8), Sentry trace screenshot (§11). _[paste real outputs only]_
8. **What's next** — owner-entered local festivals/events, stock levels for real 86 alerts, self-hosted TabPFNv2.
9. **Links** — repo, demo `/r/demo`, docs.

---

## 5. What is and isn't verified

- Unit tests mock every model call (Vitest for the app, pytest for the agent). No live Google AI Studio, Gemini, Ollama, Prior Labs or Sentry call was made while building any of this; run the commands in §6 with your keys before publishing numbers.
- The Gemma/Gemini model ids, prices and TabPFN terms in this document were checked against the vendors' pages in October 2026 and can change.
- Festival dates were checked against timeanddate.com on 2026-10-16; Eid 2027 dates are tentative.

---

## 6. Getting the real numbers (run these before writing the post)

```bash
# 0) keys (never commit them)
export GOOGLE_AI_API_KEY=...            # Gemma + the Gemini baseline
export PRIORLABS_API_KEY=...            # TabPFN

# 1) Open vs closed translation scorecard → docs/results/translate-scorecard.md
npm run eval:translate -- --scorecard --langs hi,mr,fr,ar

# 2) Forecast backtest on the labelled synthetic demo → docs/results/backtest-synthetic.{md,json}
npm run prep:export -- --synthetic --end 2026-10-15
cd agent && pip install -r requirements.txt && python backtest.py --input ../.data/history-synthetic.json \
  --markdown ../docs/results/backtest-synthetic.md --json ../docs/results/backtest-synthetic.json && cd ..

# 3) Same backtest on a real restaurant (only with the owner's OK; keep the export private)
npm run prep:export -- --restaurant <slug>        # needs DATABASE_URL
cd agent && python backtest.py --input ../.data/history-<slug>.json && cd ..

# 4) In the app: Prep planner → "Ask the planner" and "Run backtest" (agent deployed on Render), with SENTRY_DSN set for §11.
```

---

## 7. Forecast accuracy (TabPFN backtest)

**What it does.** The agent hides the last 14 days, trains TabPFN only on the days before, forecasts the hidden days, and compares the **median** forecast with what was actually sold — per dish and day (meal periods summed). Two baselines an owner would actually use, both computed only from the training days so nobody peeks:

- **Same weekday last week** — "we sold 40 last Saturday".
- **4-week weekday mean** — average of the last four same weekdays.

Metrics: **MAE** (portions per dish-day) and **WAPE** (total absolute error ÷ total sold; undefined, shown "—", when nothing was sold). Code: `agent/app/backtest.py`; API `POST /v1/backtest`; CLI `agent/backtest.py`; UI card *Forecast accuracy* (needs 28+ days of orders, or the synthetic demo — labelled).

**Results** _[paste `docs/results/backtest-synthetic.md` and, if a restaurant agrees, the real one — do not round or edit]_

| Method | MAE | WAPE |
| --- | --- | --- |
| TabPFN (median) | _[X]_ | _[X%]_ |
| Same weekday last week | _[X]_ | _[X%]_ |
| 4-week weekday mean | _[X]_ | _[X%]_ |

Honest caveats to keep in the post: synthetic data is generated with weekday/holiday patterns the model can learn, so it flatters every method; one 14-day window is a single sample.

---

## 8. Open vs closed: translation scorecard

`npm run eval:translate -- --scorecard` runs the same 21 menu entries per language through:

1. **Gemma + dish glossary** (the product),
2. **Gemma without the glossary**,
3. **Closed baseline: Gemini** — `GEMINI_BASELINE_MODEL`, default `gemini-3.5-flash-lite`, same `GOOGLE_AI_API_KEY`, no glossary (`--closed-glossary` adds a Gemini + glossary row).

Columns: dish names kept (scored against the full glossary for every row), literal traps, explanations, **latency per menu** (one request = one whole menu), tokens, and **estimated cost per menu**. Cost = tokens (provider-reported; marked *est.* when we fell back to chars/4) × rates in `src/lib/ai/scorecard.ts`: Gemma on AI Studio is free-tier only ($0; local Ollama hardware not modelled), `gemini-3.5-flash-lite` is $0.30 in / $2.50 out per 1M tokens (<https://ai.google.dev/gemini-api/docs/pricing>, checked 2026-10-16). Override with `--rate model=in/out`. The markdown file is written to `docs/results/` only if at least one call succeeded.

**Results** _[paste `docs/results/translate-scorecard.md`]_

| Model | Names kept | Latency / menu | Est. cost / menu |
| --- | --- | --- | --- |
| Gemma + glossary | _[X/Y]_ | _[Xs]_ | _[$X]_ |
| Gemma, no glossary | _[X/Y]_ | _[Xs]_ | _[$X]_ |
| Gemini (closed) | _[X/Y]_ | _[Xs]_ | _[$X]_ |

---

## 9. Festival-aware forecasts

- `agent/app/data/festivals_in.json`: Holi, Eid al-Fitr, Eid al-Adha, Ganesh Chaturthi, Navratri (first day), Dussehra, Diwali and Christmas for 2024–2027, with sources (timeanddate.com India holiday lists per year; Diwali cross-checked with drikpanchang). One file, read by the agent and imported by the app (`src/lib/prep/festivals.ts`).
- Features per day on both sides: `festival` (0/1), `days_to_festival` (0–30, capped), `next_festival` (categorical). The app sends the festivals in the window with every request (`festivals: [{date, key}]`); the agent falls back to its built-in copy.
- The synthetic demo now bumps festival days too, so the feature has something to learn in demos (still labelled synthetic).
- Caveats: regional observance can differ by a day (e.g. Diwali 2024: Oct 31 national, Nov 1 in Maharashtra); Eid 2027 is tentative.

---

## 10. Ask the planner (Gemma tool call → TabPFN)

Owner types *"how much paneer for Saturday?"*:

1. **Gemma → tool call.** Prompt = the menu + a calendar of the next 7 days (so the model never does date maths). Output: `{"tool": "forecast_demand", "arguments": {"dishes": [...], "start_date": "...", "end_date": "..."}}`. Validated in code: unknown dishes dropped and reported, ingredient words ("paneer") expand to every dish containing them, dates clamped to tomorrow…+6.
2. **TabPFN** runs the forecast for those dishes/days.
3. **Gemma words the answer** from the forecast facts. Every number in the answer must be one of TabPFN's numbers (or a date / a number from the question or a dish name); otherwise the answer is replaced by a template built from the forecast. The table under the answer always shows TabPFN's numbers.

No AI provider? A rule parser handles the intent and the template writes the answer — the UI says which was used. Rate limit: 20 questions per user per hour (`src/server/actions/prep.ts`); questions are capped at 300 characters.

_[screenshot: question, answer, tool-call line, table]_

---

## 11. Sentry Agent Tracing

Optional and fully no-op without `SENTRY_DSN` (tested on both sides).

- **Agent (Python, Render):** `sentry-sdk` with manual AI-agent spans (`agent/app/tracing.py`): `invoke_agent prep-planner` → `chat <gemma model>` (model, input/output tokens when Google/Ollama return them, latency) → `execute_tool forecast_demand` → `tabpfn.fit` / `tabpfn.predict` (rows, latency). Prompts and answers are not attached.
- **App (Next.js, Vercel):** minimal `@sentry/nextjs` init in `src/instrumentation.ts` (Node runtime only, no client SDK, no source-map upload) and a `prep-agent <task>` span around each server action that calls the agent (`src/lib/observability.ts`). The fetch carries `sentry-trace`/`baggage`, so both halves form one trace.

**Capturing screenshots for the write-up**

1. Create a Sentry project (Python) → *Settings → Client Keys* → copy the DSN. Set `SENTRY_DSN` on Render (agent) and on Vercel (same DSN or a second Next.js project), redeploy both.
2. In MenuPage: Prep planner → ask *"How much paneer for Saturday?"*, then *Build prep plan*, then *Run backtest*.
3. Sentry → the **Agents** dashboard (Agent Tracing; under Insights in some Sentry versions): screenshot the agent run list and one trace showing `invoke_agent prep-planner` with its `chat` and `execute_tool` children; open a `chat` span and screenshot the model + token attributes.
4. Sentry → **Explore → Traces**: open the trace that starts at the Vercel `prep-agent ask` span and continues into the Render agent — screenshot the waterfall (shows Render cold start vs TabPFN vs Gemma time).
5. Blur the DSN/org slug if visible. Don't screenshot real customer data; use the synthetic demo.

_[screenshots: agents dashboard, trace waterfall, chat span attributes]_
