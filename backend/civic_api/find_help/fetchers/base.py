"""Fetcher base class for Find Help data sources."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..models import FindHelpLocation, Source


class Fetcher(ABC):
    """A fetcher pulls authoritative records from one upstream source.

    Implementations must be idempotent: re-running them against the same
    upstream snapshot should yield the same set of FindHelpLocation rows,
    each with a stable `external_id` so the repository can upsert by
    (source, external_id).
    """

    source: Source

    @abstractmethod
    def fetch(self) -> list[FindHelpLocation]:
        raise NotImplementedError


class SourceNotYetImplementedError(NotImplementedError):
    """Raised by stub fetchers that exist only to reserve the source slot.

    The orchestrator catches this specifically and skips with a warning,
    rather than treating it as an unexpected failure.
    """
