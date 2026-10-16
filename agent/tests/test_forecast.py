from datetime import date, timedelta

from app.features import CATEGORICAL, FEATURES, encode_history, future_frame, hour_bucket
from app.forecast import anomalies, forecast, risk_items

from .conftest import FakeRegressor, make_history


def test_hour_buckets():
    assert hour_bucket(8) == "breakfast"
    assert hour_bucket(13) == "lunch"
    assert hour_bucket(17) == "snacks"
    assert hour_bucket(21) == "dinner"
    assert hour_bucket(2) == "dinner"


def test_encode_zero_fills_and_features():
    hist = make_history(days=10)
    enc = encode_history(hist, [date(2026, 10, 2)])
    # 10 days x 4 (item, bucket) combos
    assert len(enc.frame) == 40
    assert set(FEATURES).issubset(enc.frame.columns)
    assert enc.frame.loc[enc.frame["date"] == date(2026, 10, 10), "holiday"].eq(0).all()
    fut = future_frame(enc, date(2026, 10, 15), 3, [])
    assert len(fut) == 12 and fut["qty"].isna().all()
    assert CATEGORICAL == [0, 5, 6, 7]


def test_forecast_shapes_and_monotone_quantiles(fake_factory):
    enc = encode_history(make_history(), [])
    out = forecast(enc, date(2026, 10, 15), 3, [], fake_factory)
    assert len(out["forecast"]) == 3 * 4
    for r in out["forecast"]:
        assert 0 <= r["low"] <= r["median"] <= r["high"]
        assert r["prep"] >= r["median"] - 1e-6
    assert len(out["daily_totals"]) == 3
    # the regressor was given the categorical column indices
    assert FakeRegressor.instances[0].categorical == CATEGORICAL


def test_anomaly_detection_flags_injected_spike(fake_factory):
    end = date(2026, 10, 14)
    spike = end - timedelta(days=3)
    enc = encode_history(make_history(days=42, end=end, spike_day=spike), [])
    found, note = anomalies(enc, fake_factory)
    assert note is None
    assert any(a["date"] == spike.isoformat() and a["kind"] == "spike" for a in found)
    # trained only on days before the 14-day holdout
    assert FakeRegressor.instances[-1].fitted_rows == (42 - 14) * 4


def test_anomalies_need_enough_history(fake_factory):
    enc = encode_history(make_history(days=20), [])
    found, note = anomalies(enc, fake_factory)
    assert found == [] and "28" in note


def test_risk_items_flags_high_case_above_usual():
    enc = encode_history(make_history(days=28), [])
    rows = [{"date": "2026-10-17", "item": "Vada Pav", "high": 60.0}, {"date": "2026-10-17", "item": "Masala Chai", "high": 12.0}]
    risks = risk_items(enc, rows)
    assert [r["item"] for r in risks] == ["Vada Pav"]
    assert risks[0]["ratio"] >= 1.3
