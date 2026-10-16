""""Ask the planner": free-text question -> tool call -> TabPFN -> worded answer.

1. Intent. Gemma turns the question into ONE tool call
   {"tool": "forecast_demand", "arguments": {"dishes": [...], "start_date": "...", "end_date": "..."}}
   using a calendar of the next days we give it (no date arithmetic left to the model). Without a
   language model a small rule parser does the same job. Either way the call is validated here:
   dishes must exist on the menu, dates are clamped to tomorrow .. tomorrow+6.
2. Tool. TabPFN forecasts those dishes and days (the same forecast the prep planner uses).
3. Answer. Gemma words the answer from the forecast facts. Numbers always come from TabPFN: every
   number in Gemma's text must be one of the forecast's numbers (or a date / a number in the question
   or a dish name); otherwise the text is replaced by a template built from the forecast.
"""

from __future__ import annotations

import json
import logging
import math
import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Callable

from .llm import LlmConfig, LlmError, generate_text, parse_model_json

log = logging.getLogger("prep-agent")

TextGen = Callable[..., tuple[str, str]]
WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
MAX_DAYS = 7
TOOL_NAME = "forecast_demand"


@dataclass
class Intent:
    dishes: list[str]  # exact menu names; empty = all dishes
    start: date
    end: date
    parser: str  # "gemma" | "rules"
    unmatched: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def tool_call(self) -> dict[str, Any]:
        return {
            "tool": TOOL_NAME,
            "arguments": {"dishes": self.dishes, "start_date": self.start.isoformat(), "end_date": self.end.isoformat()},
            "parser": self.parser,
            "unmatched": self.unmatched,
        }


def _norm(s: Any) -> str:
    return " ".join(re.sub(r"[^\w\s]", " ", str(s or "").lower()).split())


def window(today: date) -> tuple[date, date]:
    first = today + timedelta(days=1)
    return first, first + timedelta(days=MAX_DAYS - 1)


def calendar_lines(today: date) -> list[str]:
    first, last = window(today)
    out = [f"today = {today.isoformat()} ({WEEKDAYS[today.weekday()].title()}) — cannot be forecast"]
    d = first
    while d <= last:
        out.append(f"{d.isoformat()} = {WEEKDAYS[d.weekday()].title()}{' (tomorrow)' if d == first else ''}")
        d += timedelta(days=1)
    return out


# ----------------------------------------------------------------------------- dishes


def match_dishes(terms: list[str], items: list[str]) -> tuple[list[str], list[str]]:
    """Exact (normalised) name first, else every dish whose name contains the term ("paneer" -> all paneer dishes)."""
    by_norm = {_norm(i): i for i in items}
    found: list[str] = []
    unmatched: list[str] = []
    for t in terms:
        n = _norm(t)
        if not n:
            continue
        if n in by_norm:
            hits = [by_norm[n]]
        else:
            hits = [i for k, i in by_norm.items() if re.search(rf"\b{re.escape(n)}\b", k) or (len(n) > 3 and n in k)]
        if hits:
            found += [h for h in hits if h not in found]
        else:
            unmatched.append(str(t))
    return found, unmatched


def dishes_in_text(question: str, items: list[str]) -> list[str]:
    """Rule parser: dishes named (fully or by a distinctive word) in the question."""
    q = f" {_norm(question)} "
    full = [i for i in items if f" {_norm(i)} " in q]
    if full:
        return full
    stop = {"how", "much", "many", "the", "for", "and", "with", "masala", "special", "plate", "half", "full", "fry", "dry", "veg", "chicken", "make", "prep"}
    words = {w for w in q.split() if len(w) > 2 and w not in stop}
    return [i for i in items if words & set(_norm(i).split())]


# ----------------------------------------------------------------------------- dates


def dates_in_text(question: str, today: date) -> tuple[date, date] | None:
    q = _norm(question)
    first, last = window(today)
    if m := re.search(r"\b(?:next|coming)\s+(\d+)\s+days?\b", q):
        n = max(1, min(MAX_DAYS, int(m.group(1))))
        return first, first + timedelta(days=n - 1)
    if re.search(r"\b(?:next|this|coming)\s+week\b|\bweek\b", q):
        return first, last
    if "weekend" in q:
        sat = _next_weekday(5, first)
        return sat, sat + timedelta(days=1)
    if "day after tomorrow" in q:
        d = today + timedelta(days=2)
        return d, d
    if "tomorrow" in q or "kal" in q.split():
        return first, first
    if m := re.search(r"\b(20\d\d-\d\d-\d\d)\b", question):
        d = date.fromisoformat(m.group(1))
        return d, d
    days = [i for i, w in enumerate(WEEKDAYS) if re.search(rf"\b{w}\b|\b{w[:3]}\b", q)]
    if days:
        ds = sorted(_next_weekday(i, first) for i in days)
        return ds[0], ds[-1]
    if "today" in q or "tonight" in q:
        return today, today
    return None


