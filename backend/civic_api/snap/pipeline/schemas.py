"""Pydantic I/O schemas for the SNAP conversational pipeline.

These shapes are the contract between the three pipeline stages and the
orchestrator. Each LLM call returns an instance of the matching output
schema; structural failures raise and trigger retry/fallback inside
LLMClient.
"""
from __future__ import annotations

from decimal import Decimal
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ..rules.interfaces import (
    AssetFacts,
    CitizenshipStatus,
    EligibilityResult,
    ExpenseFacts,
    Household,
    HouseholdMember,
    IncomeFacts,
    StudentExemption,
    StudentStatus,
    SUATier,
)


# ===========================================================================
# Session state — what the orchestrator carries between turns
# ===========================================================================


class PartialHousehold(BaseModel):
    """Mirror of `Household` with all fields optional. Filled in
    progressively across conversation turns; promoted to `Household`
    once `is_finalizable()` returns True.

    Why this isn't just `Household.model_construct(...)` with partial
    fields: the rules engine's `Household` enforces invariants
    (non-empty members, valid state code) that don't hold mid-
    conversation. Keeping the in-progress shape separate means we never
    accidentally hand the rules engine an under-constructed household.
    """

    model_config = ConfigDict(extra="forbid")

    state: str | None = None
    members: list[HouseholdMember] = Field(default_factory=list)
    income: IncomeFacts = Field(default_factory=IncomeFacts)
    expenses: ExpenseFacts = Field(default_factory=ExpenseFacts)
    assets: AssetFacts = Field(default_factory=AssetFacts)
    receives_tanf: bool | None = None
    receives_ssi: bool | None = None
    receives_general_assistance: bool | None = None
    is_homeless: bool | None = None
    is_seasonal_or_migrant_farmworker: bool | None = None

    asked_topics: list[str] = Field(
        default_factory=list,
        description=(
            "QuestionTopic values the assistant has already asked. The "
            "Ask-Selector skips any topic in this list, so '$0 rent' or "
            "'no, not a student' are answers — not signals to re-ask. "
            "The orchestrator appends to this after every Script-Writer call."
        ),
    )

    def is_finalizable(self) -> bool:
        """Has the conversation collected enough to run the rules engine?"""
        if not self.state:
            return False
        if not self.members:
            return False
        applicants = [m for m in self.members if m.is_applicant]
        if not applicants:
            return False
        # Citizenship must be known (not UNKNOWN) for every applicant.
        if any(m.citizenship == CitizenshipStatus.UNKNOWN for m in applicants):
            return False
        return True

    def to_household(self) -> Household:
        """Promote to a strict Household. Caller must check is_finalizable()
        first; raises ValueError otherwise."""
        if not self.is_finalizable():
            raise ValueError(
                "PartialHousehold is not finalizable; missing state, members, "
                "applicant, or citizenship."
            )
        return Household(
            state=self.state,  # type: ignore[arg-type]
            members=self.members,
            income=self.income,
            expenses=self.expenses,
            assets=self.assets,
            receives_tanf=bool(self.receives_tanf),
            receives_ssi=bool(self.receives_ssi),
            receives_general_assistance=bool(self.receives_general_assistance),
            is_homeless=bool(self.is_homeless),
            is_seasonal_or_migrant_farmworker=bool(self.is_seasonal_or_migrant_farmworker),
        )


# ===========================================================================
# Stage 1: Interpreter
# ===========================================================================


class IncomeSourceUpdate(BaseModel):
    """Shape the LLM uses to add or update an income source."""

    model_config = ConfigDict(extra="forbid")

    member_id: str
    source_type: str
    monthly_gross: Decimal = Field(ge=0)
    is_earned: bool


class HouseholdMemberUpdate(BaseModel):
    """Shape the LLM uses to add or update a household member."""

    model_config = ConfigDict(extra="forbid")

    member_id: str
    age: int | None = Field(default=None, ge=0, le=130)
    is_applicant: bool | None = None
    is_elderly: bool | None = None
    is_disabled: bool | None = None
    is_pregnant: bool | None = None
    citizenship: CitizenshipStatus | None = None
    student_status: StudentStatus | None = None
    student_exemption: StudentExemption | None = None
    is_abawd: bool | None = None
    is_work_registered: bool | None = None


