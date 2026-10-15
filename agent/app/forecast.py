"""TabPFN demand forecast, anomaly check and 86-risk scoring.

The regressor is injected (``RegressorFactory``) so tests run without network or a token.
In production it is ``tabpfn_client.TabPFNRegressor`` (TabPFN served by Prior Labs).
"""

from __future__ import annotations

import math
import os
from datetime import date, timedelta
from typing import Any, Callable, Protocol

import numpy as np
import pandas as pd

from .features import CATEGORICAL, FEATURES, Encoded, bucket_name, future_frame

MAX_TRAIN_ROWS = 10_000  # keep requests small and inside TabPFN API limits
HOLDOUT_DAYS = 14
MIN_DAYS_FOR_ANOMALIES = 28
FORECAST_QUANTILES = [0.1, 0.5, 0.75, 0.9]
ANOMALY_QUANTILES = [0.05, 0.5, 0.95]


class Regressor(Protocol):
    def fit(self, X: Any, y: Any) -> Any: ...

    def predict(self, X: Any, output_type: str = "mean", quantiles: list[float] | None = None) -> Any: ...


RegressorFactory = Callable[[list[int]], Regressor]


class ForecasterNotConfigured(RuntimeError):
    pass


def tabpfn_token() -> str | None:
    return os.getenv("PRIORLABS_API_KEY") or os.getenv("TABPFN_TOKEN") or None


def tabpfn_factory(categorical: list[int]) -> Regressor:
    """Official Prior Labs client. Model: server default (latest), or TABPFN_MODEL_PATH."""
    token = tabpfn_token()
    if not token:
        raise ForecasterNotConfigured("PRIORLABS_API_KEY (or TABPFN_TOKEN) is not set on the agent.")
    import tabpfn_client  # imported lazily: heavy, and not needed for health checks/tests

    tabpfn_client.set_access_token(token)
    kwargs: dict[str, Any] = {"categorical_features_indices": categorical}
    if os.getenv("TABPFN_MODEL_PATH"):
        kwargs["model_path"] = os.environ["TABPFN_MODEL_PATH"]
    return tabpfn_client.TabPFNRegressor(**kwargs)


def forecaster_label() -> str:
    path = os.getenv("TABPFN_MODEL_PATH") or "server default (latest)"
    return f"TabPFN via tabpfn-client · model {path}"


def _quantiles(model: Regressor, X: pd.DataFrame, qs: list[float]) -> np.ndarray:
    """Returns array shape (len(qs), n_rows), clipped at 0."""
    out = model.predict(X, output_type="quantiles", quantiles=qs)
    arr = np.asarray([np.asarray(o, dtype=float) for o in out]) if isinstance(out, (list, tuple)) else np.asarray(out, dtype=float)
    if arr.ndim == 1:  # a regressor that only gives a point estimate
        arr = np.vstack([arr for _ in qs])
    if arr.shape[0] != len(qs) and arr.shape[1] == len(qs):
        arr = arr.T
    arr = np.maximum(arr, 0.0)
    return np.sort(arr, axis=0)  # guard against quantile crossing


