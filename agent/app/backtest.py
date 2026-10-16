"""Backtest: hold out the last N days, forecast them with TabPFN trained only on the days before,
and compare against two naive baselines a restaurant owner would otherwise use.

Baselines (both only look at training days, so nobody sees the holdout):
  last_week        same weekday, most recent occurrence before the holdout ("what we sold last Saturday")
  weekday_mean_4w  mean of the last 4 same-weekday days before the holdout

Metrics per dish and overall, on daily dish totals (all meal periods summed):
  MAE   mean absolute error, portions per dish-day
  WAPE  sum |actual - forecast| / sum actual   (None when nothing was sold)
TabPFN's point forecast is the median (50th percentile).
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import numpy as np
import pandas as pd

from .features import FEATURES, Encoded
from .forecast import RegressorFactory, _quantiles, _train_slice, fit, forecaster_label

MODELS = ["tabpfn", "last_week", "weekday_mean_4w"]
MODEL_LABELS = {
    "tabpfn": "TabPFN (median)",
    "last_week": "Same weekday last week",
    "weekday_mean_4w": "4-week weekday mean",
}
MIN_TRAIN_DAYS = 14


class BacktestError(ValueError):
    pass


def mae(actual: np.ndarray, forecast: np.ndarray) -> float:
    a, f = np.asarray(actual, dtype=float), np.asarray(forecast, dtype=float)
    return float(np.mean(np.abs(a - f))) if len(a) else 0.0


def wape(actual: np.ndarray, forecast: np.ndarray) -> float | None:
    a, f = np.asarray(actual, dtype=float), np.asarray(forecast, dtype=float)
    denom = float(np.sum(np.abs(a)))
    return None if denom == 0 else float(np.sum(np.abs(a - f)) / denom)


def naive_baselines(train_daily: pd.DataFrame, hold_days: list[date], items: list[str]) -> pd.DataFrame:
    """train_daily: columns date, item, qty (zero-filled daily totals). Returns date, item, last_week, weekday_mean_4w."""
    td = train_daily.copy()
    td["weekday"] = pd.to_datetime(td["date"]).dt.weekday
    rows = []
    for d in hold_days:
        wd = d.weekday()
        for item in items:
            same = td[(td["item"] == item) & (td["weekday"] == wd)].sort_values("date")
            last = float(same["qty"].iloc[-1]) if len(same) else 0.0
            mean4 = float(same["qty"].tail(4).mean()) if len(same) else 0.0
            rows.append((d, item, last, mean4))
    return pd.DataFrame(rows, columns=["date", "item", "last_week", "weekday_mean_4w"])


def score(table: pd.DataFrame) -> dict[str, Any]:
    """table: date, item, actual + one column per model. Returns overall + per-dish metrics."""

    def block(df: pd.DataFrame) -> dict[str, dict[str, float | None]]:
        return {m: {"mae": _r(mae(df["actual"], df[m])), "wape": _r(wape(df["actual"], df[m]), 4)} for m in MODELS}

    overall = block(table)
    per_dish = []
    for item, df in table.groupby("item"):
        per_dish.append({"item": item, "actual_total": _r(float(df["actual"].sum())), "days": int(len(df)), **block(df)})
    per_dish.sort(key=lambda r: r["actual_total"], reverse=True)
    ranked = [m for m in MODELS if overall[m]["wape"] is not None]
    best = min(ranked, key=lambda m: overall[m]["wape"]) if ranked else None
    return {"overall": overall, "per_dish": per_dish, "best_by_wape": best}


def run_backtest(enc: Encoded, factory: RegressorFactory, holdout_days: int = 14) -> dict[str, Any]:
    n_days = (enc.last_date - enc.first_date).days + 1
    if n_days - holdout_days < MIN_TRAIN_DAYS:
        raise BacktestError(f"Backtest needs at least {MIN_TRAIN_DAYS} training days before a {holdout_days}-day holdout (have {n_days} days).")
    cutoff = enc.last_date - timedelta(days=holdout_days - 1)
    train = _train_slice(enc.frame[enc.frame["date"] < cutoff])
    hold = enc.frame[enc.frame["date"] >= cutoff]
    model = fit(factory, train)
    q = _quantiles(model, hold[FEATURES], [0.5])
    hold = hold.assign(tabpfn=q[0])
    daily = hold.groupby(["date", "item"], as_index=False)[["qty", "tabpfn"]].sum().rename(columns={"qty": "actual"})
    train_daily = enc.frame[enc.frame["date"] < cutoff].groupby(["date", "item"], as_index=False)["qty"].sum()
    hold_days = sorted(set(daily["date"]))
    base = naive_baselines(train_daily, hold_days, enc.items)
    table = daily.merge(base, on=["date", "item"], how="left").fillna(0.0)
    result = score(table)
    return {
        "holdout_days": holdout_days,
        "holdout": {"start": cutoff.isoformat(), "end": enc.last_date.isoformat()},
        "train": {"days": int(train["date"].nunique()), "rows": int(len(train))},
        "dish_days": int(len(table)),
        "models": {m: MODEL_LABELS[m] for m in MODELS} | {"tabpfn_detail": forecaster_label()},
        **result,
    }


def to_markdown(res: dict[str, Any], top: int = 15, synthetic: bool = False) -> str:
    def fmt(v: float | None, pct: bool = False) -> str:
        if v is None:
            return "—"
        return f"{v * 100:.1f}%" if pct else f"{v:.2f}"

    lines = [
        f"Holdout {res['holdout']['start']} → {res['holdout']['end']} ({res['holdout_days']} days), "
        f"trained on {res['train']['days']} days / {res['train']['rows']} rows. "
        f"Data: {'SYNTHETIC demo (not real sales)' if synthetic else 'restaurant order history'}.",
        "",
        "| Model | MAE (portions/dish-day) | WAPE |",
        "| --- | --- | --- |",
    ]
    for m in MODELS:
        o = res["overall"][m]
        lines.append(f"| {MODEL_LABELS[m]} | {fmt(o['mae'])} | {fmt(o['wape'], True)} |")
    lines += ["", f"Best overall by WAPE: {MODEL_LABELS.get(res['best_by_wape'] or '', '—')}", ""]
    lines += ["| Dish | Sold in holdout | TabPFN WAPE | Last week WAPE | 4-wk mean WAPE |", "| --- | --- | --- | --- | --- |"]
    for d in res["per_dish"][:top]:
        lines.append(f"| {d['item']} | {d['actual_total']:.0f} | {fmt(d['tabpfn']['wape'], True)} | {fmt(d['last_week']['wape'], True)} | {fmt(d['weekday_mean_4w']['wape'], True)} |")
    return "\n".join(lines)


def _r(v: float | None, nd: int = 3) -> float | None:
    return None if v is None else round(float(v), nd)
