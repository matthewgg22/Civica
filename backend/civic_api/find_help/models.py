"""Dataclass models for Find Help directory rows."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class ServiceType(str, Enum):
    SNAP_APPLICATION_HELP = "snap_application_help"
    FOOD_ASSISTANCE = "food_assistance"
    BOTH = "both"


class Source(str, Enum):
    USDA = "usda"
    STATE_MA_DTA = "state_ma_dta"
    MA_PANTRIES = "ma_pantries"
    FEEDING_AMERICA = "feeding_america"
    TWO_ONE_ONE = "two_one_one"


@dataclass
class FindHelpLocation:
    external_id: str
    source: Source
    name: str
    state: str
    service_types: list[ServiceType]
    address_line_1: str | None = None
    address_line_2: str | None = None
    city: str | None = None
    zip: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    phone: str | None = None
    email: str | None = None
    website_url: str | None = None
    hours_json: dict = field(default_factory=dict)
    languages_json: list[str] = field(default_factory=list)
    notes: str | None = None
    source_last_updated_at: datetime | None = None


@dataclass
class SourceRunResult:
    source: Source
    ok: bool
    fetched_count: int = 0
    skipped_count: int = 0
    error: str | None = None
