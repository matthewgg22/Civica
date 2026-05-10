"""Unit tests for the interpreter-output → PartialHousehold merger.

State-merge has the highest correctness sensitivity in the pipeline:
a bug here means accumulated facts get silently overwritten or lost.
"""
from __future__ import annotations

from decimal import Decimal

from backend.civic_api.snap.pipeline.schemas import (
    HouseholdMemberUpdate,
    IncomeSourceUpdate,
    InterpreterOutput,
    PartialHousehold,
)
from backend.civic_api.snap.pipeline.state_merge import apply_interpreter_output
from backend.civic_api.snap.rules.interfaces import (
    CitizenshipStatus,
    HouseholdMember,
    IncomeFacts,
    IncomeSource,
    StudentStatus,
    SUATier,
)


class TestStateScalar:
    def test_state_set_when_provided(self):
        result = apply_interpreter_output(
            PartialHousehold(),
            InterpreterOutput(confidence=0.9, state="MA"),
        )
        assert result.state == "MA"

    def test_state_preserved_when_not_provided(self):
        result = apply_interpreter_output(
            PartialHousehold(state="MA"),
            InterpreterOutput(confidence=0.9),
        )
        assert result.state == "MA"

    def test_state_can_be_overwritten(self):
        result = apply_interpreter_output(
            PartialHousehold(state="MA"),
            InterpreterOutput(confidence=0.9, state="NY"),
        )
        assert result.state == "NY"


class TestMembers:
    def test_new_member_added(self):
        result = apply_interpreter_output(
            PartialHousehold(),
            InterpreterOutput(
                confidence=0.9,
                member_updates=[
                    HouseholdMemberUpdate(
                        member_id="applicant",
                        age=32,
                        is_applicant=True,
                        citizenship=CitizenshipStatus.US_CITIZEN,
                    )
                ],
            ),
        )
        assert len(result.members) == 1
        assert result.members[0].age == 32
        assert result.members[0].citizenship == CitizenshipStatus.US_CITIZEN

    def test_existing_member_updated_partial(self):
        existing = HouseholdMember(
            member_id="applicant",
            age=32,
            is_applicant=True,
            citizenship=CitizenshipStatus.UNKNOWN,
        )
        result = apply_interpreter_output(
            PartialHousehold(state="MA", members=[existing]),
            InterpreterOutput(
                confidence=0.95,
                member_updates=[
                    HouseholdMemberUpdate(
                        member_id="applicant",
                        citizenship=CitizenshipStatus.US_CITIZEN,
                    )
                ],
            ),
        )
        assert result.members[0].age == 32  # preserved
        assert result.members[0].citizenship == CitizenshipStatus.US_CITIZEN  # updated

    def test_new_member_without_age_skipped(self):
        # Schema requires age for new members; a malformed update is
        # dropped rather than crashing the merge.
        result = apply_interpreter_output(
            PartialHousehold(),
            InterpreterOutput(
                confidence=0.5,
                member_updates=[
                    HouseholdMemberUpdate(
                        member_id="ghost",
                        is_applicant=True,
                    )
                ],
            ),
        )
        assert result.members == []


