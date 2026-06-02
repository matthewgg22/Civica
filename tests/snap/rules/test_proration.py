"""§16 proration — policy-sourced deck (expected values hand-derived, not from the engine).

FY2025 federal (TX, no BBCE). f = n_eligible / n_total. Regime A = full income count,
deductions retained; Regime B = income × f and billed shelter × f. Member needs always
leave household size.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from backend.civic_api.snap.eligibility_engine import EligibilityEngine, Region
from backend.civic_api.snap.rules.interfaces import (
    AssetFacts, CitizenshipStatus, ExclusionReason, ExpenseFacts, Household,
    HouseholdMember, IncomeFacts, IncomeSource,
)

AS_OF = date(2025, 3, 15)


def _m(mid, age, applicant=False, citizen=True, exclusion=None):
    return HouseholdMember(
        member_id=mid, age=age, is_applicant=applicant,
        citizenship=CitizenshipStatus.US_CITIZEN if citizen else CitizenshipStatus.INELIGIBLE_NONCITIZEN,
        eligibility_exclusion=exclusion,
    )


def _src(mid, amt, earned=True):
    return IncomeSource(member_id=mid, source_type="wages" if earned else "ssi",
                        monthly_gross=Decimal(str(amt)), is_earned=earned)


def _hh(members, sources, rent=0):
    return Household(state="TX", members=members, income=IncomeFacts(sources=sources),
                     expenses=ExpenseFacts(rent_or_mortgage=Decimal(str(rent))), assets=AssetFacts())


def _det(hh):
    return EligibilityEngine().determine(hh, as_of_date=AS_OF)


def test_no_exclusion_is_identity():
    # No exclusions → same as a plain HH1 (= oracle O1): A=596, S=302, B=292−88=204.
    d = _det(_hh([_m("m1", 40, applicant=True)], [_src("m1", 1000)], rent=600))
    assert d.eligible and d.B_star == Decimal("204") and d.region == Region.INTERIOR_UNCAPPED


def test_regime_B_mixed_status_prorates_income_and_size():
    # Citizen adult + citizen child eligible; ineligible-noncitizen parent earns $1,500.
    # f=2/3: counted income 1500×2/3=1000; size=2 (SD 204); rent 900×2/3=600.
    # A=596, S=302, N=294, B=536(HH2 max)−88=448.
    d = _det(_hh(
        [_m("m1", 40, applicant=True), _m("m2", 10),
         _m("m3", 35, citizen=False, exclusion=ExclusionReason.INELIGIBLE_NONCITIZEN)],
        [_src("m3", 1500)], rent=900,
    ))
    assert d.eligible and d.B_star == Decimal("448") and d.region == Region.INTERIOR_UNCAPPED


def test_regime_A_full_count_income_deductions_retained():
    # IPV-disqualified member earns $1,000 (full count); size=1; deductions retained (f_ded=1).
    # Equivalent to a 1-person $1,000 / $600-rent unit → B=292−88=204.
    d = _det(_hh(
        [_m("m1", 40, applicant=True), _m("m2", 35, exclusion=ExclusionReason.IPV)],
        [_src("m2", 1000)], rent=600,
    ))
    assert d.eligible and d.B_star == Decimal("204") and d.region == Region.INTERIOR_UNCAPPED


def test_regime_B_region_transition_capped_to_interior():
    # §16 trap: nominal rent $1,500 + income $2,000 would be R_capped un-prorated, but
    # regime-B proration (f=1/2) drops income→$1,000 and shelter→$750 → R_interior.
    # A=596, raw=750−298=452 (<744 cap) → INTERIOR; N=144; B=292−43=249.
    d = _det(_hh(
        [_m("m1", 40, applicant=True),
         _m("m2", 35, citizen=False, exclusion=ExclusionReason.INELIGIBLE_NONCITIZEN)],
        [_src("m2", 2000)], rent=1500,
    ))
    assert d.eligible and d.B_star == Decimal("249")
    assert d.region == Region.INTERIOR_UNCAPPED   # NOT capped — proration moved the region


def test_all_members_excluded_is_ineligible():
    d = _det(_hh(
        [_m("m1", 35, applicant=True, citizen=False, exclusion=ExclusionReason.INELIGIBLE_NONCITIZEN)],
        [_src("m1", 1000)],
    ))
    assert not d.eligible
