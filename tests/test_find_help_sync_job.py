from __future__ import annotations

from typing import Iterable

from backend.civic_api.find_help.fetchers.base import Fetcher, SourceNotYetImplementedError
from backend.civic_api.find_help.models import FindHelpLocation, ServiceType, Source
from backend.civic_api.find_help.repository import InMemoryFindHelpRepository
from backend.civic_api.jobs.sync_find_help_locations import FindHelpSyncJob


def _loc(external_id: str, source: Source) -> FindHelpLocation:
    return FindHelpLocation(
        external_id=external_id,
        source=source,
        name=external_id,
        state="MA",
        service_types=[ServiceType.SNAP_APPLICATION_HELP],
        latitude=42.0,
        longitude=-71.0,
    )


class _ListFetcher(Fetcher):
    def __init__(self, source: Source, locations: Iterable[FindHelpLocation]) -> None:
        self.source = source
        self._locations = list(locations)

    def fetch(self) -> list[FindHelpLocation]:
        return list(self._locations)


class _ExplodingFetcher(Fetcher):
    def __init__(self, source: Source) -> None:
        self.source = source

    def fetch(self) -> list[FindHelpLocation]:
        raise RuntimeError("boom")


class _StubNotImplementedFetcher(Fetcher):
    def __init__(self, source: Source) -> None:
        self.source = source

    def fetch(self) -> list[FindHelpLocation]:
        raise SourceNotYetImplementedError("stub")


def test_run_upserts_all_fetched_locations() -> None:
    repo = InMemoryFindHelpRepository()
    job = FindHelpSyncJob(
        repository=repo,
        fetchers=[
            _ListFetcher(Source.USDA, [_loc("usda:MA", Source.USDA), _loc("usda:CA", Source.USDA)]),
            _ListFetcher(
                Source.STATE_MA_DTA,
                [_loc("ma_dta:boston", Source.STATE_MA_DTA)],
            ),
        ],
    )
    results = job.run()

    assert all(r.ok for r in results)
    active = {(row["source"], row["external_id"]) for row in repo.list_active()}
    assert active == {
        ("usda", "usda:MA"),
        ("usda", "usda:CA"),
        ("state_ma_dta", "ma_dta:boston"),
    }


def test_run_soft_deletes_rows_no_longer_in_source() -> None:
    repo = InMemoryFindHelpRepository()
    # Seed with three USDA rows.
    seed_fetcher = _ListFetcher(
        Source.USDA,
        [_loc("usda:MA", Source.USDA), _loc("usda:CA", Source.USDA), _loc("usda:NY", Source.USDA)],
    )
    FindHelpSyncJob(repository=repo, fetchers=[seed_fetcher]).run()

    # Re-run with NY removed: NY should be soft-deleted.
    rerun_fetcher = _ListFetcher(
        Source.USDA, [_loc("usda:MA", Source.USDA), _loc("usda:CA", Source.USDA)]
    )
    FindHelpSyncJob(repository=repo, fetchers=[rerun_fetcher]).run()

    active = {row["external_id"] for row in repo.list_active(Source.USDA)}
    assert active == {"usda:MA", "usda:CA"}
    by_id = {row["external_id"]: row for row in repo.list_all()}
    assert by_id["usda:NY"]["active"] is False


def test_run_continues_after_one_fetcher_fails() -> None:
    repo = InMemoryFindHelpRepository()
    job = FindHelpSyncJob(
        repository=repo,
        fetchers=[
            _ExplodingFetcher(Source.USDA),
            _ListFetcher(Source.MA_PANTRIES, [_loc("ma_pantry:x", Source.MA_PANTRIES)]),
        ],
    )
    results = job.run()

    assert [r.ok for r in results] == [False, True]
    assert results[0].error == "boom"
    assert {row["external_id"] for row in repo.list_active(Source.MA_PANTRIES)} == {"ma_pantry:x"}


def test_run_treats_stub_fetcher_as_skip_not_failure() -> None:
    repo = InMemoryFindHelpRepository()
    job = FindHelpSyncJob(
        repository=repo,
        fetchers=[_StubNotImplementedFetcher(Source.FEEDING_AMERICA)],
    )
    results = job.run()
    assert results[0].ok is True
    assert results[0].skipped_count == 1


def test_run_records_source_run_for_every_fetcher() -> None:
    repo = InMemoryFindHelpRepository()
    job = FindHelpSyncJob(
        repository=repo,
        fetchers=[
            _ListFetcher(Source.USDA, [_loc("usda:MA", Source.USDA)]),
            _ExplodingFetcher(Source.STATE_MA_DTA),
            _StubNotImplementedFetcher(Source.FEEDING_AMERICA),
        ],
    )
    job.run()

    sources_recorded = [r["source"] for r in repo.source_runs]
    assert sources_recorded == ["usda", "state_ma_dta", "feeding_america"]
    assert repo.source_runs[0]["ok"] is True
    assert repo.source_runs[1]["ok"] is False
    assert repo.source_runs[1]["error"] == "boom"
    assert repo.source_runs[2]["ok"] is True
    assert "skipped" in (repo.source_runs[2].get("error") or "")
