from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from backend.civic_api.find_help.fetchers.state_ma_dta import StateMaDtaFetcher
from backend.civic_api.find_help.models import ServiceType, Source


class _StubGeocoder:
    def __init__(self, responses: dict[str, tuple[float, float] | None]) -> None:
        self.responses = responses
        self.calls: list[str] = []

    def geocode(self, address: str) -> tuple[float, float] | None:
        self.calls.append(address)
        return self.responses.get(address)


def test_fetch_loads_seed_offices_without_calling_geocoder() -> None:
    geocoder = _StubGeocoder({})
    fetcher = StateMaDtaFetcher(geocoder=geocoder)
    locations = fetcher.fetch()

    assert len(locations) >= 20
    assert all(loc.source is Source.STATE_MA_DTA for loc in locations)
    assert all(loc.state == "MA" for loc in locations)
    assert all(loc.service_types == [ServiceType.SNAP_APPLICATION_HELP] for loc in locations)
    # All offices in the seed have pre-resolved coordinates, so the geocoder is never called.
    assert geocoder.calls == []


def test_fetch_uses_shared_dta_phone_for_every_office() -> None:
    fetcher = StateMaDtaFetcher()
    locations = fetcher.fetch()
    phones = {loc.phone for loc in locations}
    assert phones == {"+1-877-382-2363"}


def test_fetch_attaches_zip_and_city() -> None:
    fetcher = StateMaDtaFetcher()
    locations = fetcher.fetch()
    by_id = {loc.external_id: loc for loc in locations}
    boston = by_id["ma_dta:boston_park_square"]
    assert boston.city == "Boston"
    assert boston.zip == "02116"


def test_fetch_invokes_geocoder_for_entries_missing_coordinates(tmp_path: Path) -> None:
    fixture = _write_fixture(
        tmp_path,
        offices=[
            {"external_id": "ma_dta:test_geocoded", "name": "Test TAO", "city": "Worcester"},
        ],
    )
    geocoder = _StubGeocoder({"Test TAO, Worcester, MA": (42.26, -71.80)})
    locations = StateMaDtaFetcher(fixture_path=fixture, geocoder=geocoder).fetch()
    assert len(locations) == 1
    assert locations[0].latitude == pytest.approx(42.26)
    assert locations[0].longitude == pytest.approx(-71.80)
    assert geocoder.calls == ["Test TAO, Worcester, MA"]


def test_fetch_drops_entries_that_remain_uncoded(tmp_path: Path) -> None:
    fixture = _write_fixture(
        tmp_path,
        offices=[
            {"external_id": "ma_dta:no_coords", "name": "Unknown TAO", "city": "Atlantis"},
        ],
    )
    geocoder = _StubGeocoder({"Unknown TAO, Atlantis, MA": None})
    locations = StateMaDtaFetcher(fixture_path=fixture, geocoder=geocoder).fetch()
    assert locations == []


def test_fetch_skips_entries_missing_required_fields(tmp_path: Path) -> None:
    fixture = _write_fixture(
        tmp_path,
        offices=[
            {"external_id": "ma_dta:ok", "name": "OK TAO", "city": "Boston", "lat": 42.36, "lng": -71.06},
            {"name": "Missing ID", "city": "Boston", "lat": 42.36, "lng": -71.06},
            {"external_id": "ma_dta:no_name", "city": "Boston", "lat": 42.36, "lng": -71.06},
            {"external_id": "ma_dta:no_city", "name": "No City", "lat": 42.36, "lng": -71.06},
        ],
    )
    locations = StateMaDtaFetcher(fixture_path=fixture).fetch()
    assert [loc.external_id for loc in locations] == ["ma_dta:ok"]


def test_fetch_external_ids_are_stable_across_runs() -> None:
    fetcher = StateMaDtaFetcher()
    first = {loc.external_id for loc in fetcher.fetch()}
    second = {loc.external_id for loc in fetcher.fetch()}
    assert first == second
    assert all(eid.startswith("ma_dta:") for eid in first)


def _write_fixture(tmp_path: Path, offices: list[dict[str, Any]]) -> Path:
    payload = {
        "snapshot_date": "2026-05-10",
        "shared_phone": "+1-877-382-2363",
        "offices": offices,
    }
    path = tmp_path / "ma_dta.json"
    path.write_text(json.dumps(payload))
    return path
