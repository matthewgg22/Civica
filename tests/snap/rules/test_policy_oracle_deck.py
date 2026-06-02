"""Policy-sourced oracle deck for the shared EligibilityEngine.

ORACLE FIREWALL (matrix §7): the expected (inputs -> B*) values below are derived
BY HAND from 7 CFR 273 + the FY2025 parameter values — NOT read off the engine.
If the engine disagrees, the test FAILS and we investigate root cause; we do not
"adjust expected to match the engine" (that would collapse the oracle into the
thing it validates).

FY2025 params used (poverty_guidelines.py / parameters.py, verified seed):
  earned deduction 20% · standard deduction $204 (HH1–3) · 30% reduction
  excess-shelter cap $712 (non-elderly/disabled) · minimum benefit $23 (HH1–2)
  gross test 130% FPL (federal) / 200% (CA BBCE) · net test 100% FPL
  monthly FPL: HH1 $1,255.00  HH2 $1,703.33   ·  max allotment: HH1 $292, HH2 $536, HH3 $768
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from backend.civic_api.snap.eligibility_engine import EligibilityEngine, Region
from backend.civic_api.snap.rules.interfaces import (
    AssetFacts, CitizenshipStatus, ExpenseFacts, Household, HouseholdMember,
    IncomeFacts, IncomeSource,
)

AS_OF = date(2025, 3, 15)  # FY2025


def _member(age, applicant=False, elderly=False):
    return HouseholdMember(
        member_id=f"m{age}", age=age, is_applicant=applicant, is_elderly=elderly,
        citizenship=CitizenshipStatus.US_CITIZEN if applicant else CitizenshipStatus.UNKNOWN,
    )


def _hh(state, members, earned=0, unearned=0, rent=0):
    inc = []
    if earned:
        inc.append(IncomeSource(member_id="m1", source_type="wages", monthly_gross=Decimal(str(earned)), is_earned=True))
    if unearned:
        inc.append(IncomeSource(member_id="m1", source_type="ssi", monthly_gross=Decimal(str(unearned)), is_earned=False))
    return Household(state=state, members=members, income=IncomeFacts(sources=inc),
                     expenses=ExpenseFacts(rent_or_mortgage=Decimal(str(rent))), assets=AssetFacts())


# Each case: (name, profile, expected_eligible, expected_B_star, expected_region, derivation)
CASES = [
    # O1 — R-I interior. A=1000−200−204=596; 0.5A=298; S=clamp(600−298)=302 (0<302<712);
    #      N=596−302=294; B=292−round(0.30·294=88.2→88)=204.
    ("O1_interior", _hh("TX", [_member(40, applicant=True)], earned=1000, rent=600),
     True, Decimal("204"), Region.INTERIOR_UNCAPPED, "R-I interior"),

    # O2 — R-II capped. raw=1100−298=802 → S=712 (cap); N=596−712<0→0; B=292−0=292.
    ("O2_capped", _hh("TX", [_member(40, applicant=True)], earned=1000, rent=1100),
     True, Decimal("292"), Region.CAPPED, "R-II capped"),

    # O3 — R-III S=0. A=1500−300−204=996; 0.5A=498; raw=100−498<0→S=0; N=996;
    #      B=292−round(0.30·996=298.8→299)=−7→0.
    ("O3_shelter_zero", _hh("TX", [_member(40, applicant=True)], earned=1500, rent=100),
     True, Decimal("0"), Region.SHELTER_ZERO, "R-III shelter below 50% of income"),

    # O4 — gross-gate reject (federal). 130%·$1,255=$1,631.5→$1,632; gross $2,000 > gate → ineligible.
    ("O4_gross_reject", _hh("TX", [_member(40, applicant=True)], earned=2000),
     False, None, Region.BOUNDARY_FLIP, "R-IV gross-income flip"),

    # O5 — BBCE eligibility + minimum-benefit floor (CA). 200%·$1,255=$2,510; gross $1,800 passes
    #      (would FAIL federal $1,632). A=1800−360−204=1236; 0.5A=618; S=900−618=282 (R-I);
    #      N=954; B=292−round(0.30·954=286.2→286)=6 → HH1 floor → $23.
    ("O5_bbce_min_floor", _hh("CA", [_member(40, applicant=True)], earned=1800, rent=900),
     True, Decimal("23"), Region.INTERIOR_UNCAPPED, "BBCE 200% gross + minimum-benefit floor"),

    # O6 — elderly, uncapped shelter (federal). E/D bypasses gross rejection + uncaps shelter.
    #      A=1000−0−204=796; 0.5A=398; raw=1500−398=1102 → uncapped → S=1102; N=796−1102<0→0;
    #      B=536−0=536.
    ("O6_elderly_uncapped", _hh("TX", [_member(70, applicant=True, elderly=True), _member(68, elderly=True)],
                                unearned=1000, rent=1500),
     True, Decimal("536"), Region.INTERIOR_UNCAPPED, "elderly uncapped shelter"),
]


def test_policy_oracle_deck():
    engine = EligibilityEngine()
    mismatches = []
    for name, profile, exp_elig, exp_b, exp_region, note in CASES:
        d = engine.determine(profile, as_of_date=AS_OF)
        got_b = d.B_star
        if d.eligible != exp_elig:
            mismatches.append(f"{name} ({note}): eligible {d.eligible} != {exp_elig}")
        if exp_b is None:
            if got_b is not None:
                mismatches.append(f"{name}: B* {got_b} != None")
        elif got_b is None or Decimal(got_b) != exp_b:
            mismatches.append(f"{name} ({note}): B* {got_b} != {exp_b}")
        if d.region != exp_region:
            mismatches.append(f"{name} ({note}): region {d.region.value} != {exp_region.value}")
    assert not mismatches, "Oracle deck disagreements (engine vs policy):\n  " + "\n  ".join(mismatches)
