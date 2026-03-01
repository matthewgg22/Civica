from __future__ import annotations

from backend.civic_api.models import Ask, AssistantResolveRequest, CallLogRequest, CallOutcome, RepContext, RepTarget
from backend.civic_api.relevance import enrich_house_vote_signal, reason_badges_from_signals, score_rep_issue
from backend.civic_api.repository import InMemoryCivicRepository
from backend.civic_api.service import CivicService


def _seed_repo_with_federal_reps(repo: InMemoryCivicRepository, user_id: str) -> None:
    repo.seed_reps(
        user_id,
        [
            RepContext(
                rep_id="house-ca-12",
                rep_name="House Member",
                office_type="U.S. Representative",
                chamber="house",
                district="CA-12",
                state="CA",
                primary_phone_number="(202) 555-0101",
            ),
            RepContext(
                rep_id="sen-ca-1",
                rep_name="Senator One",
                office_type="U.S. Senator",
                chamber="senate",
                district=None,
                state="CA",
                primary_phone_number="(202) 555-0102",
            ),
            RepContext(
                rep_id="sen-ca-2",
                rep_name="Senator Two",
                office_type="U.S. Senator",
                chamber="senate",
                district=None,
                state="CA",
                primary_phone_number="(202) 555-0103",
            ),
        ],
    )


def test_resolve_schema_includes_required_keys() -> None:
    repo = InMemoryCivicRepository()
    _seed_repo_with_federal_reps(repo, user_id="u-1")
    service = CivicService(repository=repo)

    request = AssistantResolveRequest(
        user_id="u-1",
        concern_text="I am concerned about transportation safety grants in my district.",
        selected_ask=Ask.SUPPORT,
        target_reps=[RepTarget.HOUSE, RepTarget.SENATE_1],
        optional_bill_ref="H.R.123",
    )

    response = service.resolve_assistant(request).to_dict()

    assert set(response.keys()) == {
        "issue_id",
        "issue_title",
        "issue_summary",
        "resolved_entities",
        "call_briefs",
    }
    assert response["resolved_entities"]["bills"] == ["H.R.123"]
    assert len(response["call_briefs"]) == 2

    brief = response["call_briefs"][0]
    for key in [
        "brief_id",
        "rep_id",
        "rep_name",
        "office_type",
        "primary_phone_number",
        "local_office_phone_number",
        "relevance_badges",
        "related_bills",
        "related_committees",
        "live_script",
        "voicemail_script",
        "talking_points",
        "issue_id",
        "rep_slot",
    ]:
        assert key in brief


def test_empty_no_signal_reason_defaults_to_no_public_position() -> None:
    rep = RepContext(
        rep_id="house-x",
        rep_name="Rep X",
        office_type="U.S. Representative",
        chamber="house",
        district="XX-1",
        state="XX",
        primary_phone_number="(202) 555-0199",
    )

    scored = score_rep_issue(
        rep=rep,
        issue_title="General constituent concern",
        bill_ref=None,
        sponsored_bills=[],
        cosponsored_bills=[],
        committees=[],
        latest_action_date=None,
        latest_action_text=None,
        summary=None,
    )

    assert scored.signals.is_sponsor is False
    assert scored.signals.is_cosponsor is False
    assert scored.reason_badges == ["No public position found"]


def test_house_only_vote_enrichment() -> None:
    house_rep = RepContext(
        rep_id="h-1",
        rep_name="House Rep",
        office_type="U.S. Representative",
        chamber="house",
        district="CA-1",
        state="CA",
        primary_phone_number="(202) 555-0101",
    )
    senate_rep = RepContext(
        rep_id="s-1",
        rep_name="Sen Rep",
        office_type="U.S. Senator",
        chamber="senate",
        district=None,
        state="CA",
        primary_phone_number="(202) 555-0102",
    )

    votes = [{"rep_id": "h-1", "position": "Yea"}]
    assert enrich_house_vote_signal(house_rep, votes) is True
    assert enrich_house_vote_signal(senate_rep, votes) is False


def test_log_call_persists_history_group() -> None:
    repo = InMemoryCivicRepository()
    _seed_repo_with_federal_reps(repo, user_id="u-2")
    service = CivicService(repository=repo)

    resolved = service.resolve_assistant(
        AssistantResolveRequest(
            user_id="u-2",
            concern_text="Please prioritize wildfire mitigation planning.",
            selected_ask=Ask.SEEK_OVERSIGHT,
            target_reps=[RepTarget.HOUSE],
            optional_bill_ref=None,
        )
    )

    brief = resolved.call_briefs[0]
    service.log_call(
        CallLogRequest(
            user_id="u-2",
            rep_id=brief.rep_id,
            issue_id=brief.issue_id,
            brief_id=brief.brief_id,
            outcome=CallOutcome.VOICEMAIL,
            staffer_position=None,
            notes="Left concise message",
        )
    )

    history = service.history("u-2").to_dict()["history"]
    assert len(history) == 1
    assert history[0]["issue_id"] == brief.issue_id
    assert history[0]["logs"][0]["outcome"] == "voicemail"
