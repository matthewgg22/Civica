from __future__ import annotations

"""Scheduled sync job for Congress.gov data.

Run this from cron/CI (e.g., every 6 hours) to prefetch and cache member + bill
metadata, preventing expensive mobile-triggered fanout.
"""

import argparse

from ..congress_client import CongressGovClient
from ..repository import CivicRepository, InMemoryCivicRepository


class CongressSyncJob:
    def __init__(self, repository: CivicRepository, client: CongressGovClient) -> None:
        self.repository = repository
        self.client = client

    def run(self, states: list[str]) -> None:
        for state in states:
            members = self.client.get_active_members(state=state)
            for member in members:
                # Phase-1: keep sync lightweight and non-blocking. Detailed ingestion of
                # statements and full voting history is handled in phase-2 jobs.
                self.repository.upsert_rep_issue_signal(
                    {
                        "issue_id": "sync:member_snapshot",
                        "rep_id": member.get("bioguide_id") or member.get("name"),
                        "rep_slot": "unknown",
                        "is_sponsor": False,
                        "is_cosponsor": False,
                        "committee_relevance": False,
                        "chamber_match": False,
                        "house_vote_signal": False,
                        "public_statement_signal": False,
                        "latest_action_date": None,
                        "latest_action_text": "member_sync",
                        "summary": member.get("name"),
                        "reason_badges": ["member_sync"],
                    }
                )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync cached Congress member metadata")
    parser.add_argument("--states", default="CA,NY,TX,FL", help="Comma-separated state codes")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    states = [token.strip().upper() for token in args.states.split(",") if token.strip()]
    repository = InMemoryCivicRepository()
    client = CongressGovClient()
    CongressSyncJob(repository=repository, client=client).run(states)


if __name__ == "__main__":
    main()
