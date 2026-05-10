from __future__ import annotations

"""Scheduled sync job for Find Help locations.

Run from cron/CI daily at 4am ET:
    0 4 * * * python -m backend.civic_api.jobs.sync_find_help_locations

For each registered fetcher: pull rows, upsert into find_help_locations
keyed by (source, external_id), soft-delete any rows from that source
not seen in the current run, and update the find_help_sources
attribution row with success or error. One fetcher failing does not
block the others.
"""

import argparse
import logging
import os
import sys

from ..find_help.fetchers.base import Fetcher, SourceNotYetImplementedError
from ..find_help.fetchers.feeding_america import FeedingAmericaFetcher
from ..find_help.fetchers.ma_pantries import MaPantriesFetcher
from ..find_help.fetchers.state_ma_dta import StateMaDtaFetcher
from ..find_help.fetchers.two_one_one import TwoOneOneFetcher
from ..find_help.fetchers.usda_directory import UsdaDirectoryFetcher
from ..find_help.geocoder import NominatimGeocoder
from ..find_help.models import SourceRunResult
from ..find_help.repository import (
    FindHelpRepository,
    InMemoryFindHelpRepository,
    SupabaseFindHelpRepository,
)

logger = logging.getLogger(__name__)


class FindHelpSyncJob:
    def __init__(self, repository: FindHelpRepository, fetchers: list[Fetcher]) -> None:
        self.repository = repository
        self.fetchers = fetchers

    def run(self) -> list[SourceRunResult]:
        results: list[SourceRunResult] = []
        for fetcher in self.fetchers:
            results.append(self._run_one(fetcher))
        return results

    def _run_one(self, fetcher: Fetcher) -> SourceRunResult:
        source = fetcher.source
        try:
            locations = fetcher.fetch()
        except SourceNotYetImplementedError as exc:
            logger.info("Skipping %s: %s", source.value, exc)
            self.repository.record_source_run(source, ok=True, error=f"skipped: {exc}")
            return SourceRunResult(source=source, ok=True, fetched_count=0, skipped_count=1)
        except Exception as exc:  # broad on purpose: one source must not break others
            logger.exception("Fetcher %s failed", source.value)
            self.repository.record_source_run(source, ok=False, error=str(exc))
            return SourceRunResult(source=source, ok=False, error=str(exc))

        seen_external_ids: set[str] = set()
        upserted = 0
        for location in locations:
            try:
                self.repository.upsert_location(location)
            except Exception as exc:
                logger.warning(
                    "Upsert failed for %s/%s: %s", source.value, location.external_id, exc
                )
                continue
            seen_external_ids.add(location.external_id)
            upserted += 1

        if seen_external_ids:
            self.repository.mark_source_locations_inactive(source, seen_external_ids)

        self.repository.record_source_run(source, ok=True)
        logger.info(
            "Sync complete for %s: upserted %d / fetched %d", source.value, upserted, len(locations)
        )
        return SourceRunResult(source=source, ok=True, fetched_count=upserted)


def build_default_fetchers() -> list[Fetcher]:
    geocoder = NominatimGeocoder()
    return [
        UsdaDirectoryFetcher(),
        StateMaDtaFetcher(geocoder=geocoder),
        MaPantriesFetcher(geocoder=geocoder),
        FeedingAmericaFetcher(),
        TwoOneOneFetcher(),
    ]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync Find Help directory locations")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run against an in-memory repository (no writes to Supabase). Useful for local checks.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

    repository: FindHelpRepository
    if args.dry_run:
        repository = InMemoryFindHelpRepository()
        logger.info("Dry-run mode: using in-memory repository.")
    else:
        repository = SupabaseFindHelpRepository()

    job = FindHelpSyncJob(repository=repository, fetchers=build_default_fetchers())
    results = job.run()

    failures = [r for r in results if not r.ok]
    for r in results:
        status = "ok" if r.ok else "FAIL"
        logger.info("%s %s fetched=%d skipped=%d error=%s",
                    status, r.source.value, r.fetched_count, r.skipped_count, r.error)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
