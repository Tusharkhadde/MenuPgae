# MenuPage prep agent

A small FastAPI service that turns a restaurant's MenuPage order history into a kitchen prep plan:

1. **TabPFN** (Prior Labs' tabular foundation model, via the official [`tabpfn-client`](https://github.com/PriorLabs/tabpfn-client)) learns from the restaurant's own past orders — one row per day × dish × meal period with weekday, weekend, holiday, trend, dish, category and price as features — and predicts portions for the next 1–7 days as quantiles (10/50/75/90%).
2. The same model, trained only on the days **before** the last two weeks, checks those two weeks and flags days/dishes that fell outside the expected 5–95% band (spikes, drops, possible sell-outs).
3. **86 risk**: dishes whose high-case forecast is ≥ 1.3× what they usually sell on that weekday.
4. **Gemma** (open model, Google AI Studio or a local Ollama) writes the prep list wording. Quantities are always the forecast's numbers — the language model only writes the notes. Without an AI provider a plain template writes them and the response says `"source": "template"`.

No database, no state: MenuPage sends the history with each request.

## API

`GET /health` → `{status, tabpfn_configured, narrator, secret_configured}`

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

## Deploy

`render.yaml` at the repo root deploys this folder to Render's free plan (health check `/health`). See `docs/HACKATHON.md`.

## Privacy

Order rows sent to TabPFN contain dates, hours, dish names, categories, quantities and prices — no customer names, phones or notes. TabPFN's API is a cloud service: Prior Labs processes the data on their servers.
