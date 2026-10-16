import pytest

from app import tracing
from app.llm import LlmConfig, generate_text


def test_no_dsn_is_noop(monkeypatch):
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    assert tracing.init_sentry() is False
    assert tracing.enabled() is False
    with tracing.agent_span("ask") as s:
        s.set_data("x", 1)  # no-op object accepts calls
    with tracing.chat_span("google", "gemma-3-27b-it", "intent") as s:
        s.set_status("ok")


def test_noop_span_propagates_errors(monkeypatch):
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    tracing.init_sentry()
    with pytest.raises(ValueError):
        with tracing.tool_span("forecast_demand"):
            raise ValueError("boom")


class _Resp:
    status_code = 200

    def json(self):
        return {"candidates": [{"content": {"parts": [{"text": "{}"}]}}], "usageMetadata": {"promptTokenCount": 12, "candidatesTokenCount": 3}}


class _Client:
    def post(self, *a, **k):
        return _Resp()


def test_generate_text_works_without_sentry(monkeypatch):
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    tracing.init_sentry()
    text, model = generate_text(LlmConfig("google", "gemma-3-27b-it", api_key="k"), "hi", client=_Client())
    assert text == "{}" and model == "gemma-3-27b-it"


def test_with_dsn_records_usage(monkeypatch):
    """With a DSN, spans are created and token counts recorded (transport stubbed: nothing is sent)."""
    sentry_sdk = pytest.importorskip("sentry_sdk")
    sent = []
    monkeypatch.setenv("SENTRY_DSN", "https://public@example.invalid/1")
    real_init = sentry_sdk.init
    from sentry_sdk.transport import Transport

    class Capture(Transport):
        def capture_envelope(self, envelope):
            sent.append(envelope.serialize().decode("utf-8", "replace"))

    monkeypatch.setattr(sentry_sdk, "init", lambda **kw: real_init(**kw, transport=Capture()))
    try:
        assert tracing.init_sentry() is True
        with sentry_sdk.start_transaction(name="test"):
            with tracing.agent_span("ask"):
                generate_text(LlmConfig("google", "gemma-3-27b-it", api_key="k"), "hi", client=_Client(), purpose="intent")
        sentry_sdk.flush()
    finally:
        monkeypatch.delenv("SENTRY_DSN")
        tracing.init_sentry()
    blob = "\n".join(sent).replace(" ", "")
    assert "gen_ai.chat" in blob and "invoke_agentprep-planner" in blob
    assert '"gen_ai.usage.input_tokens":12' in blob or '"gen_ai.usage.input_tokens":{"value":12' in blob, blob[:2000]
    assert '"gen_ai.request.model":' in blob
