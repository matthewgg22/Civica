"""FY2026 reference tables loaded — determinations now run for FY2026 dates.

Before the agent-retrieved FY2026 poverty/allotment/SUA tables were loaded, an FY2026
date raised NoTableForDateError. These confirm FY2026 resolves, differs from FY2025
(the COLA moved the number), and the CA/MA FY2026 SUAs are present.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from backend.civic_api.snap.eligibility_engine import EligibilityEngine
from backend.civic_api.snap.rules.interfaces import (
    AssetFacts, CitizenshipStatus, ExpenseFacts, Household, HouseholdMember,
    IncomeFacts, IncomeSource,
)
from backend.civic_api.snap.rules.poverty_guidelines import sua_table_for

FY25 = date(2025, 3, 15)
FY26 = date(2025, 12, 1)


def _hh():
    return Household(
        state="CA",
        members=[HouseholdMember(member_id="m1", age=40, is_applicant=True, citizenship=CitizenshipStatus.US_CITIZEN),
                 HouseholdMember(member_id="m2", age=10), HouseholdMember(member_id="m3", age=8)],
        income=IncomeFacts(sources=[IncomeSource(member_id="m1", source_type="wages", monthly_gross=Decimal("1200"), is_earned=True)]),
        expenses=ExpenseFacts(rent_or_mortgage=Decimal("900")), assets=AssetFacts(),
    )


def test_fy2026_determination_runs():
    d = EligibilityEngine().determine(_hh(), as_of_date=FY26)   # raised NoTableForDateError before the load
    assert d.eligible and d.fy == 2026 and d.B_star is not None and d.B_star > 0


def test_fy2026_differs_from_fy2025():
    eng = EligibilityEngine()
    d25 = eng.determine(_hh(), as_of_date=FY25)
    d26 = eng.determine(_hh(), as_of_date=FY26)
    assert d25.fy == 2025 and d26.fy == 2026
    assert d25.B_star != d26.B_star            # FY2026 COLA (allotment/SD) moves the benefit


def test_fy2026_state_sua_loaded():
    t = sua_table_for(FY26)
    assert t.lookup("CA", "heating_cooling") == Decimal("663")   # CDSS ACIN I-46-25
    assert t.lookup("MA", "heating_cooling") == Decimal("890")   # mass.gov DTA
