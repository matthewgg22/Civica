"""Massachusetts-specific SNAP rules tests.

Coverage:
  - BBCE override: 200% FPL gross test instead of 130%
  - BBCE asset waiver
  - MA-specific student exemption (DTA-approved self-sufficiency)
  - MA SUA chart application (heating/cooling, non-heating, phone-only)
  - MA contributing_factors record BBCE and SUA when applied
  - rules_version string format
"""
from __future__ import annotations

from decimal import Decimal

import pytest

from backend.civic_api.snap.rules.interfaces import (
    EligibilityStatus,
    StudentExemption,
    StudentStatus,
    SUATier,
)


# ---------------------------------------------------------------------------
# BBCE: 200% FPL gross test, asset waiver
# ---------------------------------------------------------------------------


class TestMABBCE:
    def test_gross_income_threshold_is_200pct_fpl(self, ma_rules, make_household):
        # FY25 1-person FPL monthly = $1,255. 200% = $2,510.
        hh = make_household(wages=2510)
        result = ma_rules.determine_eligibility(hh)
        gross_test = next(
            t for t in result.test_outcomes if "gross_income" in t.test_name
        )
        assert gross_test.threshold == Decimal("2510")
        assert gross_test.passes is True

    def test_gross_income_above_200pct_fpl_blocked(self, ma_rules, make_household):
        hh = make_household(wages=2511)
        result = ma_rules.determine_eligibility(hh)
        assert result.status == EligibilityStatus.INELIGIBLE
        assert "$2510" in (result.ineligibility_reason or "")

    def test_asset_test_waived_under_bbce(self, ma_rules, make_household):
        # Federal asset limit is $3,000. MA BBCE waives it entirely.
        hh = make_household(wages=1000, countable_resources=20000)
        result = ma_rules.determine_eligibility(hh)
        assert result.status == EligibilityStatus.ELIGIBLE
        asset_test = next(t for t in result.test_outcomes if "asset" in t.test_name)
        assert asset_test.passes is True
        assert "waive" in asset_test.notes.lower()

    def test_contributing_factors_records_bbce(self, ma_rules, make_household):
        hh = make_household(wages=1500, rent=1000)
        result = ma_rules.determine_eligibility(hh)
        assert "ma_bbce_applied" in result.contributing_factors

    def test_rules_version_includes_ma(self, ma_rules, make_household):
        hh = make_household(wages=1000)
        result = ma_rules.determine_eligibility(hh)
        assert "MA-" in result.rules_version
        assert "federal-" in result.rules_version


# ---------------------------------------------------------------------------
# MA Standard Utility Allowance (FY25 chart)
# ---------------------------------------------------------------------------


class TestMASUA:
    def test_heating_cooling_sua_substitutes_799(self, ma_rules, make_household):
        # MA heating/cooling SUA FY25 = $799. Households elect this in lieu
        # of itemizing actual utility costs.
        hh = make_household(
            wages=1500,
            rent=1000,
            sua_tier=SUATier.HEATING_COOLING,
            utilities_actual=999999,  # ignored when SUA tier is set
        )
        result = ma_rules.determine_eligibility(hh)
        # Hand-computed:
        #   earned_dedn = 1500 * 0.20 = 300
        #   std_dedn (1) = 204
        #   adj_inc = 1500 - 300 - 204 = 996, half = 498
        #   shelter = 1000 (rent) + 799 (SUA) = 1799
        #   excess raw = 1799 - 498 = 1301, capped 712
        #   net = 1500 - 300 - 204 - 712 = 284
        #   30% = 85, max_allotment(1) = 292, benefit = 207
        assert result.status == EligibilityStatus.ELIGIBLE
        assert result.benefit_calculation.excess_shelter_deduction == Decimal("712")
        assert result.monthly_benefit == Decimal("207")

    def test_non_heating_sua_substitutes_507(self, ma_rules, make_household):
        hh = make_household(
            wages=1500,
            rent=1000,
            sua_tier=SUATier.NON_HEATING,
        )
        # shelter = 1000 + 507 = 1507. excess raw = 1507 - 498 = 1009, capped 712.
        # Same net/benefit as above since cap is hit either way.
        result = ma_rules.determine_eligibility(hh)
        assert result.status == EligibilityStatus.ELIGIBLE

    def test_phone_only_sua_substitutes_63(self, ma_rules, make_household):
        hh = make_household(
            wages=1500,
            rent=400,
            sua_tier=SUATier.PHONE_ONLY,
        )
        # shelter = 400 + 63 = 463. half_adj = 498. excess raw = 463 - 498 = -35 → 0.
        result = ma_rules.determine_eligibility(hh)
        assert result.benefit_calculation.excess_shelter_deduction == Decimal("0")

    def test_no_sua_uses_actual_utilities(self, ma_rules, make_household):
        # When SUA is NONE, fall back to the user's reported actual utilities.
        hh = make_household(
            wages=1500,
            rent=1000,
            utilities_actual=200,
            sua_tier=SUATier.NONE,
        )
        result = ma_rules.determine_eligibility(hh)
        # shelter = 1000 + 200 = 1200. excess raw = 1200 - 498 = 702, under cap.
        assert result.benefit_calculation.excess_shelter_deduction == Decimal("702")

    def test_contributing_factors_records_sua_tier(self, ma_rules, make_household):
        hh = make_household(
            wages=1500,
            rent=1000,
            sua_tier=SUATier.HEATING_COOLING,
        )
        result = ma_rules.determine_eligibility(hh)
        assert "ma_sua_heating_cooling_applied" in result.contributing_factors


