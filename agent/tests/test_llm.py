import pytest

from app.llm import LlmConfig, LlmError, chat_completions_url, load_config, parse_model_json
from app.narrator import narrate


def test_parse_model_json_variants():
    assert parse_model_json('{"a": 1}') == {"a": 1}
    assert parse_model_json('Sure!\n```json\n{"a": 2}\n```') == {"a": 2}
    assert parse_model_json('Here: {"a": {"b": "x}"}} trailing') == {"a": {"b": "x}"}}
    assert parse_model_json('{"a": [1, 2,],}') == {"a": [1, 2]}
    with pytest.raises(LlmError):
        parse_model_json("no json here")


def test_chat_completions_url():
    assert chat_completions_url("http://localhost:11434") == "http://localhost:11434/v1/chat/completions"
    assert chat_completions_url("http://x/v1/") == "http://x/v1/chat/completions"


def test_load_config_switch(monkeypatch):
    for k in ["AI_PROVIDER", "GOOGLE_AI_API_KEY", "GEMINI_API_KEY", "OLLAMA_BASE_URL", "OPENAI_COMPAT_BASE_URL", "GEMMA_MODEL", "OLLAMA_MODEL"]:
        monkeypatch.delenv(k, raising=False)
    assert load_config() is None
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    cfg = load_config()
    assert cfg.provider == "google" and cfg.model == "gemma-3-27b-it"
    monkeypatch.setenv("AI_PROVIDER", "ollama")
    cfg = load_config()
    assert cfg.provider == "ollama" and cfg.model == "gemma3:4b" and cfg.endpoint.endswith("/v1/chat/completions")


TARGETS = [{"date": "2026-10-17", "item": "Vada Pav", "prep": 42, "low": 30.0, "median": 38.0, "high": 50.0, "peak_bucket": "snacks"}]
RISKS = [{"item": "Vada Pav", "date": "2026-10-17", "high": 50.0, "usual": 30.0, "ratio": 1.67}]


def test_narrate_keeps_forecast_numbers_even_if_model_lies():
    def gen(cfg, prompt):
        assert "prep_portions" in prompt and "Do not change or invent any numbers" in prompt
        return '{"summary": "Busy Saturday.", "items": [{"dish": "vada pav", "note": "Fry in two batches before 4pm.", "quantity": 999}], "risk_notes": [{"dish": "Vada Pav", "note": "Weekend rush."}]}', "gemma-3-27b-it"

    cfg = LlmConfig("google", "gemma-3-27b-it", api_key="k")
    prep, label = narrate(cfg, "Cafe", "2026-10-17", False, TARGETS, RISKS, [], False, gen=gen)
    assert prep["source"] == "gemma" and label.startswith("gemma-3-27b-it")
    assert prep["items"][0]["quantity"] == 42
    assert prep["items"][0]["note"] == "Fry in two batches before 4pm."
    assert prep["risk_notes"][0]["note"] == "Weekend rush."


def test_narrate_falls_back_to_template():
    def gen(cfg, prompt):
        raise LlmError("down")

    prep, label = narrate(LlmConfig("ollama", "gemma3:4b", endpoint="http://x"), "Cafe", "2026-10-17", True, TARGETS, RISKS, [], True, gen=gen)
    assert label is None and prep["source"] == "template"
    assert "public holiday" in prep["summary"] and prep["items"][0]["quantity"] == 42
    prep2, label2 = narrate(None, "Cafe", "2026-10-17", False, TARGETS, [], [], False)
    assert label2 is None and prep2["risk_notes"] == []
