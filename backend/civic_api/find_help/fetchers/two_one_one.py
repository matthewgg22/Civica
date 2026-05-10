"""211 food-assistance resource fetcher (stub).

V1 placeholder. 211 services are regionally fragmented (each 211
provider has its own data feed and licensing terms), so a single
national fetcher is out of scope. This stub reserves the source slot
in the registry; the orchestrator logs-and-skips it.
"""

from __future__ import annotations

from ..models import FindHelpLocation, Source
from .base import Fetcher, SourceNotYetImplementedError


class TwoOneOneFetcher(Fetcher):
    source = Source.TWO_ONE_ONE

    def fetch(self) -> list[FindHelpLocation]:
        raise SourceNotYetImplementedError(
            "211 integration is not built; regional 211 providers each have "
            "separate data agreements. See docs/data_ingestion.md."
        )
