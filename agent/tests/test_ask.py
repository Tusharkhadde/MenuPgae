import json
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.ask import (
    allowed_numbers,
    dates_in_text,
    facts_for,
    match_dishes,
    numbers_ok,
    parse_intent,
    rule_intent,
    validate_intent,
    word_answer,
)
from app.llm import LlmConfig, LlmError
from app.main import app, get_factory

from .conftest import make_history

ITEMS = ["Masala Chai", "Misal Pav", "Paneer Butter Masala", "Paneer Tikka", "Vada Pav", "Chicken 65"]
TODAY = date(2026, 10, 14)  # Wednesday
CFG = LlmConfig("google", "gemma-3-27b-it", api_key="k")


def test_match_dishes_by_name_and_ingredient():
    assert match_dishes(["paneer tikka"], ITEMS) == (["Paneer Tikka"], [])
    found, missing = match_dishes(["paneer", "biryani"], ITEMS)
    assert found == ["Paneer Butter Masala", "Paneer Tikka"] and missing == ["biryani"]


def test_rule_dates():
    assert dates_in_text("how much paneer for Saturday?", TODAY) == (date(2026, 10, 17), date(2026, 10, 17))
    assert dates_in_text("vada pav this weekend", TODAY) == (date(2026, 10, 17), date(2026, 10, 18))
    assert dates_in_text("chai tomorrow", TODAY) == (date(2026, 10, 15), date(2026, 10, 15))
    assert dates_in_text("next 3 days", TODAY) == (date(2026, 10, 15), date(2026, 10, 17))
    assert dates_in_text("misal", TODAY) is None


def test_rule_intent_paneer_saturday():
    i = rule_intent("How much paneer for Saturday?", ITEMS, TODAY)
    assert i.dishes == ["Paneer Butter Masala", "Paneer Tikka"]
    assert (i.start, i.end, i.parser) == (date(2026, 10, 17), date(2026, 10, 17), "rules")


def test_validate_clamps_dates_and_drops_unknown_dishes():
    i = validate_intent({"dishes": ["Vada Pav", "Pizza"], "start_date": "2026-10-10", "end_date": "2026-12-01"}, ITEMS, TODAY, "gemma")
    assert i.dishes == ["Vada Pav"] and i.unmatched == ["Pizza"]
    assert i.start == date(2026, 10, 15) and i.end == date(2026, 10, 21)  # tomorrow .. +6
    assert len(i.notes) == 3


def test_gemma_tool_call_is_validated():
    def gen(cfg, prompt, **kw):
        assert "CALENDAR" in prompt and "2026-10-17 = Saturday" in prompt
        return json.dumps({"tool": "forecast_demand", "arguments": {"dishes": ["paneer tikka"], "start_date": "2026-10-17", "end_date": "2026-10-17"}}), cfg.model

    i = parse_intent(CFG, "paneer tikka saturday?", ITEMS, TODAY, gen=gen)
    assert i.parser == "gemma" and i.dishes == ["Paneer Tikka"] and i.start == date(2026, 10, 17)


def test_gemma_failure_falls_back_to_rules():
    def gen(cfg, prompt, **kw):
        raise LlmError("down")

    i = parse_intent(CFG, "vada pav tomorrow", ITEMS, TODAY, gen=gen)
    assert i.parser == "rules" and i.dishes == ["Vada Pav"]


def _facts():
    i = validate_intent({"dishes": ["Paneer Tikka"], "start_date": "2026-10-17", "end_date": "2026-10-17"}, ITEMS, TODAY, "gemma")
    rows = [{"date": "2026-10-17", "item": "Paneer Tikka", "low": 11.2, "median": 14.6, "prep": 17, "high": 21.4}]
    return facts_for(i, rows, synthetic=False)


def test_numbers_must_come_from_the_forecast():
    facts = _facts()
    allowed = allowed_numbers(facts, "paneer for Saturday?", ITEMS)
    assert numbers_ok("Prep 17 portions of Paneer Tikka on Saturday 17 Oct (likely 11–21).", allowed)
    assert not numbers_ok("Prep 25 portions of Paneer Tikka.", allowed)
    assert numbers_ok("Chicken 65 is not in this forecast.", allowed)  # numbers in dish names are fine


def test_gemma_numbers_are_overwritten_by_template():
    facts = _facts()

    def liar(cfg, prompt, **kw):
        return json.dumps({"answer": "Make 40 portions of Paneer Tikka, about 3 kg paneer."}), cfg.model

    answer, source = word_answer(CFG, "how much paneer for Saturday?", facts, ITEMS, gen=liar)
    assert source == "template" and "17" in answer and "40" not in answer

    def honest(cfg, prompt, **kw):
        return json.dumps({"answer": "Plan 17 portions of Paneer Tikka for Saturday; it could be 11–21. The forecast is in portions, not kg."}), cfg.model

    answer, source = word_answer(CFG, "how much paneer for Saturday?", facts, ITEMS, gen=honest)
    assert source == "gemma" and answer.startswith("Plan 17")


def test_no_model_uses_template():
    answer, source = word_answer(None, "q", _facts(), ITEMS)
    assert source == "template" and "prep 17 portions" in answer


@pytest.fixture
def client(monkeypatch, fake_factory):
    monkeypatch.setenv("AGENT_SECRET", "s3cret")
    for k in ["AI_PROVIDER", "GOOGLE_AI_API_KEY", "GEMINI_API_KEY", "OLLAMA_BASE_URL", "OPENAI_COMPAT_BASE_URL"]:
        monkeypatch.delenv(k, raising=False)
    app.dependency_overrides[get_factory] = lambda: fake_factory
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_ask_endpoint_without_language_model(client):
    hist = [r.model_dump(mode="json") for r in make_history(days=28)]
    body = {"history": hist, "question": "How much paneer tikka for Saturday?", "today": "2026-10-14", "synthetic": True}
    res = client.post("/v1/ask", json=body, headers={"Authorization": "Bearer s3cret"})
    assert res.status_code == 200, res.text
    out = res.json()
    assert out["intent"]["tool"] == "forecast_demand" and out["intent"]["arguments"]["dishes"] == ["Paneer Tikka"]
    assert out["intent"]["arguments"]["start_date"] == "2026-10-17"
    assert out["answer_source"] == "template" and len(out["rows"]) == 1
    assert str(out["rows"][0]["prep"]) in out["answer"]  # the number in the answer IS the TabPFN number
    assert client.post("/v1/ask", json=body).status_code == 401


def test_ask_unknown_dish(client):
    hist = [r.model_dump(mode="json") for r in make_history(days=28)]
    body = {"history": hist, "question": "how much biryani tomorrow", "today": "2026-10-14"}
    out = client.post("/v1/ask", json=body, headers={"Authorization": "Bearer s3cret"}).json()
    assert out["intent"]["arguments"]["dishes"] == []
    assert any("No menu dish recognised" in n for n in out["notes"])
    assert {r["item"] for r in out["rows"]} == {"Vada Pav", "Masala Chai", "Misal Pav", "Paneer Tikka"}
