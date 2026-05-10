from __future__ import annotations

from datetime import datetime, timezone

from backend.civic_api.find_help.models import FindHelpLocation, ServiceType, Source
from backend.civic_api.find_help.repository import InMemoryFindHelpRepository


def _make_location(external_id: str, source: Source = Source.STATE_MA_DTA) -> FindHelpLocation:
    return FindHelpLocation(
        external_id=external_id,
        source=source,
        name=f"Office {external_id}",
        state="MA",
        service_types=[ServiceType.SNAP_APPLICATION_HELP],
        city="Boston",
        latitude=42.36,
        longitude=-71.06,
    )


def test_upsert_inserts_then_overwrites() -> None:
    repo = InMemoryFindHelpRepository()

    repo.upsert_location(_make_location("a1"))
    first = repo.list_active(Source.STATE_MA_DTA)
    assert len(first) == 1
    assert first[0]["name"] == "Office a1"

    # Re-upsert with a changed name; row count must stay at 1.
    updated = _make_location("a1")
    updated.name = "Office a1 (renamed)"
    repo.upsert_location(updated)

    rows = repo.list_active(Source.STATE_MA_DTA)
    assert len(rows) == 1
    assert rows[0]["name"] == "Office a1 (renamed)"


def test_mark_inactive_soft_deletes_unseen_rows() -> None:
    repo = InMemoryFindHelpRepository()
    repo.upsert_location(_make_location("a1"))
    repo.upsert_location(_make_location("a2"))
    repo.upsert_location(_make_location("a3"))

    deactivated = repo.mark_source_locations_inactive(
        Source.STATE_MA_DTA, seen_external_ids={"a1", "a3"}
    )
    assert deactivated == 1

    active = {row["external_id"] for row in repo.list_active(Source.STATE_MA_DTA)}
    assert active == {"a1", "a3"}

    # a2 still in the underlying store, just flagged inactive.
    all_rows = {(row["external_id"], row["active"]) for row in repo.list_all()}
    assert ("a2", False) in all_rows


def test_mark_inactive_does_not_cross_sources() -> None:
    repo = InMemoryFindHelpRepository()
    repo.upsert_location(_make_location("a1", Source.STATE_MA_DTA))
    repo.upsert_location(_make_location("b1", Source.MA_PANTRIES))

    repo.mark_source_locations_inactive(Source.STATE_MA_DTA, seen_external_ids={"a1"})

    # MA_PANTRIES row must remain active because we only swept STATE_MA_DTA.
    pantries = repo.list_active(Source.MA_PANTRIES)
    assert len(pantries) == 1
    assert pantries[0]["external_id"] == "b1"


def test_record_source_run_appends() -> None:
    repo = InMemoryFindHelpRepository()
    repo.record_source_run(Source.USDA, ok=True, ran_at=datetime(2026, 5, 10, tzinfo=timezone.utc))
    repo.record_source_run(Source.USDA, ok=False, error="boom")

    runs = repo.source_runs
    assert len(runs) == 2
    assert runs[0]["ok"] is True
    assert runs[1]["error"] == "boom"


def test_serialization_includes_service_types_and_languages() -> None:
    repo = InMemoryFindHelpRepository()
    loc = FindHelpLocation(
        external_id="multi",
        source=Source.MA_PANTRIES,
        name="Multilingual Pantry",
        state="MA",
        service_types=[ServiceType.FOOD_ASSISTANCE, ServiceType.SNAP_APPLICATION_HELP],
        languages_json=["en", "es", "ht"],
        latitude=42.36,
        longitude=-71.06,
    )
    repo.upsert_location(loc)
    row = repo.list_active(Source.MA_PANTRIES)[0]
    assert row["service_types"] == ["food_assistance", "snap_application_help"]
    assert row["languages_json"] == ["en", "es", "ht"]
