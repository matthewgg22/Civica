"""Ask-Selector deterministic priority tests.

Each test sets a PartialHousehold to a specific shape and asserts that
the next-topic the selector picks matches the expected priority order.
"""
from __future__ import annotations

from decimal import Decimal

from backend.civic_api.snap.pipeline.ask_selector import pick_next_topic
from backend.civic_api.snap.pipeline.schemas import PartialHousehold, QuestionTopic
from backend.civic_api.snap.rules.interfaces import (
    AssetFacts,
    CitizenshipStatus,
    ExpenseFacts,
    HouseholdMember,
    IncomeFacts,
    IncomeSource,
    StudentExemption,
    StudentStatus,
    SUATier,
)


def _applicant(**kwargs) -> HouseholdMember:
    """Build an applicant for ask_selector priority tests.

    Default student_status is NOT_STUDENT (i.e. user has answered the
    student question). Tests that want to verify the *unasked* state
    should pass `student_status=StudentStatus.UNKNOWN` explicitly.
    """
    defaults = {
        "member_id": "applicant",
        "age": 32,
        "is_applicant": True,
        "citizenship": CitizenshipStatus.US_CITIZEN,
        "student_status": StudentStatus.NOT_STUDENT,
        "student_exemption": StudentExemption.NONE,
    }
    defaults.update(kwargs)
    return HouseholdMember(**defaults)


class TestPriorityOrder:
    def test_empty_state_picks_household_state(self):
        assert pick_next_topic(PartialHousehold()).next_topic == QuestionTopic.HOUSEHOLD_STATE

    def test_with_state_picks_household_composition(self):
        result = pick_next_topic(PartialHousehold(state="MA"))
        assert result.next_topic == QuestionTopic.HOUSEHOLD_COMPOSITION

    def test_with_unknown_citizenship_picks_citizenship(self):
        # Member exists with UNKNOWN citizenship → ask citizenship.
        # (member_id present so household_composition predicate doesn't fire.)
        applicant = _applicant(citizenship=CitizenshipStatus.UNKNOWN)
        state = PartialHousehold(state="MA", members=[applicant])
        result = pick_next_topic(state)
        assert result.next_topic == QuestionTopic.APPLICANT_CITIZENSHIP

    def test_with_citizenship_known_picks_cash_program(self):
        state = PartialHousehold(state="MA", members=[_applicant()])
        result = pick_next_topic(state)
        assert result.next_topic == QuestionTopic.CASH_PROGRAM_RECEIPT

    def test_after_cash_no_picks_earned_income(self):
        state = PartialHousehold(
            state="MA",
            members=[_applicant()],
            receives_tanf=False,
            receives_ssi=False,
            receives_general_assistance=False,
        )
        result = pick_next_topic(state)
        # 32-year-old not enrolled half-time → student topic doesn't fire.
        assert result.next_topic == QuestionTopic.EARNED_INCOME

    def test_student_question_for_24_year_old_not_yet_asked(self):
        applicant = _applicant(age=24, student_status=StudentStatus.UNKNOWN)
        state = PartialHousehold(
            state="MA",
            members=[applicant],
            receives_tanf=False,
            receives_ssi=False,
            receives_general_assistance=False,
        )
        result = pick_next_topic(state)
        assert result.next_topic == QuestionTopic.APPLICANT_STUDENT_STATUS

    def test_student_exemption_when_enrolled_half_time(self):
        applicant = _applicant(
            age=24,
            student_status=StudentStatus.ENROLLED_HALF_TIME_OR_MORE,
            student_exemption=StudentExemption.NONE,
        )
        state = PartialHousehold(
            state="MA",
            members=[applicant],
            receives_tanf=False,
            receives_ssi=False,
            receives_general_assistance=False,
        )
        result = pick_next_topic(state)
        assert result.next_topic == QuestionTopic.APPLICANT_STUDENT_EXEMPTION

    def test_after_income_picks_housing(self):
        state = PartialHousehold(
            state="MA",
            members=[_applicant()],
            receives_tanf=False,
            receives_ssi=False,
            receives_general_assistance=False,
            income=IncomeFacts(
                sources=[
                    IncomeSource(
                        member_id="applicant",
                        source_type="wages",
                        monthly_gross=Decimal("1800"),
                        is_earned=True,
                    )
                ]
            ),
        )
        result = pick_next_topic(state)
        assert result.next_topic == QuestionTopic.HOUSING_COST

    def test_after_housing_picks_utilities(self):
        state = PartialHousehold(
            state="MA",
            members=[_applicant()],
            receives_tanf=False,
            receives_ssi=False,
            receives_general_assistance=False,
            income=IncomeFacts(
                sources=[
                    IncomeSource(
                        member_id="applicant",
                        source_type="wages",
                        monthly_gross=Decimal("1800"),
                        is_earned=True,
                    )
                ]
            ),
            expenses=ExpenseFacts(rent_or_mortgage=Decimal("1400")),
        )
        result = pick_next_topic(state)
        assert result.next_topic == QuestionTopic.UTILITY_COSTS

    def test_after_utility_decision_picks_homeless(self):
        # When SUA tier is set or actual utilities provided, utilities
        # is satisfied; next priority that's still unanswered is homeless.
        state = PartialHousehold(
            state="MA",
            members=[_applicant()],
            receives_tanf=False,
            receives_ssi=False,
            receives_general_assistance=False,
            income=IncomeFacts(
                sources=[
                    IncomeSource(
                        member_id="applicant",
                        source_type="wages",
                        monthly_gross=Decimal("1800"),
                        is_earned=True,
                    )
                ]
            ),
            expenses=ExpenseFacts(
                rent_or_mortgage=Decimal("1400"),
                sua_tier=SUATier.HEATING_COOLING,
            ),
        )
        result = pick_next_topic(state)
        # Liquid assets is skipped for MA (BBCE waives). Should land on homeless.
        assert result.next_topic == QuestionTopic.HOMELESS_STATUS

    def test_complete_state_returns_done(self):
        state = PartialHousehold(
            state="MA",
            members=[_applicant()],
            receives_tanf=False,
            receives_ssi=False,
            receives_general_assistance=False,
            income=IncomeFacts(
                sources=[
                    IncomeSource(
                        member_id="applicant",
                        source_type="wages",
                        monthly_gross=Decimal("1800"),
                        is_earned=True,
                    )
                ]
            ),
            expenses=ExpenseFacts(
                rent_or_mortgage=Decimal("1400"),
                sua_tier=SUATier.HEATING_COOLING,
            ),
            assets=AssetFacts(countable_resources=Decimal("0")),
            is_homeless=False,
        )
        result = pick_next_topic(state)
        assert result.next_topic == QuestionTopic.DONE


