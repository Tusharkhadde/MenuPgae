"""Gemma provider layer for the agent (mirrors src/lib/ai in the Next.js app).

AI_PROVIDER=google (default when GOOGLE_AI_API_KEY is set): Gemma via Google AI Studio.
AI_PROVIDER=ollama: Ollama / any OpenAI-compatible server (OLLAMA_BASE_URL or OPENAI_COMPAT_BASE_URL).
Gemma on AI Studio has no JSON mode or system instruction, so we prompt for JSON and parse robustly.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any

import httpx

from .tracing import chat_span

DEFAULT_GEMMA_MODEL = "gemma-3-27b-it"
DEFAULT_GEMMA_FALLBACK_MODEL = "gemma-4-26b-a4b-it"
DEFAULT_LOCAL_MODEL = "gemma3:4b"


class LlmError(RuntimeError):
    pass


@dataclass
class LlmConfig:
    provider: str  # "google" | "ollama"
    model: str
    api_key: str | None = None
    endpoint: str | None = None
    fallback_model: str | None = None

    @property
    def label(self) -> str:
        return f"{self.model} via Google AI Studio" if self.provider == "google" else f"{self.model} via {self.endpoint}"


def _env(name: str) -> str | None:
    v = os.getenv(name, "").strip()
    return v or None


def chat_completions_url(base: str) -> str:
    b = base.strip().rstrip("/")
    if b.endswith("/chat/completions"):
        return b
    if re.search(r"/v\d+$", b):
        return f"{b}/chat/completions"
    return f"{b}/v1/chat/completions"


def load_config() -> LlmConfig | None:
    provider = (_env("AI_PROVIDER") or "").lower() or None
    key = _env("GOOGLE_AI_API_KEY") or _env("GEMINI_API_KEY")
    local = _env("OPENAI_COMPAT_BASE_URL") or _env("OLLAMA_BASE_URL")
    if provider not in (None, "google", "ollama"):
        return None
    if provider is None:
        provider = "google" if key else ("ollama" if local else None)
    if provider == "google":
        if not key:
            return None
        model = _env("GEMMA_MODEL") or DEFAULT_GEMMA_MODEL
        fb = _env("GEMMA_FALLBACK_MODEL") or DEFAULT_GEMMA_FALLBACK_MODEL
        return LlmConfig("google", model, api_key=key, fallback_model=None if fb in ("none", model) else fb)
    if provider == "ollama":
        return LlmConfig(
            "ollama",
            _env("OLLAMA_MODEL") or DEFAULT_LOCAL_MODEL,
            api_key=_env("OPENAI_COMPAT_API_KEY"),
            endpoint=chat_completions_url(local or "http://localhost:11434"),
        )
    return None


# ----------------------------------------------------------------------------- JSON parsing


def extract_first_json(text: str) -> str | None:
    start = text.find("{")
    if start < 0:
        return None
    depth, in_str, esc = 0, False, False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def parse_model_json(text: str) -> dict[str, Any]:
    """Direct parse -> fenced block -> first balanced {...} -> same without trailing commas."""
    t = (text or "").strip()
    if not t:
        raise LlmError("empty model answer")
    candidates = [t]
    m = re.search(r"```(?:json|JSON)?\s*\n?([\s\S]*?)```", t)
    if m:
        candidates.append(m.group(1).strip())
    first = extract_first_json(candidates[-1]) or extract_first_json(t)
    if first:
        candidates.append(first)
    for c in candidates:
        for variant in (c, re.sub(r",(\s*[}\]])", r"\1", c)):
            try:
                v = json.loads(variant)
            except (ValueError, TypeError):
                continue
            if isinstance(v, dict):
                return v
    raise LlmError("model answer was not JSON")


# ----------------------------------------------------------------------------- calls


def _record_usage(span, data: dict[str, Any], model: str) -> None:
    """Token counts if the provider returned them (Google usageMetadata / OpenAI-style usage)."""
    span.set_data("gen_ai.response.model", model)
    um = data.get("usageMetadata") or {}
    us = data.get("usage") or {}
    inp = um.get("promptTokenCount", us.get("prompt_tokens"))
    out = um.get("candidatesTokenCount", us.get("completion_tokens"))
    if isinstance(inp, int):
        span.set_data("gen_ai.usage.input_tokens", inp)
    if isinstance(out, int):
        span.set_data("gen_ai.usage.output_tokens", out)


def generate_text(
    cfg: LlmConfig, prompt: str, *, client: httpx.Client | None = None, timeout: float = 60.0, purpose: str = "generate"
) -> tuple[str, str]:
    """Returns (text, model_used). Traced as a gen_ai.chat span when Sentry is on."""
    with chat_span(cfg.provider, cfg.model, purpose) as span:
        return _generate_text(cfg, prompt, span, client=client, timeout=timeout)


def _generate_text(cfg: LlmConfig, prompt: str, span: Any, *, client: httpx.Client | None, timeout: float) -> tuple[str, str]:
    own = client is None
    http = client or httpx.Client(timeout=timeout)
    try:
        if cfg.provider == "google":
            models = [cfg.model] + ([cfg.fallback_model] if cfg.fallback_model else [])
            for i, model in enumerate(models):
                res = http.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                    headers={"x-goog-api-key": cfg.api_key or "", "Content-Type": "application/json"},
                    json={"contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.2, "maxOutputTokens": 4096}},
                )
                if res.status_code == 404 and i < len(models) - 1:
                    continue
                if res.status_code >= 400:
                    raise LlmError(f"Google AI Studio HTTP {res.status_code}: {res.text[:300]}")
                body = res.json()
                _record_usage(span, body, model)
                parts = (body.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
                return "".join(p.get("text", "") for p in parts if not p.get("thought")), model
            raise LlmError("no Gemma model available")
        headers = {"Content-Type": "application/json"}
        if cfg.api_key:
            headers["Authorization"] = f"Bearer {cfg.api_key}"
        res = http.post(
            cfg.endpoint or "",
            headers=headers,
            json={"model": cfg.model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.2, "stream": False},
        )
        if res.status_code >= 400:
            raise LlmError(f"local model HTTP {res.status_code}: {res.text[:300]}")
        body = res.json()
        _record_usage(span, body, cfg.model)
        content = (body.get("choices") or [{}])[0].get("message", {}).get("content") or ""
        if isinstance(content, list):
            content = "".join(p.get("text", "") for p in content)
        return content, cfg.model
    except httpx.HTTPError as err:
        raise LlmError(f"model server unreachable: {err}") from err
    finally:
        if own:
            http.close()
