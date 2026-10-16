from __future__ import annotations

from datetime import date as Date

from pydantic import BaseModel, Field, field_validator


class HistoryRow(BaseModel):
    """One (restaurant-local date, hour, dish) with the quantity sold — exported by MenuPage."""

    date: Date
    hour: int = Field(ge=0, le=23)
    item: str = Field(min_length=1, max_length=120)
    category: str = Field(default="Other", max_length=120)
    qty: float = Field(ge=0, le=100_000)
    price: float = Field(default=0, ge=0, le=10_000_000)


class Restaurant(BaseModel):
    name: str = Field(default="Restaurant", max_length=120)
    timezone: str = Field(default="Asia/Kolkata", max_length=64)
    currency: str = Field(default="INR", max_length=8)


class Festival(BaseModel):
    date: Date
    key: str = Field(min_length=1, max_length=40)


class HistoryPayload(BaseModel):
    """Fields shared by every endpoint that learns from a restaurant's order history."""

    restaurant: Restaurant = Restaurant()
    history: list[HistoryRow] = Field(max_length=60_000)
    holidays: list[Date] = Field(default_factory=list, max_length=400)
    # Movable festivals as features. Omitted = the agent's built-in calendar (app/data/festivals_in.json).
    festivals: list[Festival] | None = Field(default=None, max_length=400)
    synthetic: bool = False

    @field_validator("history")
    @classmethod
    def _not_empty(cls, v: list[HistoryRow]) -> list[HistoryRow]:
        if not v:
            raise ValueError("history is empty")
        return v

    def festival_pairs(self) -> list[tuple[Date, str]] | None:
        return None if self.festivals is None else [(f.date, f.key) for f in self.festivals]


class PrepRequest(HistoryPayload):
    start_date: Date
    horizon_days: int = Field(default=3, ge=1, le=7)


class BacktestRequest(HistoryPayload):
    holdout_days: int = Field(default=14, ge=7, le=28)


class AskRequest(HistoryPayload):
    question: str = Field(min_length=2, max_length=300)
    today: Date  # restaurant-local date; forecasts start tomorrow
