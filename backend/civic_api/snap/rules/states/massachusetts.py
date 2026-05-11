"""Massachusetts SNAP rules. Federal baseline plus state overrides.

Sources:
  - 106 CMR 363, 364, 365 (MA SNAP regulations)
  - MA DTA Field Operations Memos (FOMs), most recent operative version
  - DTA Online Guide ("BEACON Online")

Phase B scope: BBCE, SUA chart, MA-specific student exemption (DTA-
approved self-sufficiency programs). Still deferred:
  - MA EAEDC interactions
  - MA disability standard (106 CMR 361.230) — broader than federal
  - Transitional Benefits (TBA) for households leaving TAFDC
  - Per-member program-receipt tracking for true cash categorical
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from ..federal import FederalSNAPRules, _round_dollar
from ..interfaces import (
    BenefitCalculationDetail,
    Household,
    SUATier,
    StudentExemption,
    StudentStatus,
    TestOutcome,
)
from ..poverty_guidelines import poverty_guideline_for, sua_table_for


# Massachusetts BBCE expands the gross-income limit to 200% FPL. MA's
# BBCE technically requires the household to receive a TANF-funded
# service (the DTA SNAP brochure given at intake); MA DTA confirms in
# practice every applicant qualifies. Civica embeds the brochure in the
# screener consent flow so the trigger is met for every session.
MA_BBCE_GROSS_INCOME_RATIO = Decimal("2.00")

# 106 CMR 362.410: Massachusetts self-sufficiency exemption — students
# enrolled in DTA-approved career/technical/ABE/ESOL programs are
# exempt from the federal student rule. Modeled here as an additional
# StudentExemption value the federal _student_test must accept.
_MA_RECOGNIZED_EXEMPTIONS = frozenset(
    {
        StudentExemption.UNDER_18_OR_OVER_50,
        StudentExemption.UNABLE_TO_WORK,
        StudentExemption.WORKS_20_HOURS_PER_WEEK,
        StudentExemption.WORK_STUDY_PROGRAM,
        StudentExemption.PARENT_OF_CHILD_UNDER_6,
        StudentExemption.PARENT_OF_CHILD_6_TO_11_NO_CHILDCARE,
        StudentExemption.SINGLE_PARENT_FULL_TIME,
        StudentExemption.RECEIVES_TANF,
        StudentExemption.PARTICIPATES_IN_EMPLOYMENT_TRAINING,
        StudentExemption.DTA_APPROVED_SELF_SUFFICIENCY,
    }
)


@dataclass
class MassachusettsSNAPRules(FederalSNAPRules):
    @property
    def rules_version(self) -> str:
        return f"federal-{self.effective_date.isoformat()}/MA-{self.effective_date.isoformat()}"

    def _gross_income_test(self, household: Household) -> TestOutcome:
        table = poverty_guideline_for(self.effective_date)
        threshold = _round_dollar(
            table.monthly_for_household_size(household.household_size)
            * MA_BBCE_GROSS_INCOME_RATIO
        )
        actual = _round_dollar(household.income.gross_monthly_total)
        return TestOutcome(
            test_name="gross_income_200pct_fpl_ma_bbce",
            passes=actual <= threshold,
            threshold=threshold,
            actual=actual,
        )

    def _asset_test(self, household: Household) -> TestOutcome:
        return TestOutcome(
            test_name="asset_limit_waived_ma_bbce",
            passes=True,
            notes="Massachusetts BBCE waives the asset limit.",
        )

    def _student_test(self, household: Household) -> TestOutcome:
        applicants_at_risk = [
            m
            for m in household.members
            if m.is_applicant
            and m.student_status == StudentStatus.ENROLLED_HALF_TIME_OR_MORE
            and 18 <= m.age <= 49
        ]
        if not applicants_at_risk:
            return TestOutcome(test_name="student_rule", passes=True)
        all_exempt = all(
            m.student_exemption in _MA_RECOGNIZED_EXEMPTIONS
            and m.student_exemption != StudentExemption.NONE
            for m in applicants_at_risk
        )
        return TestOutcome(
            test_name="student_rule_ma",
            passes=all_exempt,
            notes=(
                "MA recognizes DTA-approved self-sufficiency programs "
                "in addition to federal exemptions (106 CMR 362.410)."
            ),
        )

    def _effective_utility_cost(self, household: Household) -> Decimal:
        tier = household.expenses.sua_tier
        if tier == SUATier.NONE:
            return household.expenses.utilities_actual
        return sua_table_for(self.effective_date).lookup("MA", tier.value)

    def _contributing_factors(
        self, household: Household, benefit: BenefitCalculationDetail
    ) -> list[str]:
        factors = super()._contributing_factors(household, benefit)
        factors.append("ma_bbce_applied")
        if household.expenses.sua_tier != SUATier.NONE:
            factors.append(f"ma_sua_{household.expenses.sua_tier.value}_applied")
        return factors
