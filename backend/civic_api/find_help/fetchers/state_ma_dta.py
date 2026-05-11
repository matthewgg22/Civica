"""Massachusetts DTA Transitional Assistance Office fetcher.

Loads a checked-in snapshot of MA DTA office locations (manually compiled
from https://www.mass.gov/orgs/department-of-transitional-assistance/locations).
Entries arrive with pre-resolved city-level coordinates so V1 runs offline.
For any entry that ships without lat/lng, the geocoder fills it in.
Entries that still lack coordinates after geocoding are dropped (per the
data validation rule: no geocoded coordinates means excluded from active
set).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from ..geocoder import NominatimGeocoder
from ..models import FindHelpLocation, ServiceType, Source
from .base import Fetcher

FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "ma_dta_offices.json"


class StateMaDtaFetcher(Fetcher):
    source = Source.STATE_MA_DTA

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
        shared_phone = payload.get("shared_phone")
        offices = payload.get("offices") or []

        locations: list[FindHelpLocation] = []
        for office in offices:
            external_id = str(office.get("external_id", "")).strip()
            name = str(office.get("name", "")).strip()
            city = office.get("city")
            if not external_id or not name or not city:
                continue

            lat = _as_float(office.get("lat"))
            lng = _as_float(office.get("lng"))
            if (lat is None or lng is None) and self.geocoder is not None:
                resolved = self.geocoder.geocode(f"{name}, {city}, MA")
                if resolved is not None:
                    lat, lng = resolved
            if lat is None or lng is None:
                continue

            locations.append(
                FindHelpLocation(
                    external_id=external_id,
                    source=Source.STATE_MA_DTA,
                    name=name,
                    state="MA",
                    service_types=[ServiceType.SNAP_APPLICATION_HELP],
                    city=city,
                    zip=office.get("zip"),
                    latitude=lat,
                    longitude=lng,
                    phone=shared_phone,
                    website_url="https://www.mass.gov/orgs/department-of-transitional-assistance/locations",
                    source_last_updated_at=snapshot_date,
                    notes=(
                        f"DTA Transitional Assistance Office in {office.get('neighborhood') or city}. "
                        "Call the DTA Assistance Line before visiting; hours and walk-in availability vary."
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