def _next_weekday(wd: int, start: date) -> date:
    return start + timedelta(days=(wd - start.weekday()) % 7)


def rule_intent(question: str, items: list[str], today: date) -> Intent:
    rng = dates_in_text(question, today)
    start, end = rng if rng else (window(today)[0], window(today)[0])
    intent = validate_intent({"dishes": dishes_in_text(question, items), "start_date": start.isoformat(), "end_date": end.isoformat()}, items, today, "rules")
    if not intent.dishes:
        intent.notes.append("No menu dish recognised in the question, so this covers every dish.")
    return intent


def validate_intent(args: dict[str, Any], items: list[str], today: date, parser: str) -> Intent:
    notes: list[str] = []
    first, last = window(today)

    def as_date(v: Any, fallback: date) -> date:
        try:
            return date.fromisoformat(str(v)[:10])
        except ValueError:
            return fallback

    start = as_date(args.get("start_date"), first)
    end = as_date(args.get("end_date"), start)
    if end < start:
        start, end = end, start
    if start < first:
        notes.append(f"Forecasts start tomorrow ({first.isoformat()}); today and past days can't be forecast.")
        start = max(start, first)
        end = max(end, start)
    if end > last:
        notes.append(f"The planner looks at most {MAX_DAYS} days ahead (until {last.isoformat()}).")
        end = last
        start = min(start, end)
    raw = args.get("dishes") or []
    terms = [str(x) for x in raw] if isinstance(raw, list) else [str(raw)]
    dishes, unmatched = match_dishes(terms, items)
    if unmatched:
        notes.append(f"Not on the menu: {', '.join(unmatched)}.")
    return Intent(dishes=dishes, start=start, end=end, parser=parser, unmatched=unmatched, notes=notes)


# ----------------------------------------------------------------------------- Gemma prompts


def intent_prompt(question: str, items: list[str], today: date) -> str:
    return "\n".join(
        [
            "You route a restaurant owner's question to a forecasting tool. Reply with ONE JSON object and nothing else:",
            f'{{"tool": "{TOOL_NAME}", "arguments": {{"dishes": [string], "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD"}}}}',
            "Rules:",
            "- dishes: copy names EXACTLY from MENU. If the owner names an ingredient (e.g. paneer), list every menu dish that contains it. Empty list = all dishes.",
            "- dates: pick from CALENDAR only. One day -> start_date = end_date. 'weekend' = the next Saturday and Sunday. No date mentioned -> tomorrow.",
            "- Do not answer the question and do not invent numbers.",
            "",
            "CALENDAR:",
            *calendar_lines(today),
            "",
            "MENU:",
            json.dumps(items, ensure_ascii=False),
            "",
            "QUESTION:",
            question,
        ]
    )


def answer_prompt(question: str, facts: dict[str, Any]) -> str:
    return "\n".join(
        [
            "You answer a restaurant owner in India in 1–3 short, friendly sentences.",
            "Use ONLY the numbers in FACTS, exactly as written (portions). Never compute new numbers, never add weather or events.",
            "Recommend the prep_portions figure; you may mention the likely range. If FACTS has notes, mention them briefly.",
            "If the question is about an ingredient (e.g. kg of paneer), say the forecast is in portions and recipes are needed for kg.",
            'Reply with ONE JSON object: {"answer": string}',
            "",
            "FACTS:",
            json.dumps(facts, ensure_ascii=False),
            "",
            "QUESTION:",
            question,
        ]
    )


# ----------------------------------------------------------------------------- numbers come from TabPFN

NUM_RE = re.compile(r"(?<![\w.])\d+(?:[.,]\d+)?")


def numbers_in(text: str) -> list[float]:
    return [float(n.replace(",", "")) for n in NUM_RE.findall(text or "")]


