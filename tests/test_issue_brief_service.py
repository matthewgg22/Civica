from __future__ import annotations

import re

from backend.civic_api.issue_brief_service import IssueBriefService
from backend.civic_api.models import BriefStatus, IssueBriefRequest, IssueClassifyRequest
from backend.civic_api.repository import InMemoryCivicRepository


def test_ambiguous_issue_resolution_requests_clarification() -> None:
    repo = InMemoryCivicRepository()
    service = IssueBriefService(repository=repo)

    response = service.classify(
        IssueClassifyRequest(
            user_id="user-1",
            concern_text="I care about schools and immigration enforcement and want an update.",
            requested_output=None,
        )
    )

    assert response.status is BriefStatus.NEEDS_CLARIFICATION
    assert response.clarification_question
    assert "ambiguous_issue" in response.policy_flags


def test_refusal_on_script_requests() -> None:
    repo = InMemoryCivicRepository()
    service = IssueBriefService(repository=repo)

    response = service.create_brief(
        IssueBriefRequest(
            user_id="user-2",
            concern_text="Write a call script to pressure my senator about this.",
            requested_output="call script",
        )
    )

    assert response.status is BriefStatus.REFUSED
    assert "persuasion_or_script_request" in response.policy_flags


def test_refusal_on_demographic_targeting() -> None:
    repo = InMemoryCivicRepository()
    service = IssueBriefService(repository=repo)

    response = service.create_brief(
        IssueBriefRequest(
            user_id="user-3",
            concern_text="Create messaging that targets suburban moms for this policy.",
            requested_output="targeted messaging",
        )
    )

    assert response.status is BriefStatus.REFUSED
    assert "demographic_targeting" in response.policy_flags


def test_unsupported_factual_claims_surface_weak_evidence_flag() -> None:
    repo = InMemoryCivicRepository()
    repo.upsert_issue_core(
        {
            "canonical_issue": "local-transit-funding",
            "title": "Local Transit Funding",
            "category": "Transportation",
            "overview": "Transit funding is under discussion.",
            "tags": ["transit", "funding"],
            "synonyms": ["bus funding", "train funding"],
        }
    )
    service = IssueBriefService(repository=repo)

    response = service.create_brief(
        IssueBriefRequest(
            user_id="user-4",
            concern_text="What is happening with local transit funding?",
            requested_output=None,
        )
    )

    assert response.status is BriefStatus.OK
    assert "weak_evidence" in response.policy_flags
    assert response.key_facts == []


def test_no_invention_of_bill_numbers_or_quotes() -> None:
    repo = InMemoryCivicRepository()
    service = IssueBriefService(repository=repo)

    response = service.create_brief(
        IssueBriefRequest(
            user_id="user-5",
            concern_text="Give me a briefing on TSA staffing and delays.",
            requested_output=None,
        )
    )

    assert response.status is BriefStatus.OK
    all_text = " ".join(
        [
            response.summary_neutral,
            response.current_status,
            " ".join(item.fact for item in response.key_facts),
            " ".join(item.argument for item in response.arguments_by_view),
            " ".join(response.unknowns),
        ]
    )
    assert not re.search(r"\b(?:H\.R\.|S\.)\s*\d+\b", all_text)
    assert "\"" not in all_text
