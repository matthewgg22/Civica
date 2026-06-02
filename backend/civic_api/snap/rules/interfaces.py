"""Pydantic input/output schemas for the SNAP eligibility rules engine.

These models are the contract between three layers:
  - The conversational pipeline, which assembles a Household from collected
    user answers and asks the engine "what's still needed?"
  - The deterministic rules engine itself (federal + state subclasses).
  - The iOS client and PDF generator, which render the EligibilityResult.

All monetary amounts are stored as `Decimal` to avoid float drift in the
benefit calculation (the federal rules round to whole dollars at specific
points; partial-dollar drift can flip a determination).
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class EligibilityStatus(str, Enum):
    ELIGIBLE = "eligible"
    INELIGIBLE = "ineligible"
    ELIGIBLE_WITH_CONDITIONS = "eligible_with_conditions"
    INSUFFICIENT_INFORMATION = "insufficient_information"


class CitizenshipStatus(str, Enum):
    US_CITIZEN = "us_citizen"
    QUALIFIED_NONCITIZEN = "qualified_noncitizen"
    INELIGIBLE_NONCITIZEN = "ineligible_noncitizen"
    UNKNOWN = "unknown"


class StudentStatus(str, Enum):
    NOT_STUDENT = "not_student"
    ENROLLED_HALF_TIME_OR_MORE = "enrolled_half_time_or_more"
    ENROLLED_LESS_THAN_HALF_TIME = "enrolled_less_than_half_time"
    UNKNOWN = "unknown"


class StudentExemption(str, Enum):
    """7 CFR 273.5(b) exemptions allowing student SNAP eligibility.

    State agencies may add broader exemptions. Massachusetts adds
    DTA_APPROVED_SELF_SUFFICIENCY (106 CMR 362.410) covering certain
    career-and-technical and ABE/ESOL programs that don't fit the
    federal categories.
    """

    UNDER_18_OR_OVER_50 = "under_18_or_over_50"
    UNABLE_TO_WORK = "unable_to_work"
    WORKS_20_HOURS_PER_WEEK = "works_20_hours_per_week"
    WORK_STUDY_PROGRAM = "work_study_program"
    PARENT_OF_CHILD_UNDER_6 = "parent_of_child_under_6"
    PARENT_OF_CHILD_6_TO_11_NO_CHILDCARE = "parent_of_child_6_to_11_no_childcare"
    SINGLE_PARENT_FULL_TIME = "single_parent_full_time"
    RECEIVES_TANF = "receives_tanf"
    PARTICIPATES_IN_EMPLOYMENT_TRAINING = "participates_in_employment_training"
    DTA_APPROVED_SELF_SUFFICIENCY = "dta_approved_self_sufficiency"
    NONE = "none"


class SUATier(str, Enum):
    """Standard Utility Allowance tier the household qualifies for.

    States publish per-tier dollar amounts (e.g. MA: heating/cooling=$799,
    non-heating=$507, phone-only=$63 in FY25). When the household elects
    SUA on its application, this enum tells the rules engine which row
    to use in place of actual utility costs.

    Set `NONE` for households that elect to itemize actual utilities
    instead, or that have no utility expenses at all.
    """

    NONE = "none"
    HEATING_COOLING = "heating_cooling"
    NON_HEATING = "non_heating"
    PHONE_ONLY = "phone_only"


class ExclusionReason(str, Enum):
    """Why a member is excluded from the eligible unit — selects the §16 proration
    regime (see rules/proration.py). In all cases the member's needs leave household size.

    Regime A — full income count, deductions retained (7 CFR 273.11(c)(2)).
    Regime B — income + billed shelter/dependent-care prorated by the eligible
               fraction f = n_eligible / n_total (7 CFR 273.11(c)(1)).
    """
    # Regime A
    IPV = "ipv"
    WORK_REQUIREMENT = "work_requirement"
    SSN_NONCOMPLIANCE = "ssn_noncompliance"
    FLEEING_FELON = "fleeing_felon"
    DRUG_FELONY = "drug_felony"
    # Regime B
    INELIGIBLE_NONCITIZEN = "ineligible_noncitizen"
    SSN_REFUSER = "ssn_refuser"


class ImmigrationStatus(str, Enum):
    """Granular immigration status for §10108 (post-OBBBA) resolution.

    Resolved to eligible / ineligible / contested / pending as-of the determination
    date by rules/immigration.py — the §10108 noncitizen removals are effective
    2025-07-04 (enactment), NOT 2025-11-01, a point-in-time boundary.
    """
    US_CITIZEN = "us_citizen"
    US_NATIONAL = "us_national"
    LPR = "lpr"                                    # qualified LPR (5-yr-bar = v1 simplification)
    CUBAN_HAITIAN = "cuban_haitian"
    COFA = "cofa"
    REFUGEE = "refugee"                            # removed by §10108
    ASYLEE = "asylee"                              # removed by §10108
    WITHHOLDING = "withholding"                    # removed by §10108
    PAROLEE = "parolee"                            # removed by §10108 (incl. Afghan/Ukrainian)
    VAWA_SELF_PETITIONER = "vawa_self_petitioner"  # removed by §10108
    UNDOCUMENTED = "undocumented"                  # always ineligible
    DACA = "daca"                                  # always ineligible (the misconception trap)
    TEMP_VISA = "temp_visa"                        # always ineligible
    TPS = "tps"                                    # always ineligible
    H2A = "h2a"                                    # always ineligible
    T_VISA = "t_visa"                              # ⚠ CONTESTED (under litigation)
    UNKNOWN = "unknown"


class HouseholdMember(BaseModel):
    """One member of the food household.

    A 'household' for SNAP is the set of people who buy and prepare food
    together, which can differ from a tax household or a residential
    household. See 7 CFR 273.1.
    """

    model_config = ConfigDict(extra="forbid")

    member_id: str
    age: int = Field(ge=0, le=130)
    is_applicant: bool = False
    is_elderly: bool = Field(
        default=False,
        description="60 or older. Triggers elderly/disabled deduction rules.",
    )
    is_disabled: bool = Field(
        default=False,
        description="Receives federally-recognized disability benefits or meets the SNAP disability definition.",
    )
    is_pregnant: bool = False
    citizenship: CitizenshipStatus = CitizenshipStatus.UNKNOWN
    student_status: StudentStatus = Field(
        default=StudentStatus.UNKNOWN,
        description=(
            "Defaults to UNKNOWN so the conversational pipeline can distinguish "
            "'we have not asked yet' from 'user said they are not a student'. "
            "The federal student rule treats UNKNOWN as not-enrolled-half-time, "
            "so the rules engine produces a safe determination if asked early."
        ),
    )
    student_exemption: StudentExemption = StudentExemption.NONE
    is_abawd: bool = Field(
        default=False,
        description="Able-bodied adult without dependents — triggers the 3-month time limit unless work-program participation is met.",
    )
    is_work_registered: bool = True
    eligibility_exclusion: ExclusionReason | None = Field(
        default=None,
        description="If set, the member is excluded from the eligible unit; the reason "
        "selects the §16 proration regime. None = counted as a normal member.",
    )
    immigration_status: ImmigrationStatus | None = Field(
        default=None,
        description="Granular immigration status; resolved as-of the determination date "
        "by rules/immigration.py (§10108). When set it drives eligibility/exclusion and "
        "overrides the coarse `citizenship` for the determination.",
    )


class IncomeSource(BaseModel):
    model_config = ConfigDict(extra="forbid")

    member_id: str
    source_type: str = Field(
        description="Categorical type: 'wages', 'self_employment', 'unemployment', 'social_security', 'ssi', 'tanf', 'child_support_received', 'other'.",
    )
    monthly_gross: Decimal = Field(ge=0)
    is_earned: bool = Field(
        description="True for wages and self-employment net earnings (gets the 20% earned income deduction). False for unearned (UI, SS, child support, etc.).",
    )


class IncomeFacts(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sources: list[IncomeSource] = Field(default_factory=list)

    @property
    def gross_monthly_total(self) -> Decimal:
        return sum((s.monthly_gross for s in self.sources), Decimal("0"))

    @property
    def earned_monthly_total(self) -> Decimal:
        return sum(
            (s.monthly_gross for s in self.sources if s.is_earned),
            Decimal("0"),
        )

    @property
    def unearned_monthly_total(self) -> Decimal:
        return sum(
            (s.monthly_gross for s in self.sources if not s.is_earned),
            Decimal("0"),
        )


class ExpenseFacts(BaseModel):
    """Monthly expenses that drive shelter and other deductions.

    Per 7 CFR 273.9(d):
      - Dependent care: actual cost of care for a child or disabled adult that
        enables a household member to work, train, or attend school.
      - Medical: out-of-pocket medical for elderly or disabled members above $35.
      - Shelter: rent/mortgage + property taxes + insurance + utilities. The
        excess shelter deduction caps at a federal max unless the household
        contains an elderly or disabled member.
      - Child support paid to a non-household member: deducted from gross.
    """

    model_config = ConfigDict(extra="forbid")

    rent_or_mortgage: Decimal = Field(default=Decimal("0"), ge=0)
    property_taxes: Decimal = Field(default=Decimal("0"), ge=0)
    homeowners_insurance: Decimal = Field(default=Decimal("0"), ge=0)
    utilities_actual: Decimal = Field(default=Decimal("0"), ge=0)
    sua_tier: SUATier = Field(
        default=SUATier.NONE,
        description="If not NONE, state-published SUA replaces utilities_actual in the shelter deduction calculation.",
    )
    dependent_care: Decimal = Field(default=Decimal("0"), ge=0)
    medical_out_of_pocket_elderly_disabled: Decimal = Field(default=Decimal("0"), ge=0)
    legally_obligated_child_support_paid: Decimal = Field(default=Decimal("0"), ge=0)


class AssetFacts(BaseModel):
    model_config = ConfigDict(extra="forbid")

    countable_resources: Decimal = Field(default=Decimal("0"), ge=0)
    has_excluded_vehicle: bool = True


class Household(BaseModel):
    """Complete input to the rules engine for a single eligibility determination."""

    model_config = ConfigDict(extra="forbid")

    state: str = Field(min_length=2, max_length=2, description="USPS state code, uppercase.")
    members: list[HouseholdMember]
    income: IncomeFacts = Field(default_factory=IncomeFacts)
    expenses: ExpenseFacts = Field(default_factory=ExpenseFacts)
    assets: AssetFacts = Field(default_factory=AssetFacts)
    receives_tanf: bool = False
    receives_ssi: bool = False
    receives_general_assistance: bool = False
    is_homeless: bool = False
    is_seasonal_or_migrant_farmworker: bool = False

    @property
    def has_elderly_or_disabled(self) -> bool:
        return any(m.is_elderly or m.is_disabled for m in self.members)

    @property
    def has_dependent_under_6(self) -> bool:
        return any(m.age < 6 and not m.is_applicant for m in self.members)

    @property
    def household_size(self) -> int:
        return len(self.members)


# ---------------------------------------------------------------------------
# Output side
# ---------------------------------------------------------------------------


class RequiredVerification(BaseModel):
    """A document or attestation the state will require to finalize this case.

    Drives the document-upload UI on iOS and the Ask-Selector's question
    prioritization in the conversational pipeline.
    """

    model_config = ConfigDict(extra="forbid")

    code: str = Field(
        description="Stable identifier, e.g. 'income_paystub', 'identity_photo_id', 'shelter_lease'.",
    )
    label_en: str
    label_es: str
    explanation_en: str
    explanation_es: str
    is_required_for_initial_application: bool = True
    can_be_postponed_for_expedited: bool = False


class TestOutcome(BaseModel):
    """Outcome of a single eligibility test (gross income, net income, etc.)."""

    model_config = ConfigDict(extra="forbid")

    test_name: str
    passes: bool
    threshold: Decimal | None = None
    actual: Decimal | None = None
    notes: str = ""


class BenefitCalculationDetail(BaseModel):
    """Audit trail for the benefit amount calculation. Every deduction
    that fed into the final number is itemized here."""

    model_config = ConfigDict(extra="forbid")

    gross_monthly_income: Decimal
    earned_income_deduction: Decimal
    standard_deduction: Decimal
    dependent_care_deduction: Decimal
    medical_deduction: Decimal
    child_support_deduction: Decimal
    excess_shelter_deduction: Decimal
    net_monthly_income: Decimal
    thirty_percent_of_net: Decimal
    max_allotment_for_household_size: Decimal
    monthly_benefit: Decimal


class EligibilityResult(BaseModel):
    """The single source of truth for an eligibility determination.

    Persisted to snap_eligibility_results in Supabase. Used by:
      - iOS to render the verdict screen.
      - Pipeline Ask-Selector to know which questions are still needed.
      - PDF generator to populate state form fields.
      - Audit log to prove what we told the user and why.

    Always re-computable: feed the same Household + effective_date + state
    rules version into the engine and you must get bit-identical output.
    """

    model_config = ConfigDict(extra="forbid")

    status: EligibilityStatus
    monthly_benefit: Decimal | None = None
    expedited_eligible: bool = False
    contributing_factors: list[str] = Field(default_factory=list)
    required_verifications: list[RequiredVerification] = Field(default_factory=list)
    test_outcomes: list[TestOutcome] = Field(default_factory=list)
    benefit_calculation: BenefitCalculationDetail | None = None
    ineligibility_reason: str | None = None
    effective_date: date
    rules_version: str = Field(
        description="Identifier for the federal+state rules used. Format: 'federal-YYYYMMDD/<STATE>-YYYYMMDD'.",
    )

    @classmethod
    def ineligible(
        cls,
        *,
        reason: str,
        effective_date: date,
        rules_version: str,
        test_outcomes: list[TestOutcome] | None = None,
    ) -> "EligibilityResult":
        return cls(
            status=EligibilityStatus.INELIGIBLE,
            ineligibility_reason=reason,
            effective_date=effective_date,
            rules_version=rules_version,
            test_outcomes=test_outcomes or [],
        )

    @classmethod
    def insufficient(
        cls,
        *,
        effective_date: date,
        rules_version: str,
        missing: list[RequiredVerification],
    ) -> "EligibilityResult":
        return cls(
            status=EligibilityStatus.INSUFFICIENT_INFORMATION,
            required_verifications=missing,
            effective_date=effective_date,
            rules_version=rules_version,
        )
