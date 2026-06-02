"""§10108 immigration resolution — policy deck (FNS Alien-Eligibility memo 2025-10-31).

Headline: the §10108 removals are effective 2025-07-04, so the SAME refugee household
flips eligible → ineligible across that date (the point-in-time case). Ineligible
noncitizens compose with §16 regime-B proration in mixed-status households.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from backend.civic_api.snap.eligibility_engine import EligibilityEngine, Region
from backend.civic_api.snap.rules.immigration import OBBBA_10108_DATE, immigration_eligibility
from backend.civic_api.snap.rules.interfaces import (
    AssetFacts, ExpenseFacts, Household, HouseholdMember, ImmigrationStatus,
    IncomeFacts, IncomeSource,
)

PRE = date(2025, 6, 1)    # before §10108 enactment
POST = date(2025, 8, 1)   # on/after enactment (still FY2025 tables)
AS_OF = date(2025, 3, 15)


def _m(mid, age, applicant=False, imm=None):
    return HouseholdMember(member_id=mid, age=age, is_applicant=applicant, immigration_status=imm)


def _hh(members, sources, rent=0):
    return Household(state="TX", members=members, income=IncomeFacts(sources=sources),
                     expenses=ExpenseFacts(rent_or_mortgage=Decimal(str(rent))), assets=AssetFacts())


def _src(mid, amt):
    return IncomeSource(member_id=mid, source_type="wages", monthly_gross=Decimal(str(amt)), is_earned=True)


def _det(hh, as_of=AS_OF):
    return EligibilityEngine().determine(hh, as_of_date=as_of)


def test_eligibility_resolver_point_in_time():
    assert immigration_eligibility(ImmigrationStatus.REFUGEE, PRE) == "eligible"
    assert immigration_eligibility(ImmigrationStatus.REFUGEE, POST) == "ineligible"
    assert immigration_eligibility(ImmigrationStatus.REFUGEE, OBBBA_10108_DATE) == "ineligible"  # boundary inclusive
    assert immigration_eligibility(ImmigrationStatus.LPR, POST) == "eligible"
    assert immigration_eligibility(ImmigrationStatus.DACA, PRE) == "ineligible"
    assert immigration_eligibility(ImmigrationStatus.COFA, POST) == "eligible"
    assert immigration_eligibility(ImmigrationStatus.T_VISA, POST) == "contested"
    assert immigration_eligibility(ImmigrationStatus.UNKNOWN, POST) == "pending"


def test_eligible_categories_determine_normally():
    for status in (ImmigrationStatus.US_CITIZEN, ImmigrationStatus.LPR,
                   ImmigrationStatus.COFA, ImmigrationStatus.CUBAN_HAITIAN):
        d = _det(_hh([_m("m1", 40, applicant=True, imm=status)], [_src("m1", 1000)], rent=600))
        assert d.eligible and d.B_star == Decimal("204"), status


def test_always_ineligible_categories_excluded():
    for status in (ImmigrationStatus.DACA, ImmigrationStatus.UNDOCUMENTED, ImmigrationStatus.H2A):
        d = _det(_hh([_m("m1", 40, applicant=True, imm=status)], [_src("m1", 1000)], rent=600))
        assert not d.eligible, status


def test_refugee_point_in_time_flip():
    hh = _hh([_m("m1", 40, applicant=True, imm=ImmigrationStatus.REFUGEE)], [_src("m1", 1000)], rent=600)
    assert _det(hh, as_of=PRE).eligible        # before 2025-07-04 → refugee counted → eligible $204
    assert _det(hh, as_of=PRE).B_star == Decimal("204")
    assert not _det(hh, as_of=POST).eligible    # on/after → §10108 removes refugee → ineligible


def test_mixed_status_citizen_plus_undocumented_prorates():
    # Citizen applicant + undocumented spouse earning $1,500 → spouse excluded (regime B),
    # income 1500×0.5=750, rent 900×0.5=450, size 1 → B=292−43=$249 (= §16 proration).
    d = _det(_hh(
        [_m("m1", 40, applicant=True, imm=ImmigrationStatus.US_CITIZEN),
         _m("m2", 38, imm=ImmigrationStatus.UNDOCUMENTED)],
        [_src("m2", 1500)], rent=900,
    ))
    assert d.eligible and d.B_star == Decimal("249") and d.region == Region.INTERIOR_UNCAPPED


def test_t_visa_contested_excluded_by_operative_default():
    # ⚠ contested (under litigation) — operative default is exclude (taxonomy §7).
    d = _det(_hh([_m("m1", 40, applicant=True, imm=ImmigrationStatus.T_VISA)], [_src("m1", 1000)]))
    assert not d.eligible
