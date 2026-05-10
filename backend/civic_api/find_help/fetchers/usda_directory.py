"""USDA SNAP State Directory of Resources fetcher.

The USDA directory is a state-level resource list (one record per state)
not a per-office list. We load a checked-in JSON snapshot of the directory
and emit one FindHelpLocation per state, anchored at the state capital so
the row appears on the map as a baseline "where to apply in your state"
entry. Re-snapshot the JSON when the upstream page changes (low-churn
data; historically updated only a few times per year).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from ..models import FindHelpLocation, ServiceType, Source
from .base import Fetcher

FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "usda_snap_state_directory.json"


class UsdaDirectoryFetcher(Fetcher):
    source = Source.USDA

    def __init__(self, fixture_path: Path = FIXTURE_PATH) -> None:
        self.fixture_path = fixture_path

    def fetch(self) -> list[FindHelpLocation]:
        with self.fixture_path.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)

        snapshot_date = _parse_date(payload.get("snapshot_date"))
        entries = payload.get("entries") or []

        locations: list[FindHelpLocation] = []
        for entry in entries:
            state = str(entry.get("state", "")).strip().upper()
            if len(state) != 2:
                continue
            locations.append(
                FindHelpLocation(
                    external_id=f"usda:{state}",
                    source=Source.USDA,
                    name=str(entry.get("agency_name", f"SNAP Agency – {state}")),
                    state=state,
                    service_types=[ServiceType.SNAP_APPLICATION_HELP],
                    city=entry.get("capital_city"),
                    phone=entry.get("hotline"),
                    website_url=entry.get("website"),
                    latitude=_as_float(entry.get("capital_lat")),
                    longitude=_as_float(entry.get("capital_lng")),
                    notes="State SNAP agency hotline. Call before visiting; this entry marks the state capital, not a local office.",
                    source_last_updated_at=snapshot_date,
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
