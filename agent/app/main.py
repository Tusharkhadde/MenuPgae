"""MenuPage prep agent — FastAPI service.

POST /v1/prep-plan   Bearer AGENT_SECRET. Order history in -> TabPFN forecast, anomalies, 86 risk,
                     and a Gemma-written prep list out.
POST /v1/backtest    Bearer AGENT_SECRET. Hold out the last N days; TabPFN vs naive baselines (MAE, WAPE).
POST /v1/ask         Bearer AGENT_SECRET. "How much paneer for Saturday?" -> Gemma tool call -> TabPFN -> answer.
GET  /health         Liveness + which pieces are configured (no secrets).

Optional Sentry tracing (SENTRY_DSN): see app/tracing.py.

Run locally:  uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import hmac
import logging
import os
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException

from . import __version__
from .ask import facts_for, parse_intent, word_answer
from .backtest import BacktestError, run_backtest
from .features import encode_history
from .forecast import ForecasterNotConfigured, RegressorFactory, anomalies, forecast, forecaster_label, risk_items, tabpfn_factory, tabpfn_token
from .llm import load_config
from .narrator import narrate, prep_targets
from .schemas import AskRequest, BacktestRequest, PrepRequest
from .tracing import agent_span, ai_span, init_sentry, tool_span
from .tracing import enabled as tracing_enabled

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("prep-agent")
init_sentry()

app = FastAPI(title="MenuPage prep agent", version=__version__)


def get_factory() -> RegressorFactory:
    """Overridden in tests with a fake regressor."""
    return tabpfn_factory


def require_secret(authorization: str | None = Header(default=None)) -> None:
    secret = os.getenv("AGENT_SECRET", "")
    if not secret:
        raise HTTPException(503, "AGENT_SECRET is not set on the agent.")
    token = (authorization or "").removeprefix("Bearer ").strip()
    if not hmac.compare_digest(token.encode(), secret.encode()):
        raise HTTPException(401, "Unauthorized")


@app.get("/health")
def health() -> dict:
    llm = load_config()
    return {
        "status": "ok",
        "version": __version__,
        "tabpfn_configured": bool(tabpfn_token()),
        "narrator": llm.label if llm else "template (no AI provider)",
        "secret_configured": bool(os.getenv("AGENT_SECRET")),
        "tracing": "sentry" if tracing_enabled() else "off",
    }


def _forecast_errors(err: Exception) -> HTTPException:
    if isinstance(err, ForecasterNotConfigured):
        return HTTPException(503, str(err))
    log.exception("forecast failed")
    return HTTPException(502, f"TabPFN forecast failed: {type(err).__name__}: {str(err)[:200]}")


@app.post("/v1/prep-plan", dependencies=[Depends(require_secret)])
def prep_plan(req: PrepRequest, factory: RegressorFactory = Depends(get_factory)) -> dict:
    with agent_span("prep-plan"):
        return _prep_plan(req, factory)


def _prep_plan(req: PrepRequest, factory: RegressorFactory) -> dict:
    warnings: list[str] = []
    enc = encode_history(req.history, req.holidays, req.festival_pairs())
    n_days = (enc.last_date - enc.first_date).days + 1
    if n_days < 7:
        raise HTTPException(422, f"Need at least 7 days of history (got {n_days}).")
    if req.start_date <= enc.last_date:
        warnings.append("start_date is not after the last history day; forecasting anyway.")
    try:
        with tool_span("forecast_demand"):
            fc = forecast(enc, req.start_date, req.horizon_days, req.holidays, factory)
        with tool_span("detect_anomalies"):
            anom, note = anomalies(enc, factory)
    except Exception as err:  # TabPFN API errors, quota, network, missing key
        raise _forecast_errors(err) from err
    if note:
        warnings.append(note)
    risks = risk_items(enc, fc["forecast"])
    first_day = req.start_date.isoformat()
    targets = prep_targets(fc["forecast"], first_day)
    prep, narrator_label = narrate(
        load_config(), req.restaurant.name, first_day, req.start_date in set(req.holidays), targets, risks, anom, req.synthetic
    )
    prep["date"] = first_day
    if narrator_label is None and load_config() is not None:
        warnings.append("Gemma was unavailable; the prep notes use a plain template.")
    if fc["training_rows"] < len(enc.frame):
        warnings.append(f"Trained on the most recent {fc['training_rows']} of {len(enc.frame)} rows (API size cap).")
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "synthetic": req.synthetic,
        "start_date": first_day,
        "horizon_days": req.horizon_days,
        "models": {"forecaster": forecaster_label(), "narrator": narrator_label or "template"},
        "data": {"days": n_days, "rows": len(req.history), "items": len(enc.items), "training_rows": fc["training_rows"]},
        "forecast": fc["forecast"],
        "daily_totals": fc["daily_totals"],
        "anomalies": anom,
        "risk": risks,
        "prep": prep,
        "warnings": warnings,
    }


@app.post("/v1/backtest", dependencies=[Depends(require_secret)])
def backtest(req: BacktestRequest, factory: RegressorFactory = Depends(get_factory)) -> dict:
    enc = encode_history(req.history, req.holidays, req.festival_pairs())
    try:
        with ai_span("ml.backtest", "backtest tabpfn vs naive", holdout_days=req.holdout_days, rows=len(req.history)):
            res = run_backtest(enc, factory, req.holdout_days)
    except BacktestError as err:
        raise HTTPException(422, str(err)) from err
    except Exception as err:
        raise _forecast_errors(err) from err
    return {"generated_at": datetime.now(timezone.utc).isoformat(), "synthetic": req.synthetic, **res}


@app.post("/v1/ask", dependencies=[Depends(require_secret)])
def ask(req: AskRequest, factory: RegressorFactory = Depends(get_factory)) -> dict:
    with agent_span("ask"):
        return _ask(req, factory)


def _ask(req: AskRequest, factory: RegressorFactory) -> dict:
    enc = encode_history(req.history, req.holidays, req.festival_pairs())
    n_days = (enc.last_date - enc.first_date).days + 1
    if n_days < 7:
        raise HTTPException(422, f"Need at least 7 days of history (got {n_days}).")
    cfg = load_config()
    intent = parse_intent(cfg, req.question, enc.items, req.today)
    dishes = intent.dishes or enc.items
    horizon = (intent.end - intent.start).days + 1
    rows: list[dict] = []
    if intent.dishes or not intent.unmatched:
        try:
            with tool_span("forecast_demand") as span:
                span.set_data("dishes", len(dishes))
                span.set_data("days", horizon)
                fc = forecast(enc, intent.start, horizon, req.holidays, factory)
        except Exception as err:
            raise _forecast_errors(err) from err
        keep = set(dishes)
        rows = [r for r in fc["forecast"] if r["item"] in keep]
    facts = facts_for(intent, rows, req.synthetic)
    answer, source = word_answer(cfg, req.question, facts, enc.items)
    totals: dict[str, dict] = {}
    for r in rows:
        t = totals.setdefault(r["item"], {"item": r["item"], "prep": 0, "median": 0.0, "low": 0.0, "high": 0.0})
        t["prep"] += r["prep"]
        for k in ("median", "low", "high"):
            t[k] = round(t[k] + r[k], 1)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "synthetic": req.synthetic,
        "question": req.question,
        "intent": intent.tool_call(),
        "rows": rows,
        "totals": sorted(totals.values(), key=lambda t: t["median"], reverse=True),
        "answer": answer,
        "answer_source": source,
        "models": {"forecaster": forecaster_label(), "language": cfg.label if cfg else "none (rule parser + template)"},
        "notes": intent.notes,
    }
