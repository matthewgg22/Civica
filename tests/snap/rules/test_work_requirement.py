"""§10102 work_class derivation + ABAWD time-limit flip — policy deck.

work_class is derived (never input). ABAWD = 18–64 (ceiling 54 pre-OBBBA, 64 on/after
2025-11-01), able-bodied, no dependents <14. Timeout (≥3 countable months, <80 hrs) →
regime-A exclusion → composes with §16 proration. Determination-flip cases use an FY2025
date (loaded tables); the post-2025-11-01 seam is checked on the pure derivation.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from backend.civic_api.snap.eligibility_engine import EligibilityEngine
from backend.civic_api.snap.rules.interfaces import (
    AssetFacts, CitizenshipStatus, ExpenseFacts, Household, HouseholdMember,
    IncomeFacts, IncomeSource,
)
from backend.civic_api.snap.rules.work_requirement import WorkClass, derive_work_class

PRE = date(2025, 3, 15)      # pre-OBBBA-§10102 (ceiling 54) AND in loaded FY2025 tables
POST = date(2025, 12, 1)     # post-2025-11-01 (ceiling 64) — derivation only (FY2026 tables unloaded)


def _m(mid, age, **kw):
    return HouseholdMember(member_id=mid, age=age, citizenship=CitizenshipStatus.US_CITIZEN, **kw)


def _hh(members, homeless=False):
    return Household(state="TX", members=members, income=IncomeFacts(sources=[]),
                     expenses=ExpenseFacts(), assets=AssetFacts(), is_homeless=homeless)


def _wc(member, household, as_of):
    return derive_work_class(member, household, as_of)


def test_derive_work_class_core():
    adult = _m("m1", 40, is_applicant=True)
    hh = _hh([adult])
    assert _wc(adult, hh, PRE) == WorkClass.ABAWD_SUBJECT             # 40, no deps → subject
    assert _wc(_m("e", 70), _hh([_m("e", 70)]), PRE) == WorkClass.EXEMPT          # 65+
    assert _wc(_m("d", 40, is_disabled=True), _hh([_m("d", 40, is_disabled=True)]), PRE) == WorkClass.EXEMPT
    # caregiver of a child <14 → exempt
    car = _m("p", 35, is_applicant=True)
    assert _wc(car, _hh([car, _m("k", 9)]), PRE) == WorkClass.EXEMPT


def test_age_ceiling_seam_54_to_64():
    a62 = _m("m", 62, is_applicant=True)
    hh = _hh([a62])
    assert _wc(a62, hh, PRE) == WorkClass.EXEMPT          # pre-OBBBA ceiling 54 → 62 exempt
    assert _wc(a62, hh, POST) == WorkClass.ABAWD_SUBJECT  # post: ceiling 64 → 62 subject (the seam)


def test_obbba_removed_exemptions_flip():
    vet = _m("v", 40, is_veteran=True)
    assert _wc(vet, _hh([vet]), PRE) == WorkClass.EXEMPT            # veteran exempt before 2025-11-01
    assert _wc(vet, _hh([vet]), POST) == WorkClass.ABAWD_SUBJECT    # subject after
    h = _m("h", 40)
    assert _wc(h, _hh([h], homeless=True), PRE) == WorkClass.EXEMPT
    assert _wc(h, _hh([h], homeless=True), POST) == WorkClass.ABAWD_SUBJECT
    tribal = _m("t", 40, is_tribal_member=True)
    assert _wc(tribal, _hh([tribal]), POST) == WorkClass.EXEMPT     # OBBBA-added exemption


def test_abawd_timeout_flips_determination():
    def det(months, hours):
        m = _m("m1", 40, is_applicant=True,
               abawd_countable_months_used=months, monthly_work_hours=Decimal(str(hours)))
        hh = Household(state="TX", members=[m],
                       income=IncomeFacts(sources=[IncomeSource(member_id="m1", source_type="wages",
                                                                monthly_gross=Decimal("1000"), is_earned=True)]),
                       expenses=ExpenseFacts(rent_or_mortgage=Decimal("600")), assets=AssetFacts())
        return EligibilityEngine().determine(hh, as_of_date=PRE)

    assert det(2, 0).eligible and det(2, 0).B_star == Decimal("204")   # under the 3-month limit → eligible
    assert not det(3, 0).eligible                                       # timed out → excluded → ineligible
    assert det(3, 80).eligible and det(3, 80).B_star == Decimal("204")  # meeting 80 hrs → not timed out