def allowed_numbers(facts: dict[str, Any], question: str, items: list[str]) -> set[float]:
    allowed: set[float] = set()

    def walk(v: Any) -> None:
        if isinstance(v, bool):
            return
        if isinstance(v, (int, float)):
            allowed.update({round(float(v), 1), float(round(v)), float(math.floor(v)), float(math.ceil(v))})
        elif isinstance(v, str):
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
                y, m, d = v.split("-")
                allowed.update({float(y), float(int(m)), float(int(d))})
            else:
                allowed.update(numbers_in(v))
        elif isinstance(v, dict):
            for x in v.values():
                walk(x)
        elif isinstance(v, list):
            for x in v:
                walk(x)

    walk(facts)
    allowed.update(numbers_in(question))
    for i in items:
        allowed.update(numbers_in(i))
    allowed.update({float(n) for n in range(0, MAX_DAYS + 1)})  # "next 3 days", "1 dish"
    return allowed


def numbers_ok(text: str, allowed: set[float]) -> bool:
    return all(round(n, 1) in allowed for n in numbers_in(text))


def facts_for(intent: Intent, rows: list[dict[str, Any]], synthetic: bool) -> dict[str, Any]:
    per_dish: dict[str, dict[str, Any]] = {}
    for r in rows:
        d = per_dish.setdefault(r["item"], {"dish": r["item"], "days": [], "prep_portions_total": 0})
        d["days"].append({"date": r["date"], "weekday": WEEKDAYS[date.fromisoformat(r["date"]).weekday()].title(), "prep_portions": r["prep"], "likely_range": [round(r["low"]), round(r["high"])]})
        d["prep_portions_total"] += r["prep"]
    return {
        "from": intent.start.isoformat(),
        "to": intent.end.isoformat(),
        "data_is_synthetic_demo": synthetic,
        "dishes": list(per_dish.values()),
        "notes": intent.notes,
    }


def template_answer(facts: dict[str, Any]) -> str:
    if not facts["dishes"]:
        return "I couldn't find that dish on your menu, so there is nothing to forecast. " + " ".join(facts["notes"])
    span = facts["from"] if facts["from"] == facts["to"] else f"{facts['from']} to {facts['to']}"
    parts = []
    for d in facts["dishes"][:6]:
        if len(d["days"]) == 1:
            lo, hi = d["days"][0]["likely_range"]
            parts.append(f"{d['dish']}: prep {d['prep_portions_total']} portions (likely {lo}–{hi})")
        else:
            parts.append(f"{d['dish']}: prep {d['prep_portions_total']} portions in total")
    more = f" (+{len(facts['dishes']) - 6} more dishes in the table)" if len(facts["dishes"]) > 6 else ""
    text = f"For {span}: " + "; ".join(parts) + more + "."
    if facts["notes"]:
        text += " " + " ".join(facts["notes"])
    return text


def parse_intent(cfg: LlmConfig | None, question: str, items: list[str], today: date, gen: TextGen = generate_text) -> Intent:
    if cfg is None:
        return rule_intent(question, items, today)
    try:
        text, _ = gen(cfg, intent_prompt(question, items, today), purpose="intent")
        out = parse_model_json(text)
        args = out.get("arguments") if isinstance(out.get("arguments"), dict) else out
        if out.get("tool", TOOL_NAME) != TOOL_NAME:
            raise LlmError(f"unknown tool {out.get('tool')!r}")
        return validate_intent(args, items, today, "gemma")
    except LlmError as err:
        log.warning("intent parser fell back to rules: %s", err)
        intent = rule_intent(question, items, today)
        intent.notes.append("Gemma couldn't read the question; used the simple parser.")
        return intent


def word_answer(cfg: LlmConfig | None, question: str, facts: dict[str, Any], items: list[str], gen: TextGen = generate_text) -> tuple[str, str]:
    """Returns (answer, source) where source is 'gemma' or 'template'."""
    base = template_answer(facts)
    if cfg is None or not facts["dishes"]:
        return base, "template"
    try:
        text, _ = gen(cfg, answer_prompt(question, facts), purpose="answer")
        answer = str(parse_model_json(text).get("answer") or "").strip()[:600]
    except LlmError as err:
        log.warning("answer wording fell back to template: %s", err)
        return base, "template"
    if not answer or not numbers_ok(answer, allowed_numbers(facts, question, items)):
        log.warning("Gemma answer had numbers not in the forecast; using template")
        return base, "template"
    return answer, "gemma"