# ---------------------------------------------------------------------------
# MA student exemption (106 CMR 362.410 — DTA-approved self-sufficiency)
# ---------------------------------------------------------------------------


class TestMAStudentRule:
    def test_dta_approved_self_sufficiency_passes(self, ma_rules, make_household, make_member):
        hh = make_household(
            members=[
                make_member(
                    age=24,
                    student_status=StudentStatus.ENROLLED_HALF_TIME_OR_MORE,
                    student_exemption=StudentExemption.DTA_APPROVED_SELF_SUFFICIENCY,
                )
            ],
            wages=600,
        )
        result = ma_rules.determine_eligibility(hh)
        assert result.status == EligibilityStatus.ELIGIBLE
        student_test = next(t for t in result.test_outcomes if "student" in t.test_name)
        assert student_test.passes is True
        assert "self-sufficiency" in (student_test.notes or "").lower()

    def test_unexempted_student_still_blocked_under_ma_rules(
        self, ma_rules, make_household, make_member
    ):
        hh = make_household(
            members=[
                make_member(
                    age=24,
                    student_status=StudentStatus.ENROLLED_HALF_TIME_OR_MORE,
                    student_exemption=StudentExemption.NONE,
                )
            ],
            wages=600,
        )
        result = ma_rules.determine_eligibility(hh)
        assert result.status == EligibilityStatus.INELIGIBLE

    def test_federal_exemptions_still_recognized_in_ma(
        self, ma_rules, make_household, make_member
    ):
        # Make sure MA didn't accidentally remove federal exemptions.
        hh = make_household(
            members=[
                make_member(
                    age=22,
                    student_status=StudentStatus.ENROLLED_HALF_TIME_OR_MORE,
                    student_exemption=StudentExemption.WORK_STUDY_PROGRAM,
                )
            ],
            wages=600,
        )
        assert ma_rules.determine_eligibility(hh).status == EligibilityStatus.ELIGIBLE


# ---------------------------------------------------------------------------
# Demo case from the verification plan
# ---------------------------------------------------------------------------


def test_verification_plan_canonical_case(ma_rules, make_household):
    """Verification step from the plan:

      Walk through as a 1-person household earning $1,800/month gross in
      Boston, paying $1,400/month rent. Engine should return eligible
      with a positive monthly benefit.
    """
    hh = make_household(wages=1800, rent=1400)
    result = ma_rules.determine_eligibility(hh)
    assert result.status == EligibilityStatus.ELIGIBLE
    assert result.monthly_benefit > 0
    # Required verifications should include photo ID, paystub, lease.
    codes = {rv.code for rv in result.required_verifications}
    assert "identity_photo_id" in codes
    assert "income_paystub" in codes
    assert "shelter_lease" in codes
