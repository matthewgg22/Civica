"""Tests for the PartialHousehold + EligibilityResult -> ApplicationPacket projection."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from backend.civic_api.snap.application.data_assembly import (
    ApplicationPacket,
    assemble_application_packet,
)
from backend.civic_api.snap.pipeline.schemas import PartialHousehold
from backend.civic_api.snap.rules.interfaces import (
    AssetFacts,
    CitizenshipStatus,
    EligibilityResult,
    EligibilityStatus,
    ExpenseFacts,
    HouseholdMember,
    IncomeFacts,
    IncomeSource,
    StudentExemption,
    StudentStatus,
    SUATier,
)
from backend.civic_api.snap.rules.states.massachusetts import MassachusettsSNAPRules


def _applicant(**kwargs):
    defaults = dict(
        member_id="applicant",
        age=32,
        is_applicant=True,
        citizenship=CitizenshipStatus.US_CITIZEN,
        student_status=StudentStatus.NOT_STUDENT,
        student_exemption=StudentExemption.NONE,
    )
    defaults.update(kwargs)
    return HouseholdMember(**defaults)


@pytest.fixture
def canonical_partial():
    return PartialHousehold(
        state="MA",
        members=[_applicant()],
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
        receives_tanf=False,
        receives_ssi=False,
        receives_general_assistance=False,
        is_homeless=False,
    )


@pytest.fixture
def canonical_eligibility(canonical_partial):
    rules = MassachusettsSNAPRules(effective_date=date(2025, 5, 10))
    return rules.determine_eligibility(canonical_partial.to_household())


class TestAssembleApplicationPacket:
    def test_basic_shape(self, canonical_partial, canonical_eligibility):
        packet = assemble_application_packet(
            session_id="abc-123-def",
            state="MA",
            language="en",
            partial=canonical_partial,
            eligibility=canonical_eligibility,
        )
        assert packet.session_id == "abc-123-def"
        assert packet.state == "MA"
        assert packet.language == "en"
        assert packet.household_size == 1
        assert packet.eligibility_status == "eligible"
        assert packet.monthly_benefit == Decimal("135")
        assert packet.rules_version == "federal-2025-05-10/MA-2025-05-10"

    def test_income_lines_carry_through(self, canonical_partial, canonical_eligibility):
        packet = assemble_application_packet(
            session_id="x", state="MA", language="en",
            partial=canonical_partial, eligibility=canonical_eligibility,
        )
        assert len(packet.income_lines) == 1
        assert packet.income_lines[0].monthly_gross == Decimal("1800")
        assert packet.income_lines[0].is_earned is True

    def test_sua_tier_renders_as_expense_line(self, canonical_partial, canonical_eligibility):
        packet = assemble_application_packet(
            session_id="x", state="MA", language="en",
            partial=canonical_partial, eligibility=canonical_eligibility,
        )
        sua_lines = [
            line for line in packet.expense_lines if "Standard Utility Allowance" in line.label
        ]
        assert len(sua_lines) == 1
        assert "heating cooling" in sua_lines[0].note.lower()

    def test_actual_utilities_when_no_sua(self, canonical_eligibility):
        partial = PartialHousehold(
            state="MA",
            members=[_applicant()],
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
                utilities_actual=Decimal("180"),
                sua_tier=SUATier.NONE,
            ),
            receives_tanf=False,
            receives_ssi=False,
            receives_general_assistance=False,
            is_homeless=False,
        )
        packet = assemble_application_packet(
            session_id="x", state="MA", language="en",
            partial=partial, eligibility=None,
        )
        assert any(line.label == "Utilities (actual)" for line in packet.expense_lines)
        assert "expenses.utilities_actual" in packet.populated_field_paths

    def test_required_verifications_rendered(self, canonical_partial, canonical_eligibility):
        packet = assemble_application_packet(
            session_id="x", state="MA", language="en",
            partial=canonical_partial, eligibility=canonical_eligibility,
        )
        codes = {v["code"] for v in packet.required_verifications}
        assert "identity_photo_id" in codes
        assert "income_paystub" in codes
        assert "shelter_lease" in codes

    def test_no_eligibility_renders_as_insufficient(self, canonical_partial):
        packet = assemble_application_packet(
            session_id="x", state="MA", language="en",
            partial=canonical_partial, eligibility=None,
        )
        assert packet.eligibility_status == "insufficient_information"
        assert packet.monthly_benefit is None
        assert packet.rules_version is None

    def test_populated_field_paths_track_what_was_set(self, canonical_partial, canonical_eligibility):
        packet = assemble_application_packet(
            session_id="x", state="MA", language="en",
            partial=canonical_partial, eligibility=canonical_eligibility,
        )
        # We populated members, income, rent, sua_tier — those should appear.
        paths = set(packet.populated_field_paths)
        assert "members" in paths
        assert "income.sources" in paths
        assert "expenses.rent_or_mortgage" in paths
        assert "expenses.sua_tier" in paths
