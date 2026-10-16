"""Indian festival calendar features (movable festivals 2024–2027).

Dates live in ``data/festivals_in.json`` (sources cited there) and are shared with the Next.js app.
Two features per day:
  festival          1 on a festival day, else 0
  days_to_festival  days until the next festival (0 on the day), capped at FESTIVAL_HORIZON_DAYS
  next_festival     categorical code of that next festival (0 = none within the horizon)
"""

from __future__ import annotations

import json
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Iterable

FESTIVAL_HORIZON_DAYS = 30
DATA_FILE = Path(__file__).parent / "data" / "festivals_in.json"


@lru_cache(maxsize=1)
def _raw() -> dict:
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def festival_keys() -> list[str]:
    """Stable order; code = index + 1 (0 means 'no festival soon')."""
    return [f["key"] for f in _raw()["festivals"]]


def builtin_festivals() -> list[tuple[date, str]]:
    out: list[tuple[date, str]] = []
    for f in _raw()["festivals"]:
        for iso in f["dates"].values():
            out.append((date.fromisoformat(iso), f["key"]))
    return sorted(out)


def festival_code(key: str) -> int:
    keys = festival_keys()
    return keys.index(key) + 1 if key in keys else len(keys) + 1  # unknown (owner-entered) festivals share one code


def festival_features(d: date, festivals: Iterable[tuple[date, str]], horizon: int = FESTIVAL_HORIZON_DAYS) -> tuple[int, int, int]:
    """(festival, days_to_festival, next_festival_code) for one day."""
    best: tuple[int, str] | None = None
    for f_day, key in festivals:
        delta = (f_day - d).days
        if 0 <= delta <= horizon and (best is None or delta < best[0]):
            best = (delta, key)
    if best is None:
        return 0, horizon, 0
    return int(best[0] == 0), best[0], festival_code(best[1])
