from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.main import app, get_factory

from .conftest import make_history


@pytest.fixture
def client(monkeypatch, fake_factory):
    monkeypatch.setenv("AGENT_SECRET", "s3cret")
    for k in ["AI_PROVIDER", "GOOGLE_AI_API_KEY", "GEMINI_API_KEY", "OLLAMA_BASE_URL", "OPENAI_COMPAT_BASE_URL", "PRIORLABS_API_KEY", "TABPFN_TOKEN"]:
        monkeypatch.delenv(k, raising=False)
    app.dependency_overrides[get_factory] = lambda: fake_factory
    yield TestClient(app)
    app.dependency_overrides.clear()


def payload(days=42, **kw):
    hist = [r.model_dump(mode="json") for r in make_history(days=days)]
    return {"restaurant": {"name": "Demo Café"}, "history": hist, "holidays": ["2026-10-02"], "start_date": "2026-10-15", "horizon_days": 3, "synthetic": True, **kw}


def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok" and body["tabpfn_configured"] is False and body["secret_configured"] is True


def test_requires_secret(client):
    assert client.post("/v1/prep-plan", json=payload()).status_code == 401
    assert client.post("/v1/prep-plan", json=payload(), headers={"Authorization": "Bearer nope"}).status_code == 401


def test_prep_plan_end_to_end_with_fake_tabpfn(client):
    res = client.post("/v1/prep-plan", json=payload(), headers={"Authorization": "Bearer s3cret"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["synthetic"] is True and body["horizon_days"] == 3
    assert len(body["forecast"]) == 12
    assert body["prep"]["source"] == "template" and body["prep"]["date"] == "2026-10-15"
    assert body["prep"]["items"] and all(i["quantity"] > 0 for i in body["prep"]["items"])
    assert body["models"]["narrator"] == "template"
    assert {"anomalies", "risk", "daily_totals", "warnings"} <= body.keys()


def test_rejects_too_little_history(client):
    res = client.post("/v1/prep-plan", json=payload(days=5), headers={"Authorization": "Bearer s3cret"})
    assert res.status_code == 422


def test_validation(client):
    bad = payload(horizon_days=9)
    assert client.post("/v1/prep-plan", json=bad, headers={"Authorization": "Bearer s3cret"}).status_code == 422


def test_missing_tabpfn_key_is_503(monkeypatch):
    monkeypatch.setenv("AGENT_SECRET", "s3cret")
    monkeypatch.delenv("PRIORLABS_API_KEY", raising=False)
    monkeypatch.delenv("TABPFN_TOKEN", raising=False)
    app.dependency_overrides.clear()
    res = TestClient(app).post("/v1/prep-plan", json=payload(), headers={"Authorization": "Bearer s3cret"})
    assert res.status_code == 503 and "PRIORLABS_API_KEY" in res.json()["detail"]


def test_secret_unset_is_503(monkeypatch):
    monkeypatch.delenv("AGENT_SECRET", raising=False)
    res = TestClient(app).post("/v1/prep-plan", json=payload(), headers={"Authorization": "Bearer x"})
    assert res.status_code == 503
    assert date.today()  # keep import used
