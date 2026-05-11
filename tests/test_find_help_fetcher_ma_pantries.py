from __future__ import annotations

import json
from pathlib import Path

import pytest

from backend.civic_api.find_help.fetchers.ma_pantries import MaPantriesFetcher
from backend.civic_api.find_help.models import ServiceType, Source


def test_seed_load_returns_at_least_twenty_pantries() -> None:
    locations = MaPantriesFetcher().fetch()
    assert len(locations) >= 20
    assert all(loc.source is Source.MA_PANTRIES for loc in locations)
    assert all(loc.state == "MA" for loc in locations)
    assert all(loc.service_types == [ServiceType.FOOD_ASSISTANCE] for loc in locations)


def test_languages_propagate_when_present() -> None:
    by_id = {loc.external_id: loc for loc in MaPantriesFetcher().fetch()}
    project_bread = by_id["ma_pantry:project_bread"]
    # FoodSource Hotline supports a broad set; check a non-trivial subset.
    assert set(project_bread.languages_json) >= {"en", "es"}


def test_external_ids_all_namespaced() -> None:
    locations = MaPantriesFetcher().fetch()
    assert all(loc.external_id.startswith("ma_pantry:") for loc in locations)


def test_drops_entries_without_required_fields(tmp_path: Path) -> None:
    fixture = tmp_path / "pantries.json"
    fixture.write_text(
        json.dumps(
            {
                "snapshot_date": "2026-05-10",
                "pantries": [
                    {"external_id": "ma_pantry:ok", "name": "OK Pantry", "city": "Boston", "lat": 42.36, "lng": -71.06},
                    {"name": "Missing ID", "city": "Boston", "lat": 42.36, "lng": -71.06},
                    {"external_id": "ma_pantry:no_name", "city": "Boston", "lat": 42.36, "lng": -71.06},
                ],
            }
        )
    )
    locations = MaPantriesFetcher(fixture_path=fixture).fetch()
    assert [loc.external_id for loc in locations] == ["ma_pantry:ok"]


def test_languages_default_to_empty_when_omitted(tmp_path: Path) -> None:
    fixture = tmp_path / "pantries.json"
    fixture.write_text(
        json.dumps(
            {
                "snapshot_date": "2026-05-10",
                "pantries": [
                    {"external_id": "ma_pantry:x", "name": "X", "city": "Boston", "lat": 42.36, "lng": -71.06},
                    {
                        "external_id": "ma_pantry:y",
                        "name": "Y",
                        "city": "Boston",
                        "lat": 42.36,
                        "lng": -71.06,
                        "languages": "not-a-list",
                    },
                ],
            }
        )
    )
    locations = MaPantriesFetcher(fixture_path=fixture).fetch()
    assert all(loc.languages_json == [] for loc in locations)


def test_phone_propagates_per_pantry() -> None:
    by_id = {loc.external_id: loc for loc in MaPantriesFetcher().fetch()}
    gbfb = by_id["ma_pantry:gbfb_main"]
    assert gbfb.phone is not None
    assert gbfb.phone.startswith("+1-")


def test_source_last_updated_attached() -> None:
    locations = MaPantriesFetcher().fetch()
    assert all(loc.source_last_updated_at is not None for loc in locations)
    assert locations[0].source_last_updated_at.year == 2026
