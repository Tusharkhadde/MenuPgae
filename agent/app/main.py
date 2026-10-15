"""MenuPage prep agent — FastAPI service.

POST /v1/prep-plan   Bearer AGENT_SECRET. Order history in -> TabPFN forecast, anomalies, 86 risk,
                     and a Gemma-written prep list out.
GET  /health         Liveness + which pieces are configured (no secrets).

Run locally:  uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import hmac
import logging
import os
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException

from . import __version__
from .features import encode_history
from .forecast import ForecasterNotConfigured, RegressorFactory, anomalies, forecast, forecaster_label, risk_items, tabpfn_factory, tabpfn_token
from .llm import load_config
from .narrator import narrate, prep_targets
from .schemas import PrepRequest

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("prep-agent")

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
    }


@app.post("/v1/prep-plan", dependencies=[Depends(require_secret)])
def prep_plan(req: PrepRequest, factory: RegressorFactory = Depends(get_factory)) -> dict:
    warnings: list[str] = []
    enc = encode_history(req.history, req.holidays)
    n_days = (enc.last_date - enc.first_date).days + 1
    if n_days < 7:
        raise HTTPException(422, f"Need at least 7 days of history (got {n_days}).")
    if req.start_date <= enc.last_date:
        warnings.append("start_date is not after the last history day; forecasting anyway.")
    try:
        fc = forecast(enc, req.start_date, req.horizon_days, req.holidays, factory)
        anom, note = anomalies(enc, factory)
    except ForecasterNotConfigured as err:
        raise HTTPException(503, str(err)) from err
    except HTTPException:
        raise
    except Exception as err:  # TabPFN API errors, quota, network
        log.exception("forecast failed")
        raise HTTPException(502, f"TabPFN forecast failed: {type(err).__name__}: {str(err)[:200]}") from err
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
