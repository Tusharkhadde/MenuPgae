"""Gemma turns the TabPFN numbers into a prep list the kitchen can read.

Numbers are never taken from the language model: quantities come from the forecast and are
re-attached after Gemma answers; Gemma only writes the summary and the notes. If no model is
configured (or it fails), a plain template writes them instead and the response says so.
"""

from __future__ import annotations

import json
import logging
from datetime import date
from typing import Any, Callable

from .llm import LlmConfig, LlmError, generate_text, parse_model_json

log = logging.getLogger("prep-agent")

TextGen = Callable[[LlmConfig, str], tuple[str, str]]

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def prep_targets(forecast_rows: list[dict[str, Any]], day: str, limit: int = 15) -> list[dict[str, Any]]:
    rows = [f for f in forecast_rows if f["date"] == day and f["prep"] > 0]
    rows.sort(key=lambda f: f["median"], reverse=True)
    return rows[:limit]


def build_prompt(restaurant: str, day: str, holiday: bool, targets: list[dict[str, Any]], risks: list[dict[str, Any]], anomalies: list[dict[str, Any]], synthetic: bool) -> str:
    wd = WEEKDAYS[date.fromisoformat(day).weekday()]
    facts = {
        "restaurant": restaurant,
        "date": day,
        "weekday": wd,
        "public_holiday": holiday,
        "data_is_synthetic_demo": synthetic,
        "dishes": [{"dish": t["item"], "prep_portions": t["prep"], "likely_range": [round(t["low"]), round(t["high"])], "busiest_period": t["peak_bucket"]} for t in targets],
        "run_out_risk": [{"dish": r["item"], "date": r["date"], "high_case": round(r["high"]), "usual_for_weekday": round(r["usual"])} for r in risks],
        "recent_unusual_days": [{"date": a["date"], "dish": a["item"] or "all dishes", "kind": a["kind"], "sold": a["actual"], "expected": a["expected"]} for a in anomalies[:5]],
    }
    return "\n".join(
        [
            "You write the morning prep list for a restaurant kitchen in India. Be short, practical and friendly.",
            "Use ONLY the facts below. Do not change or invent any numbers, dishes or reasons (no weather, no events unless listed).",
            "",
            "Write:",
            '- "summary": one or two sentences for the head cook about the day ahead.',
            '- "items": for each dish in "dishes", a short prep note (max 15 words), e.g. when to batch it (use busiest_period).',
            '- "risk_notes": for each dish in "run_out_risk", one sentence on why it could run out ("86") and a practical buffer.',
            "",
            'Output ONLY a JSON object, no prose, no code fences: {"summary": string, "items": [{"dish": string, "note": string}], "risk_notes": [{"dish": string, "note": string}]}',
            "",
            "FACTS:",
            json.dumps(facts, ensure_ascii=False),
        ]
    )


def template(restaurant: str, day: str, holiday: bool, targets: list[dict[str, Any]], risks: list[dict[str, Any]]) -> dict[str, Any]:
    wd = WEEKDAYS[date.fromisoformat(day).weekday()]
    total = sum(t["prep"] for t in targets)
    summary = f"{wd} {day}{' (public holiday)' if holiday else ''}: prep about {total} portions across {len(targets)} dishes."
    if targets:
        summary += f" Biggest mover: {targets[0]['item']}."
    items = [
        {"item": t["item"], "quantity": t["prep"], "note": f"Likely {round(t['low'])}–{round(t['high'])}." + (f" Busiest at {t['peak_bucket']}." if t["peak_bucket"] else "")}
        for t in targets
    ]
    notes = [{"item": r["item"], "note": f"Could reach {round(r['high'])} on {r['date']} vs about {round(r['usual'])} usually — keep a small extra batch ready."} for r in risks]
    return {"source": "template", "summary": summary, "items": items, "risk_notes": notes}


def narrate(
    cfg: LlmConfig | None,
    restaurant: str,
    day: str,
    holiday: bool,
    targets: list[dict[str, Any]],
    risks: list[dict[str, Any]],
    anomalies: list[dict[str, Any]],
    synthetic: bool,
    gen: TextGen = generate_text,
) -> tuple[dict[str, Any], str | None]:
    """Returns (prep block, narrator label or None when the template was used)."""
    base = template(restaurant, day, holiday, targets, risks)
    if cfg is None or not targets:
        return base, None
    try:
        text, model = gen(cfg, build_prompt(restaurant, day, holiday, targets, risks, anomalies, synthetic))
        out = parse_model_json(text)
    except LlmError as err:
        log.warning("narrator fell back to template: %s", err)
        return base, None
    notes = {_key(i.get("dish")): str(i.get("note", "")).strip()[:200] for i in out.get("items", []) if isinstance(i, dict)}
    risk_text = {_key(i.get("dish")): str(i.get("note", "")).strip()[:240] for i in out.get("risk_notes", []) if isinstance(i, dict)}
    summary = str(out.get("summary") or "").strip()[:400] or base["summary"]
    # Quantities always come from the forecast; Gemma only contributes wording.
    items = [{"item": t["item"], "quantity": t["prep"], "note": notes.get(_key(t["item"])) or b["note"]} for t, b in zip(targets, base["items"])]
    risk_notes = [{"item": r["item"], "note": risk_text.get(_key(r["item"])) or b["note"]} for r, b in zip(risks, base["risk_notes"])]
    label = cfg.label if model == cfg.model else f"{model} via Google AI Studio"
    return {"source": "gemma", "summary": summary, "items": items, "risk_notes": risk_notes}, label


def _key(v: Any) -> str:
    return " ".join(str(v or "").lower().split())
