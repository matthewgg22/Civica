"""Feeding America food bank directory fetcher (stub).

V1 placeholder. The Feeding America network API requires partnership
credentials that have not yet been arranged. This stub keeps the source
registered in the orchestrator so the fetcher set is complete; it raises
SourceNotYetImplementedError so the orchestrator can log-and-skip
without treating the stub as a real failure.
"""

from __future__ import annotations

from ..models import FindHelpLocation, Source
from .base import Fetcher, SourceNotYetImplementedError


class FeedingAmericaFetcher(Fetcher):
    source = Source.FEEDING_AMERICA

    def fetch(self) -> list[FindHelpLocation]:
        raise SourceNotYetImplementedError(
            "Feeding America integration is pending partnership credentials; "
            "see docs/data_ingestion.md for the work item."
        )
