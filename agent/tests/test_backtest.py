from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.backtest import BacktestError, mae, naive_baselines, run_backtest, score, to_markdown, wape
from app.features import encode_history
from app.main import app, get_factory

from .conftest import make_history


def test_mae_and_wape_hand_computed():
    a = np.array([10, 0, 5])
    f = np.array([8, 1, 5])
    assert mae(a, f) == pytest.approx(1.0)  # (2 + 1 + 0) / 3
    assert wape(a, f) == pytest.approx(3 / 15)
    assert wape(np.array([0, 0]), np.array([1, 2])) is None  # nothing sold: undefined, not 0 or inf
    assert mae(np.array([]), np.array([])) == 0.0


def test_naive_baselines_only_use_training_days():
    start = date(2026, 9, 7)  # a Monday
    rows = [(start + timedelta(days=i), "Poha", float(i)) for i in range(28)]
    train = pd.DataFrame(rows, columns=["date", "item", "qty"])
    hold = [date(2026, 10, 5), date(2026, 10, 12)]  # Mondays after the training window
    base = naive_baselines(train, hold, ["Poha"])
    # Mondays in training: day 0, 7, 14, 21 -> qty 0, 7, 14, 21
    assert base["last_week"].tolist() == [21.0, 21.0]  # never peeks into the holdout
    assert base["weekday_mean_4w"].tolist() == [pytest.approx(10.5)] * 2


def test_score_picks_best_model_and_per_dish():
    t = pd.DataFrame(
        {
            "date": [date(2026, 10, 1)] * 2,
            "item": ["A", "B"],
            "actual": [10.0, 20.0],
            "tabpfn": [9.0, 21.0],
            "last_week": [5.0, 30.0],
            "weekday_mean_4w": [10.0, 10.0],
        }
    )
    res = score(t)
    assert res["overall"]["tabpfn"]["mae"] == 1.0
    assert res["overall"]["tabpfn"]["wape"] == pytest.approx(2 / 30, abs=1e-4)
    assert res["overall"]["last_week"]["wape"] == pytest.approx(15 / 30, abs=1e-4)
    assert res["best_by_wape"] == "tabpfn"
    assert [d["item"] for d in res["per_dish"]] == ["B", "A"]  # by volume


def test_run_backtest_with_fake_tabpfn(fake_factory):
    enc = encode_history(make_history(days=42), [])
    res = run_backtest(enc, fake_factory, holdout_days=14)
    assert res["holdout"] == {"start": "2026-10-01", "end": "2026-10-14"}
    assert res["train"]["days"] == 28
    assert res["dish_days"] == 14 * 4
    assert set(res["overall"]) == {"tabpfn", "last_week", "weekday_mean_4w"}
    md = to_markdown(res, synthetic=True)
    assert "SYNTHETIC" in md and "| TabPFN (median) |" in md


def test_backtest_needs_enough_training_days(fake_factory):
    enc = encode_history(make_history(days=20), [])
    with pytest.raises(BacktestError):
        run_backtest(enc, fake_factory, holdout_days=14)


def test_backtest_endpoint(monkeypatch, fake_factory):
    monkeypatch.setenv("AGENT_SECRET", "s3cret")
    app.dependency_overrides[get_factory] = lambda: fake_factory
    try:
        c = TestClient(app)
        hist = [r.model_dump(mode="json") for r in make_history(days=42)]
        h = {"Authorization": "Bearer s3cret"}
        res = c.post("/v1/backtest", json={"history": hist, "holdout_days": 14, "synthetic": True}, headers=h)
        assert res.status_code == 200, res.text
        assert res.json()["synthetic"] is True and res.json()["best_by_wape"] in {"tabpfn", "last_week", "weekday_mean_4w"}
        short = [r.model_dump(mode="json") for r in make_history(days=15)]
        assert c.post("/v1/backtest", json={"history": short}, headers=h).status_code == 422
    finally:
        app.dependency_overrides.clear()