def _train_slice(frame: pd.DataFrame) -> pd.DataFrame:
    """Most recent days that fit in MAX_TRAIN_ROWS."""
    if len(frame) <= MAX_TRAIN_ROWS:
        return frame
    per_day = max(1, len(frame) // frame["date"].nunique())
    keep_days = max(7, MAX_TRAIN_ROWS // per_day)
    cutoff = frame["date"].max() - timedelta(days=keep_days - 1)
    return frame[frame["date"] >= cutoff]


def fit(factory: RegressorFactory, frame: pd.DataFrame) -> Regressor:
    model = factory(CATEGORICAL)
    model.fit(frame[FEATURES], frame["qty"].to_numpy(dtype=float))
    return model


def forecast(enc: Encoded, start: date, horizon: int, holidays: list[date], factory: RegressorFactory) -> dict[str, Any]:
    train = _train_slice(enc.frame)
    model = fit(factory, train)
    fut = future_frame(enc, start, horizon, holidays)
    q = _quantiles(model, fut[FEATURES], FORECAST_QUANTILES)
    fut = fut.assign(low=q[0], median=q[1], p75=q[2], high=q[3])
    per_day = (
        fut.groupby(["date", "item"], as_index=False)[["low", "median", "p75", "high"]].sum()
        .merge(_peak_bucket(fut), on=["date", "item"], how="left")
    )
    rows = [
        {
            "date": r.date.isoformat(),
            "item": r.item,
            "category": enc.item_category.get(r.item, "Other"),
            "low": round(float(r.low), 1),
            "median": round(float(r.median), 1),
            "prep": int(math.ceil(float(r.p75) - 1e-9)),
            "high": round(float(r.high), 1),
            "peak_bucket": r.peak_bucket,
        }
        for r in per_day.itertuples(index=False)
    ]
    totals = fut.groupby("date", as_index=False)[["low", "median", "high"]].sum()
    daily = [{"date": r.date.isoformat(), "low": round(float(r.low), 1), "median": round(float(r.median), 1), "high": round(float(r.high), 1)} for r in totals.itertuples(index=False)]
    return {"forecast": rows, "daily_totals": daily, "training_rows": int(len(train))}


def _peak_bucket(fut: pd.DataFrame) -> pd.DataFrame:
    idx = fut.groupby(["date", "item"])["median"].idxmax()
    peak = fut.loc[idx, ["date", "item", "bucket", "median"]]
    peak = peak.assign(peak_bucket=[bucket_name(b) if m >= 1 else None for b, m in zip(peak["bucket"], peak["median"])])
    return peak[["date", "item", "peak_bucket"]]


def anomalies(enc: Encoded, factory: RegressorFactory, limit: int = 12) -> tuple[list[dict[str, Any]], str | None]:
    """Out-of-sample check: train on days before the last 14, flag holdout days outside the 5–95% band."""
    n_days = (enc.last_date - enc.first_date).days + 1
    if n_days < MIN_DAYS_FOR_ANOMALIES:
        return [], f"Anomaly check needs {MIN_DAYS_FOR_ANOMALIES}+ days of history (have {n_days})."
    cutoff = enc.last_date - timedelta(days=HOLDOUT_DAYS - 1)
    train = _train_slice(enc.frame[enc.frame["date"] < cutoff])
    hold = enc.frame[enc.frame["date"] >= cutoff]
    model = fit(factory, train)
    q = _quantiles(model, hold[FEATURES], ANOMALY_QUANTILES)
    hold = hold.assign(low=q[0], expected=q[1], high=q[2])
    found: list[dict[str, Any]] = []
    by_item = hold.groupby(["date", "item"], as_index=False)[["qty", "low", "expected", "high"]].sum()
    for r in by_item.itertuples(index=False):
        kind = _flag(r.qty, r.low, r.expected, r.high, min_abs=3.0)
        if kind:
            found.append(_anomaly(r.date, r.item, kind, r.qty, r.expected, r.low, r.high))
    by_day = hold.groupby("date", as_index=False)[["qty", "low", "expected", "high"]].sum()
    for r in by_day.itertuples(index=False):
        kind = _flag(r.qty, r.low, r.expected, r.high, min_abs=10.0)
        if kind:
            found.append(_anomaly(r.date, None, kind, r.qty, r.expected, r.low, r.high))
    found.sort(key=lambda a: abs(a["actual"] - a["expected"]) / max(1.0, a["expected"]), reverse=True)
    return found[:limit], None


def _flag(actual: float, low: float, expected: float, high: float, min_abs: float) -> str | None:
    gap = max(min_abs, 0.5 * expected)
    if actual > high and actual - expected >= gap:
        return "spike"
    if actual < low and expected - actual >= gap:
        return "drop"
    return None


def _anomaly(d: date, item: str | None, kind: str, actual: float, expected: float, low: float, high: float) -> dict[str, Any]:
    return {
        "date": d.isoformat(),
        "item": item,
        "kind": kind,
        "actual": round(float(actual), 1),
        "expected": round(float(expected), 1),
        "low": round(float(low), 1),
        "high": round(float(high), 1),
    }


def risk_items(enc: Encoded, forecast_rows: list[dict[str, Any]], limit: int = 8) -> list[dict[str, Any]]:
    """86 risk: the forecast's high end is well above what this dish usually sells on that weekday."""
    daily = enc.frame.groupby(["date", "item"], as_index=False)["qty"].sum()
    daily["weekday"] = pd.to_datetime(daily["date"]).dt.weekday
    out: list[dict[str, Any]] = []
    for f in forecast_rows:
        d = date.fromisoformat(f["date"])
        same = daily[(daily["item"] == f["item"]) & (daily["weekday"] == d.weekday())].sort_values("date").tail(4)
        usual = float(same["qty"].mean()) if len(same) else 0.0
        if usual <= 0:
            continue
        ratio = f["high"] / usual
        if ratio >= 1.3 and f["high"] - usual >= 3:
            out.append({"item": f["item"], "date": f["date"], "high": f["high"], "usual": round(usual, 1), "ratio": round(ratio, 2)})
    out.sort(key=lambda r: r["ratio"], reverse=True)
    seen: set[str] = set()
    unique = []
    for r in out:
        if r["item"] in seen:
            continue
        seen.add(r["item"])
        unique.append(r)
    return unique[:limit]
