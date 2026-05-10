"""Curated Massachusetts food pantry directory fetcher.

V1 ships a hand-curated snapshot of public food pantries across MA
sourced from Greater Boston Food Bank, Worcester County Food Bank,
Food for Free, Project Bread, and town/parish pantry registries.
Coordinates are pre-resolved at city centroid for offline runs; the
geocoder fills in any new entries added without lat/lng.

Service type: FOOD_ASSISTANCE. Hours rotate often, so we expose the
phone and the project-wide "call ahead" disclaimer rather than baking
specific opening hours into the snapshot.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from ..geocoder import NominatimGeocoder
from ..models import FindHelpLocation, ServiceType, Source
from .base import Fetcher

FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "ma_pantries_seed.json"


class MaPantriesFetcher(Fetcher):
    source = Source.MA_PANTRIES

    def __init__(
        self,
        fixture_path: Path = FIXTURE_PATH,
        geocoder: NominatimGeocoder | None = None,
    ) -> None:
        self.fixture_path = fixture_path
        self.geocoder = geocoder

    def fetch(self) -> list[FindHelpLocation]:
        with self.fixture_path.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)

        snapshot_date = _parse_date(payload.get("snapshot_date"))
        pantries = payload.get("pantries") or []

        locations: list[FindHelpLocation] = []
        for pantry in pantries:
            external_id = str(pantry.get("external_id", "")).strip()
            name = str(pantry.get("name", "")).strip()
            city = pantry.get("city")
            if not external_id or not name or not city:
                continue

            lat = _as_float(pantry.get("lat"))
            lng = _as_float(pantry.get("lng"))
            if (lat is None or lng is None) and self.geocoder is not None:
                resolved = self.geocoder.geocode(f"{name}, {city}, MA")
                if resolved is not None:
                    lat, lng = resolved
            if lat is None or lng is None:
                continue

            languages = pantry.get("languages") or []
            if not isinstance(languages, list):
                languages = []

            locations.append(
                FindHelpLocation(
                    external_id=external_id,
                    source=Source.MA_PANTRIES,
                    name=name,
                    state="MA",
                    service_types=[ServiceType.FOOD_ASSISTANCE],
                    city=city,
                    zip=pantry.get("zip"),
                    latitude=lat,
                    longitude=lng,
                    phone=pantry.get("phone"),
                    languages_json=[str(code) for code in languages],
                    source_last_updated_at=snapshot_date,
                    notes=(
                        f"Food pantry in {pantry.get('neighborhood') or city}. "
                        "Hours and walk-in availability vary; call ahead to confirm."
                    ),
                )
            )
        return locations


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _as_float(value) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
