from __future__ import annotations

from backend.civic_api.context_ranker import ContextRanker
from backend.civic_api.models import (
    BillAction,
    BillCommitteeActivity,
    BillContext,
    BillCosponsor,
    CommitteeAssignment,
    MemberProfile,
    PoliticalEvent,
)


class FakeCongressClient:
    def __init__(self) -> None:
        self.senate_assignments = FakeSenateAssignmentsClient()

    def getMemberProfile(self, bioguideId: str) -> MemberProfile:
        return MemberProfile(
            bioguide_id=bioguideId,
            name="Catherine Cortez Masto",
            party="D",
            state="NV",
            district=None,
            chamber="senate",
            phone="(202) 224-3542",
            office_address=None,
            website="https://www.cortezmasto.senate.gov",
            contact_form=None,
            leadership_roles=["Senate Banking Committee"],
            terms=[{"congress": 119, "chamber": "Senate"}],
        )

    def getBillDetail(self, congress: int, billType: str, billNumber: int) -> BillContext:
        return BillContext(
            congress=congress,
            bill_type=billType,
            bill_number=billNumber,
            title="Test Bill",
            introduced_date="2026-01-10",
            origin_chamber="House" if billType.startswith("h") else "Senate",
            policy_area="Public Lands",
            summary="Sample summary",
            latest_action_date="2026-03-01",
            latest_action_text="Referred to committee",
            summaries_ref=None,
            committees_ref=None,
            actions_ref=None,
            cosponsors_ref=None,
        )

    def getBillActions(self, congress: int, billType: str, billNumber: int) -> list[BillAction]:
        return [
            BillAction(
                action_date="2026-03-01",
                text="Referred to committee",
                chamber="Senate" if billType.startswith("s") else "House",
            )
        ]

    def getBillCosponsors(self, congress: int, billType: str, billNumber: int) -> list[BillCosponsor]:
        return [
            BillCosponsor(
                bioguide_id="C001113",
                name="Catherine Cortez Masto",
                party="D",
                state="NV",
                sponsorship_date="2026-02-15",
            )
        ]

    def getBillCommittees(self, congress: int, billType: str, billNumber: int) -> list[BillCommitteeActivity]:
        return [
            BillCommitteeActivity(
                committee_name="Committee on Energy and Natural Resources",
                chamber="senate",
                activity_name="Referral",
                activity_date="2026-03-01",
            )
        ]

    def getCommitteeMeetings(self, congress: int, chamber: str) -> list[PoliticalEvent]:
        return [
            PoliticalEvent(
                event_type="committee_meeting",
                title="Nevada Water Infrastructure Oversight Hearing",
                date="2026-03-05",
                status="Scheduled",
                committees=["Committee on Energy and Natural Resources"],
                related_bills=["S.123"],
                ref_url="https://api.congress.gov/v3/committee-meeting/senate/119/1",
            ),
            PoliticalEvent(
                event_type="committee_meeting",
                title="General Federal Hearing",
                date="2026-03-05",
                status="Scheduled",
                committees=["Committee on Commerce, Science, and Transportation"],
                related_bills=[],
                ref_url="https://api.congress.gov/v3/committee-meeting/senate/119/2",
            ),
        ]

    def getDailyCongressionalRecordIssues(self, volumeNumber=None, issueNumber=None):
        return [
            PoliticalEvent(
                event_type="congressional_record_issue",
                title="Daily Congressional Record",
                date="2026-03-04",
                status="Published",
                ref_url="https://api.congress.gov/v3/daily-congressional-record/172/45",
            )
        ]

    def getDailyCongressionalRecordArticles(self, volumeNumber: int, issueNumber: int):
        return [
            PoliticalEvent(
                event_type="congressional_record_article",
                title="Statement on Nevada drought response",
                date="2026-03-04",
                status="Published",
                committees=[],
                related_bills=["S.123"],
                ref_url="https://api.congress.gov/v3/daily-congressional-record/172/45/articles/1",
            )
        ]

    def getCurrentSenators(self, congress: int, stateCode: str | None = None) -> list[MemberProfile]:
        return [self.getMemberProfile("C001113")]


class FakeSenateAssignmentsClient:
    def assignments_for_member(self, member_name: str, congress: int | None = None) -> list[CommitteeAssignment]:
        return [
            CommitteeAssignment(
                committee_name="Committee on Energy and Natural Resources",
                subcommittee_name=None,
                role="member",
                congress=congress,
                chamber="senate",
                member_name=member_name,
            )
        ]


class FakeSenateAssignmentsHealthcareClient:
    def assignments_for_member(self, member_name: str, congress: int | None = None) -> list[CommitteeAssignment]:
        return [
            CommitteeAssignment(
                committee_name="Committee on Finance",
                subcommittee_name=None,
                role="member",
                congress=congress,
                chamber="senate",
                member_name=member_name,
            )
        ]


def test_guardrail_prevents_cosponsor_recommendation_for_house_bill() -> None:
    ranker = ContextRanker(
        congress_client=FakeCongressClient(),
        senate_assignments_client=FakeSenateAssignmentsClient(),
    )

    result = ranker.rank_context(
        callerProfile={
            "state": "NV",
            "city": "Reno",
            "zip": "89501",
            "issuePriority": "support drought resilience",
            "identities": ["parent"],
            "occupation": "nurse",
        },
        targetSenator={"bioguideId": "C001113"},
        billIdentifier="H.R.123",
        issueTaxonomyTags=["environment"],
    )

    assert result["recommendedAsk"] != "cosponsor"


def test_personalization_prioritizes_state_relevant_event() -> None:
    ranker = ContextRanker(
        congress_client=FakeCongressClient(),
        senate_assignments_client=FakeSenateAssignmentsClient(),
    )

    result = ranker.rank_context(
        callerProfile={
            "state": "NV",
            "city": "Reno",
            "zip": "89501",
            "issuePriority": "water infrastructure",
            "personalStory": "Our neighborhood has repeated drought restrictions.",
            "identities": ["Latina"],
            "occupation": "teacher",
        },
        targetSenator={"bioguideId": "C001113"},
        billIdentifier="S.123",
        issueTaxonomyTags=["environment", "water"],
    )

    assert result["politicalEvents"]
    assert "Nevada" in result["politicalEvents"][0]["title"]
    assert any(item.startswith("state:NV") for item in result["personalizationEvidence"])


def test_issue_taxonomy_maps_to_relevant_committees_without_bill() -> None:
    ranker = ContextRanker(
        congress_client=FakeCongressClient(),
        senate_assignments_client=FakeSenateAssignmentsHealthcareClient(),
    )

    result = ranker.rank_context(
        callerProfile={
            "state": "NV",
            "city": "Reno",
            "zip": "89501",
            "issuePriority": "healthcare costs",
            "identities": [],
            "occupation": "teacher",
        },
        targetSenator={"bioguideId": "C001113"},
        billIdentifier=None,
        issueTaxonomyTags=["healthcare"],
    )

    assert "Committee on Finance" in result["relevantCommittees"]
    assert result["recommendedAsk"] == "seek_oversight"
