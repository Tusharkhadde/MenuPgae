"""Feature engineering: MenuPage order rows -> a daily x dish x meal-period table for TabPFN."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Iterable

import numpy as np
import pandas as pd

from .festivals import builtin_festivals, festival_features
from .schemas import HistoryRow

BUCKETS = ["breakfast", "lunch", "snacks", "dinner"]

# Columns fed to TabPFN, in order. Codes are integers; CATEGORICAL marks which ones are categories.
FEATURES = [
    "weekday",
    "is_weekend",
    "holiday",
    "festival",
    "days_to_festival",
    "next_festival",
    "day_index",
    "day_of_month",
    "bucket",
    "item_code",
    "category_code",
    "price",
]
CATEGORICAL = [FEATURES.index(c) for c in ("weekday", "next_festival", "bucket", "item_code", "category_code")]

Festivals = list[tuple[date, str]]


def hour_bucket(hour: int) -> str:
    """Meal period for an hour of the day (restaurant-local)."""
    if 5 <= hour < 11:
        return "breakfast"
    if 11 <= hour < 15:
        return "lunch"
    if 15 <= hour < 19:
        return "snacks"
    return "dinner"


@dataclass
class Encoded:
    """Daily table plus the vocabularies needed to build matching future rows."""

    frame: pd.DataFrame  # one row per date x item x bucket, zero-filled, with FEATURES + qty
    items: list[str]
    item_category: dict[str, str]
    item_price: dict[str, float]
    combos: list[tuple[str, str]]  # (item, bucket) pairs ever sold
    first_date: date
    last_date: date
    festivals: Festivals | None = None  # (date, key); None = built-in calendar (data/festivals_in.json)


def _codes(values: Iterable[str]) -> dict[str, int]:
    return {v: i for i, v in enumerate(sorted(set(values)))}


def encode_history(history: list[HistoryRow], holidays: Iterable[date], festivals: Festivals | None = None) -> Encoded:
    hol = set(holidays)
    raw = pd.DataFrame(
        {
            "date": [r.date for r in history],
            "bucket": [hour_bucket(r.hour) for r in history],
            "item": [r.item.strip() for r in history],
            "category": [r.category.strip() or "Other" for r in history],
            "qty": [float(r.qty) for r in history],
            "price": [float(r.price) for r in history],
        }
    )
    agg = raw.groupby(["date", "item", "bucket"], as_index=False)["qty"].sum()
    # Latest category/price seen for each dish.
    latest = raw.sort_values("date").groupby("item").last()
    item_category = latest["category"].to_dict()
    item_price = latest["price"].to_dict()
    combos = sorted({(i, b) for i, b in zip(agg["item"], agg["bucket"])})
    first, last = min(raw["date"]), max(raw["date"])
    days = [first + timedelta(days=i) for i in range((last - first).days + 1)]
    grid = pd.DataFrame(
        [(d, i, b) for d in days for (i, b) in combos],
        columns=["date", "item", "bucket"],
    )
    frame = grid.merge(agg, on=["date", "item", "bucket"], how="left").fillna({"qty": 0.0})
    items = sorted(item_category)
    enc = Encoded(
        frame=frame, items=items, item_category=item_category, item_price=item_price, combos=combos, first_date=first, last_date=last, festivals=festivals
    )
    enc.frame = add_features(frame, enc, hol)
    return enc


def add_features(frame: pd.DataFrame, enc: Encoded, holidays: set[date]) -> pd.DataFrame:
    item_codes = _codes(enc.items)
    cat_codes = _codes(enc.item_category.values())
    bucket_codes = {b: i for i, b in enumerate(BUCKETS)}
    out = frame.copy()
    dates = pd.to_datetime(out["date"])
    out["weekday"] = dates.dt.weekday.astype(int)
    out["is_weekend"] = (out["weekday"] >= 5).astype(int)
    out["holiday"] = out["date"].map(lambda d: int(d in holidays)).astype(int)
    fest = enc.festivals if enc.festivals is not None else builtin_festivals()
    feats = {d: festival_features(d, fest) for d in set(out["date"])}
    out["festival"] = out["date"].map(lambda d: feats[d][0]).astype(int)
    out["days_to_festival"] = out["date"].map(lambda d: feats[d][1]).astype(int)
    out["next_festival"] = out["date"].map(lambda d: feats[d][2]).astype(int)
    out["day_index"] = out["date"].map(lambda d: (d - enc.first_date).days).astype(int)
    out["day_of_month"] = dates.dt.day.astype(int)
    out["bucket"] = out["bucket"].map(bucket_codes).astype(int)
    out["item_code"] = out["item"].map(item_codes).astype(int)
    out["category_code"] = out["item"].map(lambda i: cat_codes[enc.item_category[i]]).astype(int)
    out["price"] = out["item"].map(enc.item_price).astype(float)
    return out


def future_frame(enc: Encoded, start: date, horizon: int, holidays: Iterable[date]) -> pd.DataFrame:
    days = [start + timedelta(days=i) for i in range(horizon)]
    grid = pd.DataFrame([(d, i, b) for d in days for (i, b) in enc.combos], columns=["date", "item", "bucket"])
    grid["qty"] = np.nan
    return add_features(grid, enc, set(holidays))


def bucket_name(code: int) -> str:
    return BUCKETS[int(code)]
