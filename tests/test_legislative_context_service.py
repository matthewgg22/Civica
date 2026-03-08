from __future__ import annotations

from backend.civic_api.models import (
    Ask,
    AssistantResolveRequest,
    BillContext,
    MemberProfile,
    RepContext,
    RepTarget,
    ScriptContext,
)
from backend.civic_api.repository import InMemoryCivicRepository
from backend.civic_api.service import CivicService


class FakeCongressClient:
    def __init__(
        self,
        *,
        sponsored: list[dict[str, str]] | None = None,
        cosponsored: list[dict[str, str]] | None = None,
        committees: list[dict[str, str]] | None = None,
    ) -> None:
        self._sponsored = sponsored or []
        self._cosponsored = cosponsored or []
        self._committees = committees or []

    def build_script_context(
        self,
        rep_name: str,
        rep_state: str | None,
        rep_chamber: str,
        bill_ref: tuple[int, str, int] | None,
    ) -> ScriptContext:
        return ScriptContext(
            member_profile=MemberProfile(
                bioguide_id="X000001",
                name=rep_name,
                party="I",
                state=rep_state,
                district=None,
                chamber=rep_chamber,
                phone=None,
                office_address=None,
                website=None,
                contact_form=None,
            ),
            bill_context=BillContext(
                congress=119,
                bill_type="s",
                bill_number=123,
                title="Test Bill",
                introduced_date="2026-01-15",
                origin_chamber="Senate",
                policy_area="Government Operations",
                summary="Test summary",
                latest_action_date="2026-02-01",
                latest_action_text="Placed on Senate calendar",
                summaries_ref=None,
                committees_ref=None,
                actions_ref=None,
                cosponsors_ref=None,
            ),
        )

    def get_member_sponsored_bills(self, bioguide_id: str, congress: int | None = None) -> list[dict[str, str]]:
        return list(self._sponsored)

    def get_member_cosponsored_bills(self, bioguide_id: str, congress: int | None = None) -> list[dict[str, str]]:
        return list(self._cosponsored)

    def get_member_committees(self, bioguide_id: str) -> list[dict[str, str]]:
        return list(self._committees)

    def get_bill_summary(self, congress: int, bill_type: str, bill_number: int) -> str | None:
        return "Test summary"


def _seed_senate_rep(repo: InMemoryCivicRepository, user_id: str) -> None:
    repo.seed_reps(
        user_id,
        [
            RepContext(
                rep_id="sen-test-1",
                rep_name="Test Senator",
                office_type="U.S. Senator",
                chamber="senate",
                district=None,
                state="CA",
                primary_phone_number="(202) 555-0102",
            )
        ],
    )


def test_cosponsor_signal_from_legislative_context() -> None:
    repo = InMemoryCivicRepository()
    _seed_senate_rep(repo, user_id="u-cosponsor")

    service = CivicService(
        repository=repo,
        congress_client=FakeCongressClient(cosponsored=[{"bill_id": "S.123"}]),
    )

    response = service.resolve_assistant(
        AssistantResolveRequest(
            user_id="u-cosponsor",
            concern_text="Please support this Senate bill.",
            selected_ask=Ask.SUPPORT,
            target_reps=[RepTarget.SENATE_1],
            optional_bill_ref="S.123",
        )
    )

    badges = response.call_briefs[0].relevance_badges
    assert "Cosponsors S.123" in badges


def test_committee_relevance_signal_from_legislative_context() -> None:
    repo = InMemoryCivicRepository()
    _seed_senate_rep(repo, user_id="u-committee")

    service = CivicService(
        repository=repo,
        congress_client=FakeCongressClient(
            committees=[{"committee_name": "Senate Judiciary Committee"}],
        ),
    )

    response = service.resolve_assistant(
        AssistantResolveRequest(
            user_id="u-committee",
            concern_text="Please start judiciary oversight hearings now.",
            selected_ask=Ask.SEEK_OVERSIGHT,
            target_reps=[RepTarget.SENATE_1],
            optional_bill_ref="S.123",
        )
    )

    badges = response.call_briefs[0].relevance_badges
    assert "Serves on relevant committee" in badges
