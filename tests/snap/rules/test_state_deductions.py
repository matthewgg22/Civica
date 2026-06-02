"""CA/MA standard medical deduction + §20 minor-student earnings exclusion — policy deck.

FY2025 federal (TX) baseline vs CA. Expected values hand-derived from the algebra.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from backend.civic_api.snap.eligibility_engine import EligibilityEngine
from backend.civic_api.snap.rules.interfaces import (
    AssetFacts, CitizenshipStatus, ExpenseFacts, Household, HouseholdMember,
    IncomeFacts, IncomeSource, StudentStatus,
)

AS_OF = date(2025, 3, 15)


def _det(hh):
    return EligibilityEngine().determine(hh, as_of_date=AS_OF)


def test_standard_medical_deduction_ca_vs_federal():
    # Elderly HH2, $1,000 unearned, $600 rent, $100/mo out-of-pocket medical.
    # CA standard medical = $150; federal itemized excess = $100 − $35 = $65. The larger
    # deduction cascades (lower A → lower 0.5A → more uncapped shelter) → higher benefit.
    def hh(state):
        return Household(
            state=state,
            members=[HouseholdMember(member_id="m1", age=70, is_applicant=True, is_elderly=True,
                                     citizenship=CitizenshipStatus.US_CITIZEN),
                     HouseholdMember(member_id="m2", age=68, is_elderly=True)],
            income=IncomeFacts(sources=[IncomeSource(member_id="m1", source_type="ssi",
                                                     monthly_gross=Decimal("1000"), is_earned=False)]),
            expenses=ExpenseFacts(rent_or_mortgage=Decimal("600"),
                                  medical_out_of_pocket_elderly_disabled=Decimal("100")),
            assets=AssetFacts(),
        )
    ca, tx = _det(hh("CA")), _det(hh("TX"))
    assert ca.eligible and tx.eligible
    assert ca.B_star == Decimal("425")   # CA standard medical $150
    assert tx.B_star == Decimal("387")   # federal itemized ($65)
    assert ca.B_star > tx.B_star         # standard medical prevents the underpayment


def test_minor_student_earnings_excluded():
    # HH2 (parent + 16yo). Parent earns $800; minor earns $500. A minor STUDENT's wages
    # are excluded (273.9(c)(7)); a non-student minor's wages count.
    def hh(minor_is_student):
        minor = HouseholdMember(
            member_id="kid", age=16,
            student_status=StudentStatus.ENROLLED_HALF_TIME_OR_MORE if minor_is_student else StudentStatus.NOT_STUDENT,
        )
        return Household(
            state="TX",
            members=[HouseholdMember(member_id="m1", age=40, is_applicant=True, citizenship=CitizenshipStatus.US_CITIZEN), minor],
            income=IncomeFacts(sources=[
                IncomeSource(member_id="m1", source_type="wages", monthly_gross=Decimal("800"), is_earned=True),
                IncomeSource(member_id="kid", source_type="wages", monthly_gross=Decimal("500"), is_earned=True),
            ]),
            expenses=ExpenseFacts(rent_or_mortgage=Decimal("600")), assets=AssetFacts(),
        )
    student, nonstudent = _det(hh(True)), _det(hh(False))
    assert student.B_star == Decimal("520")     # minor's $500 excluded
    assert nonstudent.B_star == Decimal("340")   # minor's $500 counted
    assert student.B_star > nonstudent.B_star