class InterpreterOutput(BaseModel):
    """Structured update extracted from one user utterance.

    The LLM populates whichever fields the user mentioned; everything
    else stays None. The orchestrator's state-merge layer applies these
    diffs onto the running PartialHousehold.
    """

    model_config = ConfigDict(extra="forbid")

    confidence: float = Field(ge=0.0, le=1.0)
    needs_clarification: bool = False
    clarification_reason: str | None = Field(
        default=None,
        description="If needs_clarification, what specifically is unclear about this turn.",
    )
    contradicts_prior: list[str] = Field(
        default_factory=list,
        description="Stable identifiers of prior facts this turn contradicts. Each becomes an audit log entry.",
    )

    # The actual field-level diffs.
    state: str | None = Field(
        default=None,
        description="USPS code if the user just told us their state. Two letters, uppercase.",
    )
    member_updates: list[HouseholdMemberUpdate] = Field(default_factory=list)
    income_sources_added: list[IncomeSourceUpdate] = Field(default_factory=list)
    income_sources_removed: list[str] = Field(
        default_factory=list,
        description="member_id values whose income sources should be cleared (e.g. user reported losing a job).",
    )

    # ExpenseFacts diffs — all optional.
    rent_or_mortgage: Decimal | None = Field(default=None, ge=0)
    property_taxes: Decimal | None = Field(default=None, ge=0)
    homeowners_insurance: Decimal | None = Field(default=None, ge=0)
    utilities_actual: Decimal | None = Field(default=None, ge=0)
    sua_tier: SUATier | None = None
    dependent_care: Decimal | None = Field(default=None, ge=0)
    medical_out_of_pocket_elderly_disabled: Decimal | None = Field(default=None, ge=0)
    legally_obligated_child_support_paid: Decimal | None = Field(default=None, ge=0)

    # AssetFacts diffs.
    countable_resources: Decimal | None = Field(default=None, ge=0)

    # Household-level booleans.
    receives_tanf: bool | None = None
    receives_ssi: bool | None = None
    receives_general_assistance: bool | None = None
    is_homeless: bool | None = None
    is_seasonal_or_migrant_farmworker: bool | None = None


# ===========================================================================
# Stage 2: Ask-Selector
# ===========================================================================


class QuestionTopic(str, Enum):
    """Stable identifier for what the next assistant question is collecting.

    Drives both the deterministic ask-selector priority walk AND the
    Script-Writer's prompt template. Add new topics here as the rules
    engine surfaces new required-information categories.
    """

    HOUSEHOLD_STATE = "household_state"
    HOUSEHOLD_COMPOSITION = "household_composition"
    APPLICANT_AGE = "applicant_age"
    APPLICANT_CITIZENSHIP = "applicant_citizenship"
    APPLICANT_STUDENT_STATUS = "applicant_student_status"
    APPLICANT_STUDENT_EXEMPTION = "applicant_student_exemption"
    APPLICANT_DISABILITY = "applicant_disability"
    EARNED_INCOME = "earned_income"
    UNEARNED_INCOME = "unearned_income"
    HOUSING_COST = "housing_cost"
    UTILITY_COSTS = "utility_costs"
    DEPENDENT_CARE = "dependent_care"
    MEDICAL_EXPENSES_ELDERLY_DISABLED = "medical_expenses_elderly_disabled"
    CHILD_SUPPORT_PAID = "child_support_paid"
    LIQUID_ASSETS = "liquid_assets"
    CASH_PROGRAM_RECEIPT = "cash_program_receipt"
    HOMELESS_STATUS = "homeless_status"

    DONE = "done"
    CLARIFICATION_NEEDED = "clarification_needed"


class AskSelectorOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    next_topic: QuestionTopic
    justification: str = Field(
        description="Plain-language reason this topic was picked. Logged for eval and debugging."
    )
    priority: str = Field(
        default="medium",
        description="One of 'high', 'medium', 'low'. High = blocks eligibility determination, medium = affects benefit amount, low = affects edge-case detection.",
    )
    is_clarification: bool = False
    clarification_text: str | None = None


# ===========================================================================
# Stage 3: Script-Writer
# ===========================================================================


class ExpectedInputType(str, Enum):
    FREE_TEXT = "free_text"
    NUMERIC_DOLLARS = "numeric_dollars"
    INTEGER = "integer"
    YES_NO = "yes_no"
    DATE = "date"
    CHOICE = "choice"


class ScriptWriterOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_text: str = Field(min_length=1, max_length=400)
    helper_text: str | None = Field(default=None, max_length=400)
    expected_input_type: ExpectedInputType
    choice_options: list[str] | None = Field(
        default=None,
        description="Required when expected_input_type is CHOICE; absent otherwise.",
    )


# ===========================================================================
# Orchestrator output — what one turn returns to the iOS client
# ===========================================================================


class TurnLLMTelemetry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stage: str
    model_used: str
    provider_used: str
    input_tokens: int
    output_tokens: int
    latency_ms: int
    cost_usd: Decimal


class TurnResult(BaseModel):
    """The orchestrator's response to one user turn."""

    model_config = ConfigDict(extra="forbid")

    session_id: str
    turn_index: int
    assistant_question: str
    helper_text: str | None = None
    expected_input_type: ExpectedInputType
    choice_options: list[str] | None = None
    next_topic: QuestionTopic
    eligibility_preview: EligibilityResult | None = Field(
        default=None,
        description="Populated when next_topic == DONE and the rules engine has produced a determination.",
    )
    is_terminal: bool
    needs_clarification: bool = False
    clarification_text: str | None = None
    needs_user_confirmation: bool = False
    cost_telemetry: list[TurnLLMTelemetry] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)


# ===========================================================================
# Helpers used by tests and the eval harness
# ===========================================================================


def serialize_partial_household_for_prompt(state: PartialHousehold) -> dict[str, Any]:
    """JSON-safe representation of the running session state, used as
    context for the Interpreter and (eventually) Ask-Selector LLM calls."""
    return state.model_dump(mode="json", exclude_none=False)
