"""California CalFresh rules. Federal baseline plus CA overrides.

Sources:
  - CDSS Manual of Policies and Procedures (MPP), Division 63
  - CDSS All-County Letters (ACLs); most recent operative version
  - CDSS All-County Information Notices (ACINs)
  - CalFresh Handbook (CDSS)

Phase B scope: BBCE at 200% FPL, asset-test waiver, CA-specific
student exemption (EOPS / EOP&S enrollment), Restaurant Meals
Program eligibility surfacing. Still deferred:
  - CDSS-published SUA chart for FY26 (cf. iOS CAStateRules.swift)
  - CalWORKs cross-program interactions and TBA equivalents
  - County-level Restaurant Meals Program participation
  - Modified Categorical Eligibility audit log fields per ACL 09-41
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from ..federal import FederalSNAPRules, _round_dollar
from ..interfaces import (
    BenefitCalculationDetail,
    Household,
    StudentExemption,
    StudentStatus,
    TestOutcome,
)
from ..poverty_guidelines import poverty_guideline_for


# California's Modified Categorical Eligibility (MCE) program, the
# CalFresh implementation of BBCE, expands the gross-income limit to
# 200% FPL for non-elderly/non-disabled households. CDSS ACL 09-41
# and successors are the authority. The categorical trigger is
# household receipt of a TANF-funded informational brochure — Civica
# embeds the brochure in the screener consent flow so every applicant
# qualifies, matching MA's posture.
CA_BBCE_GROSS_INCOME_RATIO = Decimal("2.00")


# CA-recognized student-rule exemptions. Mirrors federal exemptions
# plus state-specific add-ons:
#   * EOPS_ENROLLED — California Community Colleges Extended
#     Opportunity Programs and Services (EOP&S) and Cooperative
#     Agencies Resources for Education (CARE). Cf. ACIN I-69-15.
#   * CALWORKS_EMPLOYMENT_SERVICES — students in approved
#     CalWORKs Welfare-to-Work employment programs.
#
# When the Python interface adds these enum cases, drop them into
# the frozenset and remove the TODO comment below. The Swift
# CAStateRules conformer does not yet collect a yes/no on EOPS
# enrollment, so this set is currently the federal default.
_CA_RECOGNIZED_EXEMPTIONS = frozenset(
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
        # TODO(launch/CA): add EOPS_ENROLLED and
        # CALWORKS_EMPLOYMENT_SERVICES once the StudentExemption enum
        # ships them; without the enum members the rule defaults to
        # the federal floor, matching the iOS conformer.
    }
)


@dataclass
class CaliforniaSNAPRules(FederalSNAPRules):
    @property
    def rules_version(self) -> str:
        return f"federal-{self.effective_date.isoformat()}/CA-{self.effective_date.isoformat()}"

    @property
    def state_code(self) -> str | None:
        return "CA"

    def _gross_income_test(self, household: Household) -> TestOutcome:
        table = poverty_guideline_for(self.effective_date)
        threshold = _round_dollar(
            table.monthly_for_household_size(household.household_size)
            * CA_BBCE_GROSS_INCOME_RATIO
        )
        # #556: forward-looking gross, same fix as the federal gate.
        actual = _round_dollar(household.income.forward_gross_monthly_total)
        return TestOutcome(
            test_name="gross_income_200pct_fpl_ca_mce",
            passes=actual <= threshold,
            threshold=threshold,
            actual=actual,
        )

    def _asset_test(self, household: Household) -> TestOutcome:
        return TestOutcome(
            test_name="asset_limit_waived_ca_mce",
            passes=True,
            notes=(
                "California Modified Categorical Eligibility (ACL 09-41) "
                "waives the asset limit for non-elderly/non-disabled "
                "households earning under 200% FPL."
            ),
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
            m.student_exemption in _CA_RECOGNIZED_EXEMPTIONS
            and m.student_exemption != StudentExemption.NONE
            for m in applicants_at_risk
        )
        return TestOutcome(
            test_name="student_rule_ca",
            passes=all_exempt,
            notes=(
                "CA recognizes EOPS/EOP&S enrollment and approved "
                "CalWORKs employment programs in addition to federal "
                "exemptions (ACIN I-69-15)."
            ),
        )

    def _effective_utility_cost(self, household: Household) -> Decimal:
        # CDSS publishes the FY26 CalFresh SUA chart via annual
        # All-County Letter. Until that's loaded into the
        # poverty_guidelines.sua_table_for() registry under the "CA"
        # key, fall back to actuals (federal default). Mirrors the
        # Swift CAStateRules.suaValue stub which returns nil for the
        # same reason.
        return household.expenses.utilities_actual

    def _contributing_factors(
        self, household: Household, benefit: BenefitCalculationDetail
    ) -> list[str]:
        factors = super()._contributing_factors(household, benefit)
        factors.append("ca_mce_applied")
        return factors

    def restaurant_meals_program_eligibility(
        self, household: Household
    ) -> dict:
        """California operates the Restaurant Meals Program (RMP) in
        a growing number of counties. The household-level qualifying
        criteria are federal: elderly (60+), disabled, or unhoused.
        County participation is the gating variable — this method
        answers the household question only. Surfaces should pair
        the answer with a county-participation lookup before
        rendering a "use your EBT at restaurants" CTA.

        Mirrors the iOS `CAStateRules.restaurantMealsProgramEligibility(for:asOf:)`
        contract so the offline gate (iOS) and the authoritative
        engine (this) agree on the same household answer.
        """
        reasons: list[str] = []
        has_elderly = any(m.age >= 60 for m in household.members)
        has_disabled = any(
            getattr(m, "is_disabled", False) for m in household.members
        )
        is_unhoused = getattr(household, "is_unhoused", False)

        if has_elderly:
            reasons.append("elderly")
        if has_disabled:
            reasons.append("disabled")
        if is_unhoused:
            reasons.append("unhoused")

        if reasons:
            return {"status": "eligible", "reasons": reasons}
        return {"status": "not_eligible", "reasons": []}
