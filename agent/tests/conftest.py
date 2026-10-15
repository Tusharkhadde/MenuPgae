from __future__ import annotations

import random
from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

from app.schemas import HistoryRow


class FakeRegressor:
    """Stands in for tabpfn_client.TabPFNRegressor: per (item, bucket, weekday) mean, quantiles as +/- spread."""

    instances: list["FakeRegressor"] = []

    def __init__(self, categorical: list[int]):
        self.categorical = categorical
        self.fitted_rows = 0
        FakeRegressor.instances.append(self)

    def fit(self, X: pd.DataFrame, y):
        df = X.copy()
        df["y"] = np.asarray(y, dtype=float)
        self.fitted_rows = len(df)
        self.table = df.groupby(["item_code", "bucket", "weekday"])["y"].mean().to_dict()
        self.global_mean = float(df["y"].mean())
        return self

    def predict(self, X: pd.DataFrame, output_type: str = "mean", quantiles=None):
        mean = np.array([self.table.get((r.item_code, r.bucket, r.weekday), self.global_mean) for r in X.itertuples(index=False)])
        if output_type != "quantiles":
            return mean
        return [mean * (0.6 + 0.8 * q) for q in quantiles]


@pytest.fixture(autouse=True)
def _reset_fakes():
    FakeRegressor.instances.clear()
    yield


@pytest.fixture
def fake_factory():
    return lambda categorical: FakeRegressor(categorical)


def make_history(days: int = 42, end: date = date(2026, 10, 14), spike_day: date | None = None, seed: int = 7) -> list[HistoryRow]:
    rnd = random.Random(seed)
    menu = [("Vada Pav", "Snacks", 20.0, 17), ("Masala Chai", "Chai", 25.0, 9), ("Misal Pav", "Breakfast", 90.0, 9), ("Paneer Tikka", "Mains", 260.0, 20)]
    rows: list[HistoryRow] = []
    start = end - timedelta(days=days - 1)
    for i in range(days):
        d = start + timedelta(days=i)
        lift = 1.5 if d.weekday() >= 5 else 1.0
        if spike_day and d == spike_day:
            lift *= 4
        for name, cat, price, hour in menu:
            qty = max(0, round(rnd.gauss(10 * lift, 1.5)))
            if qty:
                rows.append(HistoryRow(date=d, hour=hour, item=name, category=cat, qty=qty, price=price))
    return rows
