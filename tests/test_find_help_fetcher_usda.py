from __future__ import annotations

import json
from pathlib import Path

import pytest

from backend.civic_api.find_help.fetchers.usda_directory import UsdaDirectoryFetcher
from backend.civic_api.find_help.models import ServiceType, Source


def test_fetch_emits_one_location_per_state_in_fixture() -> None:
    fetcher = UsdaDirectoryFetcher()
    locations = fetcher.fetch()

    # Fixture covers MA + a representative national set for V1.
    states = {loc.state for loc in locations}
    assert "MA" in states
    assert len(locations) >= 5
    assert all(loc.source is Source.USDA for loc in locations)


def test_fetch_attaches_state_capital_coordinates() -> None:
    fetcher = UsdaDirectoryFetcher()
    locations = fetcher.fetch()
    by_state = {loc.state: loc for loc in locations}

    ma = by_state["MA"]
    assert ma.latitude is not None and ma.longitude is not None
    # Boston ~ 42.36, -71.06
    assert 42.0 < ma.latitude < 43.0
    assert -72.0 < ma.longitude < -70.0
    assert ma.city == "Boston"


def test_fetch_marks_service_type_as_snap_only() -> None:
    fetcher = UsdaDirectoryFetcher()
    locations = fetcher.fetch()
    assert all(loc.service_types == [ServiceType.SNAP_APPLICATION_HELP] for loc in locations)


def test_fetch_uses_stable_external_id_for_idempotent_upsert() -> None:
    fetcher = UsdaDirectoryFetcher()
    first_run = {loc.external_id for loc in fetcher.fetch()}
    second_run = {loc.external_id for loc in fetcher.fetch()}
    assert first_run == second_run
    assert all(eid.startswith("usda:") for eid in first_run)


def test_fetch_skips_malformed_state_codes(tmp_path: Path) -> None:
    fixture = tmp_path / "fixture.json"
    fixture.write_text(
        json.dumps(
            {
                "snapshot_date": "2026-05-10",
                "entries": [
                    {"state": "MA", "agency_name": "MA Agency", "capital_lat": 42.36, "capital_lng": -71.06},
                    {"state": "", "agency_name": "Empty State", "capital_lat": 0, "capital_lng": 0},
                    {"state": "ABC", "agency_name": "Invalid", "capital_lat": 0, "capital_lng": 0},
                ],
            }
        )
    )
    locations = UsdaDirectoryFetcher(fixture_path=fixture).fetch()
    assert [loc.state for loc in locations] == ["MA"]


def test_fetch_records_source_last_updated_from_snapshot() -> None:
    fetcher = UsdaDirectoryFetcher()
    locations = fetcher.fetch()
    # Every row should carry the same snapshot timestamp from the fixture.
    timestamps = {loc.source_last_updated_at for loc in locations}
    assert len(timestamps) == 1
    only = timestamps.pop()
    assert only is not None
    assert only.year == 2026


@pytest.mark.parametrize("missing_field", ["latitude", "longitude"])
def test_fetch_tolerates_missing_coordinates(tmp_path: Path, missing_field: str) -> None:
    entry = {"state": "MA", "agency_name": "MA Agency", "capital_lat": 42.36, "capital_lng": -71.06}
    if missing_field == "latitude":
        entry["capital_lat"] = None
    else:
        entry["capital_lng"] = None
    fixture = tmp_path / "fixture.json"
    fixture.write_text(json.dumps({"snapshot_date": "2026-05-10", "entries": [entry]}))
    locations = UsdaDirectoryFetcher(fixture_path=fixture).fetch()
    assert len(locations) == 1
    if missing_field == "latitude":
        assert locations[0].latitude is None
    else:
        assert locations[0].longitude is None
