"""Optional Sentry tracing for the agent, following Sentry's AI Agent Tracing conventions.

Fully no-op unless SENTRY_DSN is set (and sentry-sdk is installed): ``init_sentry()`` returns False and
``ai_span`` yields a throwaway object, so the agent never depends on Sentry.

Span tree for one request (manual instrumentation, see
https://docs.sentry.io/platforms/python/agent-tracing/manual-instrumentation/):

  POST /v1/ask                                   (FastAPI transaction, auto)
  └─ invoke_agent prep-planner                   gen_ai.invoke_agent
     ├─ chat gemma-3-27b-it                      gen_ai.chat     (intent → tool call)
     ├─ execute_tool forecast_demand             gen_ai.execute_tool
     │   ├─ tabpfn.fit                           ml.fit
     │   └─ tabpfn.predict                       ml.predict
     └─ chat gemma-3-27b-it                      gen_ai.chat     (wording)

Prompts/answers are NOT attached (send_default_pii stays False); only model ids, token counts,
latency, row counts and errors.
"""

from __future__ import annotations

import logging
import os
import time
from contextlib import contextmanager
from typing import Any, Iterator

log = logging.getLogger("prep-agent")

AGENT_NAME = "prep-planner"
_enabled = False


class _NoopSpan:
    """Stands in for a Sentry span when tracing is off."""

    def set_data(self, key: str, value: Any) -> None:  # noqa: D401 - mirror sentry API
        pass

    def set_status(self, status: str) -> None:
        pass


def init_sentry() -> bool:
    """Initialise Sentry if SENTRY_DSN is set. Safe to call more than once."""
    global _enabled
    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        _enabled = False
        return False
    try:
        import sentry_sdk
    except ImportError:  # pragma: no cover - sentry-sdk is in requirements, but stay optional
        log.warning("SENTRY_DSN is set but sentry-sdk is not installed; tracing disabled.")
        _enabled = False
        return False
    sentry_sdk.init(
        dsn=dsn,
        environment=os.getenv("SENTRY_ENVIRONMENT") or None,
        release=os.getenv("RENDER_GIT_COMMIT") or None,
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "1.0")),
    )
    _enabled = True
    return True


def enabled() -> bool:
    return _enabled


@contextmanager
def ai_span(op: str, name: str, **data: Any) -> Iterator[Any]:
    """Start a child span (no-op without Sentry). Records latency_ms and marks errors."""
    if not _enabled:
        yield _NoopSpan()
        return
    import sentry_sdk

    started = time.perf_counter()
    with sentry_sdk.start_span(op=op, name=name) as span:
        for k, v in data.items():
            if v is not None:
                span.set_data(k, v)
        try:
            yield span
        except Exception as err:
            span.set_status("internal_error")
            span.set_data("error.type", type(err).__name__)
            raise
        finally:
            span.set_data("latency_ms", round((time.perf_counter() - started) * 1000, 1))


def agent_span(task: str) -> Any:
    return ai_span(
        "gen_ai.invoke_agent",
        f"invoke_agent {AGENT_NAME}",
        **{"gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": AGENT_NAME, "menupage.task": task},
    )


def chat_span(provider: str, model: str, purpose: str) -> Any:
    return ai_span(
        "gen_ai.chat",
        f"chat {model}",
        **{
            "gen_ai.operation.name": "chat",
            "gen_ai.provider.name": "gcp.gemini" if provider == "google" else "ollama",
            "gen_ai.request.model": model,
            "gen_ai.agent.name": AGENT_NAME,
            "menupage.purpose": purpose,
        },
    )


def tool_span(tool: str) -> Any:
    return ai_span(
        "gen_ai.execute_tool",
        f"execute_tool {tool}",
        **{"gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": tool, "gen_ai.agent.name": AGENT_NAME},
    )