class TestApplicantAgePredicate:
    def test_infant_age_zero_does_not_trigger_applicant_age(self):
        # Regression: age=0 is a valid infant — predicate must not fire and
        # cause the selector to re-ask age. state_merge ensures HouseholdMember
        # always has a real int age, so age is None can never be true here.
        applicant = _applicant(age=0, citizenship=CitizenshipStatus.UNKNOWN)
        # APPLICANT_AGE deliberately absent from asked_topics to confirm
        # the predicate alone does not re-trigger the question.
        state = PartialHousehold(state="CA", members=[applicant])
        result = pick_next_topic(state)
        assert result.next_topic != QuestionTopic.APPLICANT_AGE


class TestPriorityClassifications:
    def test_high_priority_topics_block_eligibility(self):
        # State, citizenship, age, etc. are high priority because the
        # rules engine cannot run without them.
        empty = PartialHousehold()
        result = pick_next_topic(empty)
        assert result.priority == "high"

    def test_medium_priority_for_income_and_shelter(self):
        applicant = _applicant()
        state = PartialHousehold(
            state="MA",
            members=[applicant],
            receives_tanf=False,
            receives_ssi=False,
            receives_general_assistance=False,
        )
        result = pick_next_topic(state)
        # Should pick EARNED_INCOME with medium priority.
        assert result.priority == "medium"

    def test_low_priority_for_edge_cases(self):
        # An almost-complete state where only homeless/farmworker remains.
        state = PartialHousehold(
            state="MA",
            members=[_applicant()],
            receives_tanf=False,
            receives_ssi=False,
            receives_general_assistance=False,
            income=IncomeFacts(
                sources=[
                    IncomeSource(
                        member_id="applicant",
                        source_type="wages",
                        monthly_gross=Decimal("1800"),
                        is_earned=True,
                    )
                ]
            ),
            expenses=ExpenseFacts(
                rent_or_mortgage=Decimal("1400"),
                sua_tier=SUATier.HEATING_COOLING,
            ),
        )
        result = pick_next_topic(state)
        assert result.priority == "low"