class TestIncome:
    def test_first_income_source_added(self):
        result = apply_interpreter_output(
            PartialHousehold(),
            InterpreterOutput(
                confidence=0.95,
                income_sources_added=[
                    IncomeSourceUpdate(
                        member_id="applicant",
                        source_type="wages",
                        monthly_gross=Decimal("1800"),
                        is_earned=True,
                    )
                ],
            ),
        )
        assert len(result.income.sources) == 1
        assert result.income.sources[0].monthly_gross == Decimal("1800")

    def test_income_replaces_for_same_member(self):
        # Updating wages should replace, not stack.
        result = apply_interpreter_output(
            PartialHousehold(
                income=IncomeFacts(
                    sources=[
                        IncomeSource(
                            member_id="applicant",
                            source_type="wages",
                            monthly_gross=Decimal("1800"),
                            is_earned=True,
                        )
                    ]
                )
            ),
            InterpreterOutput(
                confidence=0.9,
                income_sources_added=[
                    IncomeSourceUpdate(
                        member_id="applicant",
                        source_type="wages",
                        monthly_gross=Decimal("2200"),
                        is_earned=True,
                    )
                ],
            ),
        )
        assert len(result.income.sources) == 1
        assert result.income.sources[0].monthly_gross == Decimal("2200")

    def test_income_removed_via_removed_list(self):
        result = apply_interpreter_output(
            PartialHousehold(
                income=IncomeFacts(
                    sources=[
                        IncomeSource(
                            member_id="applicant",
                            source_type="wages",
                            monthly_gross=Decimal("1800"),
                            is_earned=True,
                        )
                    ]
                )
            ),
            InterpreterOutput(
                confidence=0.95,
                income_sources_removed=["applicant"],
            ),
        )
        assert result.income.sources == []

    def test_income_other_members_preserved(self):
        result = apply_interpreter_output(
            PartialHousehold(
                income=IncomeFacts(
                    sources=[
                        IncomeSource(
                            member_id="applicant",
                            source_type="wages",
                            monthly_gross=Decimal("1800"),
                            is_earned=True,
                        ),
                        IncomeSource(
                            member_id="spouse",
                            source_type="wages",
                            monthly_gross=Decimal("900"),
                            is_earned=True,
                        ),
                    ]
                )
            ),
            InterpreterOutput(
                confidence=0.95,
                income_sources_added=[
                    IncomeSourceUpdate(
                        member_id="applicant",
                        source_type="wages",
                        monthly_gross=Decimal("2000"),
                        is_earned=True,
                    )
                ],
            ),
        )
        # Spouse's income is preserved; applicant's is replaced.
        assert {s.member_id for s in result.income.sources} == {"applicant", "spouse"}
        applicant_source = next(s for s in result.income.sources if s.member_id == "applicant")
        spouse_source = next(s for s in result.income.sources if s.member_id == "spouse")
        assert applicant_source.monthly_gross == Decimal("2000")
        assert spouse_source.monthly_gross == Decimal("900")


class TestExpenses:
    def test_rent_set(self):
        result = apply_interpreter_output(
            PartialHousehold(),
            InterpreterOutput(confidence=0.95, rent_or_mortgage=Decimal("1400")),
        )
        assert result.expenses.rent_or_mortgage == Decimal("1400")

    def test_rent_preserved_when_not_in_update(self):
        # An update that mentions utilities but not rent should leave rent alone.
        prior = PartialHousehold(state="MA")
        prior.expenses.rent_or_mortgage = Decimal("1400")
        result = apply_interpreter_output(
            prior,
            InterpreterOutput(confidence=0.9, utilities_actual=Decimal("150")),
        )
        assert result.expenses.rent_or_mortgage == Decimal("1400")
        assert result.expenses.utilities_actual == Decimal("150")

    def test_sua_tier_set(self):
        result = apply_interpreter_output(
            PartialHousehold(),
            InterpreterOutput(confidence=0.9, sua_tier=SUATier.HEATING_COOLING),
        )
        assert result.expenses.sua_tier == SUATier.HEATING_COOLING


class TestBooleans:
    def test_homeless_true_set(self):
        result = apply_interpreter_output(
            PartialHousehold(),
            InterpreterOutput(confidence=0.9, is_homeless=True),
        )
        assert result.is_homeless is True

    def test_homeless_false_distinguished_from_unset(self):
        # is_homeless=False is a real answer ("I have stable housing"),
        # not the same as None ("we haven't asked yet"). The merger
        # must propagate False, not coalesce it away.
        result = apply_interpreter_output(
            PartialHousehold(is_homeless=None),
            InterpreterOutput(confidence=0.95, is_homeless=False),
        )
        assert result.is_homeless is False


class TestPureFunctionInvariant:
    def test_input_state_not_mutated(self):
        original = PartialHousehold(state="MA")
        original.expenses.rent_or_mortgage = Decimal("1000")
        snapshot = original.model_dump_json()
        apply_interpreter_output(
            original,
            InterpreterOutput(confidence=0.9, rent_or_mortgage=Decimal("2000")),
        )
        assert original.model_dump_json() == snapshot, "input state was mutated"
