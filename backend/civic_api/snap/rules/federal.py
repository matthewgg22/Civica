"""Federal SNAP eligibility rules per 7 CFR 273.

This is a Phase A skeleton. The simplest path (single non-elderly
non-disabled US citizen, wages only, standard deduction, no BBCE) is
implemented end-to-end so the conversational pipeline can be developed
against a real engine. The messier paths (BBCE, categorical eligibility,
ABAWD time limit, mixed-status households, student exemptions) raise
`NotImplementedFederalRule` and must be filled in during Phase B with
explicit test cases for each.

Design intent: this class is subclassed by state rules. Each state
overrides the methods where it diverges from the federal baseline
(e.g. Massachusetts overrides _gross_income_test for BBCE).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from .interfaces import (
    CitizenshipStatus,
    EligibilityResult,
    EligibilityStatus,
    Household,
    HouseholdMember,
    RequiredVerification,
    StudentStatus,
    StudentExemption,
    TestOutcome,
    BenefitCalculationDetail,
)
from .immigration import resolve_immigration
from .income_adjustments import exclude_minor_student_earnings
from .parameters import params_for
from .proration import countable_household
from .state_parameters import state_params_for
from .work_requirement import resolve_work_requirements
from .poverty_guidelines import (
    max_allotment_for,
    poverty_guideline_for,
)


class NotImplementedFederalRule(NotImplementedError):
    """Raised when a household configuration hits a rule path the Phase A
    skeleton doesn't yet handle. Caught and surfaced as a logged
    'insufficient_information' result, never as an unhandled exception."""


def _round_dollar(value: Decimal) -> Decimal:
    """SNAP rounds monetary results to whole dollars at calculation steps."""
    return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


@dataclass
class FederalSNAPRules:
    effective_date: date

    @property
    def rules_version(self) -> str:
        return f"federal-{self.effective_date.isoformat()}"

    def determine_eligibility(self, household: Household) -> EligibilityResult:
        # Pre-transforms — each identity when its fields are unset, so ordinary
        # determinations are byte-identical: §20 minor-student earnings exclusion;
        # §10108 immigration flags ineligible noncitizens for regime-B exclusion;
        # §10102 ABAWD timeout flags timed-out members for regime-A exclusion; §16
        # proration then collapses to the countable view.
        household = exclude_minor_student_earnings(household)
        household = resolve_immigration(household, self.effective_date)
        household = resolve_work_requirements(household, self.effective_date)
        household = countable_household(household)
        if not household.members:
            return EligibilityResult.ineligible(
                reason="No eligible household members after exclusions.",
                effective_date=self.effective_date,
                rules_version=self.rules_version,
                test_outcomes=[],
            )
        outcomes: list[TestOutcome] = []

        # 1. Citizenship gate.
        cit = self._citizenship_test(household)
        outcomes.append(cit)
        if not cit.passes:
            return EligibilityResult.ineligible(
                reason="One or more applicants are not in an eligible citizenship category.",
                effective_date=self.effective_date,
                rules_version=self.rules_version,
                test_outcomes=outcomes,
            )

        # 2. Student rule (per 7 CFR 273.5).
        student = self._student_test(household)
        outcomes.append(student)
        if not student.passes:
            return EligibilityResult.ineligible(
                reason=(
                    "Student rule: applicant is enrolled at least half time in "
                    "higher education without a qualifying exemption."
                ),
                effective_date=self.effective_date,
                rules_version=self.rules_version,
                test_outcomes=outcomes,
            )

        # 3. Categorical eligibility (broad-based or pure cash-recipient).
        # Phase B: full implementation. For now, only flag the pure cash-recipient
        # path (TANF or SSI for every member) and skip BBCE entirely.
        is_categorical = self._is_pure_cash_categorical(household)

        # 4. Income tests.
        gross = self._gross_income_test(household)
        outcomes.append(gross)
        if not is_categorical and not gross.passes and not household.has_elderly_or_disabled:
            return EligibilityResult.ineligible(
                reason=(
                    f"Gross monthly income (${gross.actual}) exceeds the applicable "
                    f"threshold (${gross.threshold})."
                ),
                effective_date=self.effective_date,
                rules_version=self.rules_version,
                test_outcomes=outcomes,
            )

        net_calc = self._compute_net_income(household)
        net = self._net_income_test(household, net_calc.net_monthly_income)
        outcomes.append(net)
        if not is_categorical and not net.passes:
            return EligibilityResult.ineligible(
                reason=(
                    f"Net monthly income (${net.actual}) exceeds the federal poverty "
                    f"level (${net.threshold})."
                ),
                effective_date=self.effective_date,
                rules_version=self.rules_version,
                test_outcomes=outcomes,
            )

        # 5. Asset test (federal). States with BBCE waive this; the
        # Massachusetts subclass overrides _asset_test accordingly.
        asset = self._asset_test(household)
        outcomes.append(asset)
        if not is_categorical and not asset.passes:
            return EligibilityResult.ineligible(
                reason="Countable resources exceed the federal asset limit.",
                effective_date=self.effective_date,
                rules_version=self.rules_version,
                test_outcomes=outcomes,
            )

        # 6. Compute benefit.
        benefit = self._compute_benefit(household, net_calc)
        expedited = self._is_expedited_eligible(household)
        return EligibilityResult(
            status=EligibilityStatus.ELIGIBLE,
            monthly_benefit=benefit.monthly_benefit,
            expedited_eligible=expedited,
            contributing_factors=self._contributing_factors(household, benefit),
            required_verifications=self._required_verifications(household, expedited),
            test_outcomes=outcomes,
            benefit_calculation=benefit,
            effective_date=self.effective_date,
            rules_version=self.rules_version,
        )

    # -------------------------------------------------------------------
    # Tests (overridable by state subclasses)
    # -------------------------------------------------------------------

    def _citizenship_test(self, household: Household) -> TestOutcome:
        applicants = [m for m in household.members if m.is_applicant]
        eligible = all(
            m.citizenship in (CitizenshipStatus.US_CITIZEN, CitizenshipStatus.QUALIFIED_NONCITIZEN)
            for m in applicants
        )
        if any(m.citizenship == CitizenshipStatus.UNKNOWN for m in applicants):
            return TestOutcome(
                test_name="citizenship",
                passes=False,
                notes="Citizenship not yet determined for all applicants.",
            )
        return TestOutcome(test_name="citizenship", passes=eligible)

    def _student_test(self, household: Household) -> TestOutcome:
        # 7 CFR 273.5: students 18-49 enrolled half-time or more in higher
        # education are ineligible unless they meet an exemption. Mixed-
        # student households still run for the non-student members.
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
            m.student_exemption != StudentExemption.NONE for m in applicants_at_risk
        )
        return TestOutcome(test_name="student_rule", passes=all_exempt)

    def _gross_income_test(self, household: Household) -> TestOutcome:
        table = poverty_guideline_for(self.effective_date)
        threshold = _round_dollar(
            table.monthly_for_household_size(household.household_size)
            * params_for(self.effective_date).gross_income_ratio
        )
        # #556: forward-looking gross — a household whose wages just ended
        # is tested against $0 income for THIS gate, not their now-stale
        # former salary. Matches _is_expedited_eligible's effective_gross.
        actual = _round_dollar(household.income.forward_gross_monthly_total)
        return TestOutcome(
            test_name="gross_income_130pct_fpl",
            passes=actual <= threshold,
            threshold=threshold,
            actual=actual,
        )

    def _net_income_test(
        self, household: Household, net_monthly: Decimal
    ) -> TestOutcome:
        table = poverty_guideline_for(self.effective_date)
        threshold = _round_dollar(
            table.monthly_for_household_size(household.household_size)
            * params_for(self.effective_date).net_income_ratio
        )
        actual = _round_dollar(net_monthly)
        return TestOutcome(
            test_name="net_income_100pct_fpl",
            passes=actual <= threshold,
            threshold=threshold,
            actual=actual,
        )

    def _asset_test(self, household: Household) -> TestOutcome:
        p = params_for(self.effective_date)
        limit = (
            p.asset_limit_elderly_disabled
            if household.has_elderly_or_disabled
            else p.asset_limit_household
        )
        actual = household.assets.countable_resources
        return TestOutcome(
            test_name="asset_limit",
            passes=actual <= limit,
            threshold=limit,
            actual=actual,
        )

    # -------------------------------------------------------------------
    # Net income computation
    # -------------------------------------------------------------------

    def _compute_net_income(self, household: Household) -> BenefitCalculationDetail:
        # #556: forward-looking totals — a recently laid-off worker's
        # benefit is computed on their CURRENT ($0) wages, not their
        # former salary. is_ongoing defaults True, so households that
        # don't set the flag compute identically to before this fix.
        gross = household.income.forward_gross_monthly_total
        earned = household.income.forward_earned_monthly_total

        p = params_for(self.effective_date)
        earned_deduction = _round_dollar(earned * p.earned_income_deduction_rate)
        standard_deduction = p.standard_deduction(household.household_size)

        dep_care = household.expenses.dependent_care
        child_support = household.expenses.legally_obligated_child_support_paid

        # Medical deduction: only for elderly/disabled members, only the
        # portion above $35.
        medical = Decimal("0")
        if household.has_elderly_or_disabled:
            raw_medical = household.expenses.medical_out_of_pocket_elderly_disabled
            if raw_medical > Decimal("35"):
                itemized = raw_medical - Decimal("35")
                # Standard medical deduction (state option): take the flat standard, or the
                # itemized excess-over-$35 when that is higher. Federal/no-standard states
                # keep the itemized excess only — so those determinations are unchanged.
                standard = state_params_for(household.state).standard_medical_deduction
                medical = max(standard, itemized) if standard is not None else itemized

        # Excess shelter: shelter costs above 50% of (gross - earned_deduction
        # - standard_deduction - dep_care - medical - child_support), capped
        # at the FY excess-shelter cap unless household has an
        # elderly or disabled member.
        adjusted_income = (
            gross - earned_deduction - standard_deduction - dep_care - medical - child_support
        )
        if adjusted_income < 0:
            adjusted_income = Decimal("0")
        half_adjusted = adjusted_income / Decimal("2")
        shelter_costs = (
            household.expenses.rent_or_mortgage
            + household.expenses.property_taxes
            + household.expenses.homeowners_insurance
            + self._effective_utility_cost(household)
        )
        excess_shelter_raw = shelter_costs - half_adjusted
        if excess_shelter_raw < 0:
            excess_shelter = Decimal("0")
        elif household.has_elderly_or_disabled:
            excess_shelter = excess_shelter_raw
        else:
            excess_shelter = min(excess_shelter_raw, p.excess_shelter_cap)

        net = (
            gross
            - earned_deduction
            - standard_deduction
            - dep_care
            - medical
            - child_support
            - excess_shelter
        )
        if net < 0:
            net = Decimal("0")

        thirty_pct_net = _round_dollar(net * p.benefit_reduction_rate)
        max_allot = max_allotment_for(self.effective_date).for_household_size(
            household.household_size
        )
        monthly_benefit = max_allot - thirty_pct_net
        # Federal minimum benefit for 1- and 2-person households.
        # Larger households can be approved with $0; small households cannot.
        min_benefit = p.minimum_benefit
        if household.household_size <= 2 and Decimal("0") < monthly_benefit < min_benefit:
            monthly_benefit = min_benefit
        if monthly_benefit < 0:
            monthly_benefit = Decimal("0")

        return BenefitCalculationDetail(
            gross_monthly_income=_round_dollar(gross),
            earned_income_deduction=earned_deduction,
            standard_deduction=standard_deduction,
            dependent_care_deduction=_round_dollar(dep_care),
            medical_deduction=_round_dollar(medical),
            child_support_deduction=_round_dollar(child_support),
            excess_shelter_deduction=_round_dollar(excess_shelter),
            net_monthly_income=_round_dollar(net),
            thirty_percent_of_net=thirty_pct_net,
            max_allotment_for_household_size=max_allot,
            monthly_benefit=_round_dollar(monthly_benefit),
        )

    def _compute_benefit(
        self, household: Household, net_calc: BenefitCalculationDetail
    ) -> BenefitCalculationDetail:
        return net_calc

    def _effective_utility_cost(self, household: Household) -> Decimal:
        """Federal default: utilities are whatever the household reported.

        State subclasses with FNS-approved SUAs (most states) override
        this to substitute the SUA when the household elects it.
        """
        return household.expenses.utilities_actual

    # -------------------------------------------------------------------
    # Categorical eligibility — Phase A: pure-cash-recipient path only.
    # -------------------------------------------------------------------

    def _is_pure_cash_categorical(self, household: Household) -> bool:
        """7 CFR 273.2(j)(2)(i): household is categorically eligible if every
        member receives TANF, SSI, or General Assistance.

        Modeled at household level here for Phase B; the more correct
        per-member implementation requires lifting receives_* flags onto
        HouseholdMember and is tracked as a follow-up. Until then, this
        treats the household-level booleans as "every member receives
        this program" — which the conversational pipeline must enforce
        when it sets the flag.

        BBCE (broad-based categorical eligibility) is the more common
        path and is implemented per-state.
        """
        return (
            household.receives_tanf
            or household.receives_ssi
            or household.receives_general_assistance
        )

    # -------------------------------------------------------------------
    # Expedited service (7 CFR 273.2(i))
    # -------------------------------------------------------------------

    def _is_expedited_eligible(self, household: Household) -> bool:
        # Use forward-looking gross: only income sources still paying.
        # A household whose wages just ended has effective_gross = $0 —
        # matching the regulatory intent that terminated income not count
        # against the expedited threshold. is_ongoing defaults True so
        # households that don't set the flag behave identically to before.
        effective_gross = sum(
            (s.monthly_gross for s in household.income.sources if s.is_ongoing),
            Decimal("0"),
        )
        liquid = household.assets.countable_resources
        # 7 CFR 273.2(i)(1)(iii) and 58 Fed. Reg. 58448 require the SUA when
        # the household is entitled to it — not actual utility costs. Delegating
        # to _effective_utility_cost keeps this consistent with the net income
        # calculation and lets state subclasses substitute their SUA tables.
        shelter = (
            household.expenses.rent_or_mortgage
            + self._effective_utility_cost(household)
        )
        # Path 1: 7 CFR 273.2(i)(1)(i)
        if effective_gross < Decimal("150") and liquid <= Decimal("100"):
            return True
        # Path 2: 7 CFR 273.2(i)(1)(iii)
        if (effective_gross + liquid) < shelter:
            return True
        # Path 3: 7 CFR 273.2(i)(1)(ii) — destitute migrant/seasonal farmworker.
        # "Destitute" per 7 CFR 273.10(e)(3) requires two conditions:
        #   A. Liquid resources ≤ $100.
        #   B. Income-source status: all sources are terminated (is_ongoing=False)
        #      OR from a new employer where ≤ $25 will arrive within 10 days.
        # Condition B is now fully implemented using IncomeSource.is_ongoing and
        # Household.new_source_income_within_10_days.
        if household.is_seasonal_or_migrant_farmworker and liquid <= Decimal("100"):
            all_sources_terminated = all(
                not s.is_ongoing for s in household.income.sources
            ) if household.income.sources else True
            new_source_is_negligible = (
                household.new_source_income_within_10_days <= Decimal("25")
            )
            if all_sources_terminated and new_source_is_negligible:
                return True
        return False

    # -------------------------------------------------------------------
    # Verification list (drives the iOS doc-upload UI)
    # -------------------------------------------------------------------

    def _required_verifications(
        self, household: Household, expedited_eligible: bool = False
    ) -> list[RequiredVerification]:
        # For expedited households only identity must be verified upfront;
        # all other verifications may be postponed until continuation
        # (7 CFR 273.2(i)(4)). can_be_postponed_for_expedited signals this
        # to the iOS doc-upload UI and the navigator checklist.
        verifications: list[RequiredVerification] = [
            RequiredVerification(
                code="identity_photo_id",
                label_en="Photo ID",
                label_es="Identificación con foto",
                explanation_en="A driver's license, state ID, passport, or similar.",
                explanation_es="Licencia de conducir, identificación estatal, pasaporte o similar.",
                can_be_postponed_for_expedited=False,
            ),
        ]
        # Deliberately NOT forward_earned_monthly_total (#556): even a
        # terminated earned source still needs its most-recent paystub
        # verified/documented (proof the income existed before it ended),
        # so this stays on the raw (unfiltered) total on purpose.
        if household.income.earned_monthly_total > 0:
            verifications.append(
                RequiredVerification(
                    code="income_paystub",
                    label_en="Recent paystub",
                    label_es="Recibo de pago reciente",
                    explanation_en="Most recent paystub covering the last 30 days.",
                    explanation_es="El recibo de pago más reciente que cubra los últimos 30 días.",
                    can_be_postponed_for_expedited=expedited_eligible,
                )
            )
        if household.expenses.rent_or_mortgage > 0:
            verifications.append(
                RequiredVerification(
                    code="shelter_lease",
                    label_en="Lease or mortgage statement",
                    label_es="Contrato de arrendamiento o estado de cuenta hipotecario",
                    explanation_en="Proof of monthly housing cost.",
                    explanation_es="Comprobante del costo mensual de vivienda.",
                    can_be_postponed_for_expedited=expedited_eligible,
                )
            )
        from .interfaces import SUATier as _SUATier

        if (
            household.expenses.utilities_actual > 0
            and household.expenses.sua_tier == _SUATier.NONE
        ):
            verifications.append(
                RequiredVerification(
                    code="utility_bill",
                    label_en="Utility bill",
                    label_es="Factura de servicios públicos",
                    explanation_en="Most recent bill if you are not using the state's standard utility allowance.",
                    explanation_es="Factura más reciente si no está usando la asignación estándar estatal.",
                    can_be_postponed_for_expedited=expedited_eligible,
                )
            )
        return verifications

    def _contributing_factors(
        self, household: Household, benefit: BenefitCalculationDetail
    ) -> list[str]:
        factors: list[str] = []
        if household.has_elderly_or_disabled:
            factors.append("household_contains_elderly_or_disabled_member")
        if benefit.excess_shelter_deduction > 0:
            factors.append("excess_shelter_deduction_applied")
        # #556: read the deduction the calc ACTUALLY applied, not the raw
        # (possibly-terminated, no-longer-contributing) earned total —
        # otherwise a household whose only earned source ended would still
        # get "earned_income_deduction_applied" listed despite the $0
        # forward-looking deduction _compute_net_income now uses above.
        if benefit.earned_income_deduction > 0:
            factors.append("earned_income_deduction_applied")
        return factors
