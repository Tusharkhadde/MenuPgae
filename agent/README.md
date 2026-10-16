# MenuPage prep agent

A small FastAPI service that turns a restaurant's MenuPage order history into a kitchen prep plan:

1. **TabPFN** (Prior Labs' tabular foundation model, via the official [`tabpfn-client`](https://github.com/PriorLabs/tabpfn-client)) learns from the restaurant's own past orders — one row per day × dish × meal period with weekday, weekend, holiday, trend, dish, category and price as features — and predicts portions for the next 1–7 days as quantiles (10/50/75/90%).
2. The same model, trained only on the days **before** the last two weeks, checks those two weeks and flags days/dishes that fell outside the expected 5–95% band (spikes, drops, possible sell-outs).
3. **86 risk**: dishes whose high-case forecast is ≥ 1.3× what they usually sell on that weekday.
4. **Gemma** (open model, Google AI Studio or a local Ollama) writes the prep list wording. Quantities are always the forecast's numbers — the language model only writes the notes. Without an AI provider a plain template writes them and the response says `"source": "template"`.

5. **Backtest** (`POST /v1/backtest`, `backtest.py`): hide the last N days (default 14), forecast them with TabPFN trained only on the days before, and score against two naive baselines — *same weekday last week* and *4-week weekday mean* (both use training days only). MAE and WAPE per dish and overall.
6. **Festivals**: movable Indian festivals 2024–2027 (`app/data/festivals_in.json`, sources inside; shared with the Next.js app) become three features — festival day, days to the next festival (capped at 30), which festival is next.
7. **Ask the planner** (`POST /v1/ask`): Gemma turns "how much paneer for Saturday?" into one tool call `forecast_demand(dishes, start_date, end_date)` (validated: dishes must be on the menu, dates clamped to the next 7 days), TabPFN runs it, Gemma words the answer. Any number in Gemma's answer that is not one of TabPFN's numbers → the answer is replaced by a template built from the forecast. Without a language model, a small rule parser and the template do the job.
8. **Sentry Agent Tracing** (optional, `SENTRY_DSN`): see below.

No database, no state: MenuPage sends the history with each request.

## API

`GET /health` → `{status, tabpfn_configured, narrator, secret_configured, tracing}`

`POST /v1/prep-plan` with `Authorization: Bearer $AGENT_SECRET`

```json
{
  "restaurant": {"name": "Demo Café", "timezone": "Asia/Kolkata", "currency": "INR"},
  "history": [{"date": "2026-10-01", "hour": 17, "item": "Vada Pav", "category": "Snacks", "qty": 12, "price": 20}],
  "holidays": ["2026-10-02"],
  "start_date": "2026-10-16",
  "horizon_days": 3,
  "synthetic": false
}
```

Needs ≥ 7 days of history (MenuPage asks for 14+); the anomaly check needs ≥ 28 days.
`festivals` (`[{"date": "2026-11-08", "key": "diwali"}]`) is optional on every endpoint; omitted = the built-in calendar.

`POST /v1/backtest` — same body without `start_date`/`horizon_days`, plus `"holdout_days": 14` (7–28). Needs 14 training days before the holdout. Returns `overall`, `per_dish` (`mae`, `wape` for `tabpfn`, `last_week`, `weekday_mean_4w`) and `best_by_wape`.

`POST /v1/ask` — same body plus `"question": "How much paneer for Saturday?"` and `"today": "2026-10-16"` (restaurant-local). Returns `intent` (the tool call and which parser made it), `rows`/`totals` (TabPFN numbers), `answer`, `answer_source` (`gemma` | `template`) and `notes`.

## Backtest from the command line

```bash
npm run prep:export -- --synthetic --end 2026-10-15              # repo root → .data/history-synthetic.json (labelled SYNTHETIC)
npm run prep:export -- --restaurant <slug>                       # or real orders from DATABASE_URL
cd agent && PRIORLABS_API_KEY=... python backtest.py --input ../.data/history-synthetic.json \
    --json ../docs/results/backtest-synthetic.json --markdown ../docs/results/backtest-synthetic.md
```

Without a TabPFN key it exits with code 2 and writes nothing.

## Run locally

```bash
cd agent
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
export AGENT_SECRET=dev-secret PRIORLABS_API_KEY=...        # token from platform.priorlabs.ai
export AI_PROVIDER=ollama OLLAMA_MODEL=gemma3:4b             # optional: local Gemma via Ollama
uvicorn app.main:app --reload --port 8000
pytest                                                       # tests mock TabPFN — no token or network needed
```

Then in the Next.js app: `AGENT_URL=http://localhost:8000 AGENT_SECRET=dev-secret`.

## Environment

| Variable | Purpose |
| --- | --- |
| `AGENT_SECRET` | Required. Shared bearer secret; must equal `AGENT_SECRET` in the Next.js app |
| `PRIORLABS_API_KEY` (or `TABPFN_TOKEN`) | Required for forecasts. TabPFN API token |
| `TABPFN_MODEL_PATH` | Optional. Pin a TabPFN model; default is the server's latest |
| `AI_PROVIDER` | `google` (default when a key is set) or `ollama` |
| `GOOGLE_AI_API_KEY` (or `GEMINI_API_KEY`), `GEMMA_MODEL`, `GEMMA_FALLBACK_MODEL` | Gemma on Google AI Studio (default `gemma-3-27b-it`, one retry on `gemma-4-26b-a4b-it` if the id 404s) |
| `OLLAMA_BASE_URL` / `OPENAI_COMPAT_BASE_URL`, `OLLAMA_MODEL`, `OPENAI_COMPAT_API_KEY` | Local / self-hosted Gemma (default `gemma3:4b`) |
| `SENTRY_DSN` | Optional. Turns on Sentry tracing; unset = fully no-op |
| `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_ENVIRONMENT` | Optional (default sample rate `1.0`) |

## Sentry Agent Tracing

With `SENTRY_DSN` set, every request is a trace following Sentry's [manual AI agent instrumentation](https://docs.sentry.io/platforms/python/agent-tracing/manual-instrumentation/) conventions (`app/tracing.py`):

```
POST /v1/ask
└─ invoke_agent prep-planner          gen_ai.invoke_agent
   ├─ chat gemma-3-27b-it             gen_ai.chat   model, input/output tokens (if returned), latency_ms
   ├─ execute_tool forecast_demand    gen_ai.execute_tool
   │   ├─ tabpfn.fit                  ml.fit        rows, features, latency_ms
   │   └─ tabpfn.predict              ml.predict    rows, quantiles, latency_ms
   └─ chat gemma-3-27b-it             gen_ai.chat
```

`/v1/prep-plan` has the same shape (`forecast_demand`, `detect_anomalies`); `/v1/backtest` is one `ml.backtest` span. Prompts and answers are never attached. When the Next.js app also has `SENTRY_DSN`, its `prep-agent <task>` span and the agent's spans share one trace (Sentry propagates `sentry-trace`/`baggage` on the fetch).

## Deploy

`render.yaml` at the repo root deploys this folder to Render's free plan (health check `/health`). See `docs/HACKATHON.md`.

## Privacy

Order rows sent to TabPFN contain dates, hours, dish names, categories, quantities and prices — no customer names, phones or notes. TabPFN's API is a cloud service: Prior Labs processes the data on their servers.
