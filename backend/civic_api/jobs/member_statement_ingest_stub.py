from __future__ import annotations

"""Phase-2 placeholder for member statement ingestion.

Future implementation should ingest from official member websites/RSS feeds and
populate `member_statement_sources` + derived statement signals.
"""

from dataclasses import dataclass


@dataclass
class MemberStatementSource:
    rep_id: str
    source_url: str
    source_kind: str  # website | rss


def ingest_member_statements(sources: list[MemberStatementSource]) -> dict[str, int]:
    # Stub only; intentionally non-blocking for V1 launch.
    return {"scanned_sources": len(sources), "ingested_items": 0}
