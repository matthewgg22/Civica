"""Scripted conversation traces for the eval harness.

A Trace is a list of TurnExpectation records. Each turn specifies:
  - user_utterance: what the user types/says
  - interpreter_output: what we expect the Interpreter LLM to extract
  - expected_next_topic: what the Ask-Selector should pick after the
    merge applies
  - script_writer_output: the canned question to inject for the
    *next* user turn (so the orchestrator can advance)
  - assertions: optional extra checks (terminal? eligible? specific
    benefit amount?)

Phase C deliverable: 10+ traces covering the canonical happy paths
and a few sharp-edge cases. Goal is to grow this set as eval data
arrives from real users.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional

from ..schemas import (
    ExpectedInputType,
    HouseholdMemberUpdate,
    IncomeSourceUpdate,
    InterpreterOutput,
    QuestionTopic,
    ScriptWriterOutput,
)
from ...rules.interfaces import (
    CitizenshipStatus,
    EligibilityStatus,
    StudentExemption,
    StudentStatus,
    SUATier,
)


@dataclass
class TurnExpectation:
    user_utterance: str
    interpreter_output: InterpreterOutput
    expected_next_topic: QuestionTopic
    script_writer_output: Optional[ScriptWriterOutput] = None
    assert_terminal: bool = False
    assert_eligibility_status: Optional[EligibilityStatus] = None
    assert_min_benefit: Optional[Decimal] = None
    assert_max_benefit: Optional[Decimal] = None
    assert_clarification: bool = False


@dataclass
class Trace:
    name: str
    description: str
    state: str
    language: str = "en"
    opening_question: ScriptWriterOutput = field(
        default_factory=lambda: ScriptWriterOutput(
            question_text="Hi — to start, who's in your household with you?",
            expected_input_type=ExpectedInputType.FREE_TEXT,
        )
    )
    turns: list[TurnExpectation] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Trace builders for common scaffolds
# ---------------------------------------------------------------------------


def _next_question(topic: QuestionTopic, text: str = "Test question?") -> ScriptWriterOutput:
    """Build a generic next-question payload. Specific text doesn't matter
    for orchestrator-level assertions."""
    return ScriptWriterOutput(
        question_text=text,
        expected_input_type=ExpectedInputType.FREE_TEXT,
    )


def _applicant_intro_turn(*, age: int = 32) -> TurnExpectation:
    """Reusable: user introduces themselves as a single US-citizen applicant."""
    return TurnExpectation(
        user_utterance=f"Just me, I'm {age}, US citizen, not a student.",
        interpreter_output=InterpreterOutput(
            confidence=0.97,
            member_updates=[
                HouseholdMemberUpdate(
                    member_id="applicant",
                    age=age,
                    is_applicant=True,
                    citizenship=CitizenshipStatus.US_CITIZEN,
                    student_status=StudentStatus.NOT_STUDENT,
                    student_exemption=StudentExemption.NONE,
                )
            ],
        ),
        expected_next_topic=QuestionTopic.CASH_PROGRAM_RECEIPT,
        script_writer_output=_next_question(
            QuestionTopic.CASH_PROGRAM_RECEIPT,
            "Do you receive TANF, SSI, or other cash assistance?",
        ),
    )


def _no_cash_programs_turn() -> TurnExpectation:
    return TurnExpectation(
        user_utterance="No, none of those.",
        interpreter_output=InterpreterOutput(
            confidence=0.98,
            receives_tanf=False,
            receives_ssi=False,
            receives_general_assistance=False,
        ),
        expected_next_topic=QuestionTopic.EARNED_INCOME,
        script_writer_output=_next_question(
            QuestionTopic.EARNED_INCOME,
            "What's your gross monthly income from work?",
        ),
    )


# ---------------------------------------------------------------------------
# Traces
# ---------------------------------------------------------------------------


CANONICAL_DEMO = Trace(
    name="canonical_ma_single_eligible",
    description=(
        "1-person MA household, $1,800 wages, $1,400 rent, heating SUA. "
        "The verification-plan demo case. Should land eligible at ~$135/month."
    ),
    state="MA",
    turns=[
        _applicant_intro_turn(),
        _no_cash_programs_turn(),
        TurnExpectation(
            user_utterance="$1,800 a month from my retail job.",
            interpreter_output=InterpreterOutput(
                confidence=0.96,
                income_sources_added=[
                    IncomeSourceUpdate(
                        member_id="applicant",
                        source_type="wages",
                        monthly_gross=Decimal("1800"),
                        is_earned=True,
                    )
                ],
            ),
            expected_next_topic=QuestionTopic.HOUSING_COST,
            script_writer_output=_next_question(QuestionTopic.HOUSING_COST),
        ),
        TurnExpectation(
            user_utterance="$1,400 rent.",
            interpreter_output=InterpreterOutput(
                confidence=0.97,
                rent_or_mortgage=Decimal("1400"),
            ),
            expected_next_topic=QuestionTopic.UTILITY_COSTS,
            script_writer_output=_next_question(QuestionTopic.UTILITY_COSTS),
        ),
        TurnExpectation(
            user_utterance="I pay for heat — gas heat in winter.",
            interpreter_output=InterpreterOutput(
                confidence=0.94,
                sua_tier=SUATier.HEATING_COOLING,
            ),
            expected_next_topic=QuestionTopic.HOMELESS_STATUS,
            script_writer_output=_next_question(QuestionTopic.HOMELESS_STATUS),
        ),
        TurnExpectation(
            user_utterance="No, I have a stable apartment.",
            interpreter_output=InterpreterOutput(
                confidence=0.99,
                is_homeless=False,
            ),
            expected_next_topic=QuestionTopic.DONE,
            assert_terminal=True,
            assert_eligibility_status=EligibilityStatus.ELIGIBLE,
            assert_min_benefit=Decimal("100"),
            assert_max_benefit=Decimal("200"),
        ),
    ],
)


HIGH_EARNER_INELIGIBLE = Trace(
    name="ma_high_earner_ineligible",
    description="Earner above MA's 200% BBCE threshold. Engine returns ineligible.",
    state="MA",
    turns=[
        _applicant_intro_turn(),
        _no_cash_programs_turn(),
        TurnExpectation(
            user_utterance="$5,500 a month.",
            interpreter_output=InterpreterOutput(
                confidence=0.97,
                income_sources_added=[
                    IncomeSourceUpdate(
                        member_id="applicant",
                        source_type="wages",
                        monthly_gross=Decimal("5500"),
                        is_earned=True,
                    )
                ],
            ),
            expected_next_topic=QuestionTopic.HOUSING_COST,
            script_writer_output=_next_question(QuestionTopic.HOUSING_COST),
        ),
        TurnExpectation(
            user_utterance="$0, I live with family.",
            interpreter_output=InterpreterOutput(
                confidence=0.95,
                rent_or_mortgage=Decimal("0"),
                utilities_actual=Decimal("0"),
                sua_tier=SUATier.PHONE_ONLY,
                is_homeless=False,
            ),
            expected_next_topic=QuestionTopic.DONE,
            assert_terminal=True,
            assert_eligibility_status=EligibilityStatus.INELIGIBLE,
        ),
    ],
)


CATEGORICAL_TANF = Trace(
    name="tanf_recipient_categorical",
    description="TANF recipient — categorical eligibility short-circuits income/asset tests.",
    state="MA",
    turns=[
        _applicant_intro_turn(),
        TurnExpectation(
            user_utterance="Yes, I get TANF.",
            interpreter_output=InterpreterOutput(
                confidence=0.99,
                receives_tanf=True,
                receives_ssi=False,
                receives_general_assistance=False,
            ),
            # Even with TANF, we still ask income/expenses to compute the
            # benefit amount. Categorical eligibility waives the *tests*,
            # not the calculation inputs.
            expected_next_topic=QuestionTopic.EARNED_INCOME,
            script_writer_output=_next_question(QuestionTopic.EARNED_INCOME),
        ),
        TurnExpectation(
            user_utterance="$0 — I'm not working right now.",
            interpreter_output=InterpreterOutput(
                confidence=0.97,
                income_sources_added=[
                    IncomeSourceUpdate(
                        member_id="applicant",
                        source_type="wages",
                        monthly_gross=Decimal("0"),
                        is_earned=True,
                    )
                ],
            ),
            expected_next_topic=QuestionTopic.HOUSING_COST,
            script_writer_output=_next_question(QuestionTopic.HOUSING_COST),
        ),
        TurnExpectation(
            user_utterance="$900 rent and I pay heat.",
            interpreter_output=InterpreterOutput(
                confidence=0.94,
                rent_or_mortgage=Decimal("900"),
                sua_tier=SUATier.HEATING_COOLING,
                is_homeless=False,
            ),
            expected_next_topic=QuestionTopic.DONE,
            assert_terminal=True,
            assert_eligibility_status=EligibilityStatus.ELIGIBLE,
        ),
    ],
)


CLARIFICATION_FLOW = Trace(
    name="clarification_on_ambiguous_income",
    description="User gives an ambiguous answer; pipeline asks for clarification before advancing.",
    state="MA",
    turns=[
        _applicant_intro_turn(),
        _no_cash_programs_turn(),
        TurnExpectation(
            user_utterance="I get paid sometimes.",
            interpreter_output=InterpreterOutput(
                confidence=0.3,
                needs_clarification=True,
                clarification_reason=(
                    "Could you tell me roughly how much you make in a typical month, "
                    "even if it changes a lot?"
                ),
            ),
            expected_next_topic=QuestionTopic.CLARIFICATION_NEEDED,
            script_writer_output=_next_question(QuestionTopic.CLARIFICATION_NEEDED),
            assert_clarification=True,
        ),
    ],
)


STUDENT_NO_EXEMPTION_INELIGIBLE = Trace(
    name="student_no_exemption_ineligible",
    description="Half-time+ student in 18-49 band with no exemption — ineligible by federal student rule.",
    state="MA",
    turns=[
        TurnExpectation(
            user_utterance="Just me, I'm 22, US citizen, full-time at the community college.",
            interpreter_output=InterpreterOutput(
                confidence=0.95,
                member_updates=[
                    HouseholdMemberUpdate(
                        member_id="applicant",
                        age=22,
                        is_applicant=True,
                        citizenship=CitizenshipStatus.US_CITIZEN,
                        student_status=StudentStatus.ENROLLED_HALF_TIME_OR_MORE,
                    )
                ],
            ),
            # Cash programs hasn't been asked yet, so still high-priority.
            expected_next_topic=QuestionTopic.CASH_PROGRAM_RECEIPT,
            script_writer_output=_next_question(QuestionTopic.CASH_PROGRAM_RECEIPT),
        ),
        TurnExpectation(
            user_utterance="No, none of those.",
            interpreter_output=InterpreterOutput(
                confidence=0.98,
                receives_tanf=False,
                receives_ssi=False,
                receives_general_assistance=False,
            ),
            # Now the student exemption question fires (enrolled, no exemption set).
            expected_next_topic=QuestionTopic.APPLICANT_STUDENT_EXEMPTION,
            script_writer_output=_next_question(QuestionTopic.APPLICANT_STUDENT_EXEMPTION),
        ),
        TurnExpectation(
            user_utterance="I don't work, just classes.",
            interpreter_output=InterpreterOutput(
                confidence=0.92,
                member_updates=[
                    HouseholdMemberUpdate(
                        member_id="applicant",
                        # Stays NONE — explicit "no exemption applies" answer
                        # would normally come via a CHOICE rendered by the iOS
                        # client. For Phase C we simulate that with no diff.
                    )
                ],
            ),
            # The student rule fires "ineligible" but only AFTER terminal,
            # which only fires when DONE. So we keep walking — next is
            # earned_income (medium priority).
            expected_next_topic=QuestionTopic.EARNED_INCOME,
            script_writer_output=_next_question(QuestionTopic.EARNED_INCOME),
        ),
    ],
)


STUDENT_WORK_STUDY_ELIGIBLE = Trace(
    name="student_work_study_eligible",
    description="Half-time+ student with work-study exemption — passes student rule.",
    state="MA",
    turns=[
        TurnExpectation(
            user_utterance="I'm 21, US citizen, half-time student in work-study.",
            interpreter_output=InterpreterOutput(
                confidence=0.94,
                member_updates=[
                    HouseholdMemberUpdate(
                        member_id="applicant",
                        age=21,
                        is_applicant=True,
                        citizenship=CitizenshipStatus.US_CITIZEN,
                        student_status=StudentStatus.ENROLLED_HALF_TIME_OR_MORE,
                        student_exemption=StudentExemption.WORK_STUDY_PROGRAM,
                    )
                ],
            ),
            expected_next_topic=QuestionTopic.CASH_PROGRAM_RECEIPT,
            script_writer_output=_next_question(QuestionTopic.CASH_PROGRAM_RECEIPT),
        ),
    ],
)


STUDENT_DTA_SELF_SUFFICIENCY = Trace(
    name="student_dta_self_sufficiency_ma",
    description="MA-specific student exemption — DTA-approved self-sufficiency program.",
    state="MA",
    turns=[
        TurnExpectation(
            user_utterance="I'm 23, citizen, in a DTA-approved trade program.",
            interpreter_output=InterpreterOutput(
                confidence=0.91,
                member_updates=[
                    HouseholdMemberUpdate(
                        member_id="applicant",
                        age=23,
                        is_applicant=True,
                        citizenship=CitizenshipStatus.US_CITIZEN,
                        student_status=StudentStatus.ENROLLED_HALF_TIME_OR_MORE,
                        student_exemption=StudentExemption.DTA_APPROVED_SELF_SUFFICIENCY,
                    )
                ],
            ),
            expected_next_topic=QuestionTopic.CASH_PROGRAM_RECEIPT,
            script_writer_output=_next_question(QuestionTopic.CASH_PROGRAM_RECEIPT),
        ),
    ],
)


SPANISH_LANGUAGE_PASSTHROUGH = Trace(
    name="spanish_language_passthrough",
    description=(
        "Confirms language=es flows through to LLM calls. The orchestrator-level "
        "test asserts the calls were tagged language=es; the prompt itself is the "
        "LLM's responsibility."
    ),
    state="MA",
    language="es",
    opening_question=ScriptWriterOutput(
        question_text="Hola — para empezar, ¿quién vive contigo?",
        expected_input_type=ExpectedInputType.FREE_TEXT,
    ),
    turns=[
        TurnExpectation(
            user_utterance="Solo yo, tengo 32 años, ciudadano.",
            interpreter_output=InterpreterOutput(
                confidence=0.94,
                member_updates=[
                    HouseholdMemberUpdate(
                        member_id="applicant",
                        age=32,
                        is_applicant=True,
                        citizenship=CitizenshipStatus.US_CITIZEN,
                        student_status=StudentStatus.NOT_STUDENT,
                    )
                ],
            ),
            expected_next_topic=QuestionTopic.CASH_PROGRAM_RECEIPT,
            script_writer_output=ScriptWriterOutput(
                question_text="¿Recibe TANF, SSI u otra asistencia en efectivo?",
                expected_input_type=ExpectedInputType.YES_NO,
            ),
        ),
    ],
)


HOMELESS_EXPEDITED = Trace(
    name="homeless_low_income_expedited",
    description="Homeless single adult with very low income/resources — expedited path 1.",
    state="MA",
    turns=[
        _applicant_intro_turn(),
        _no_cash_programs_turn(),
        TurnExpectation(
            user_utterance="$120 last month from day labor.",
            interpreter_output=InterpreterOutput(
                confidence=0.93,
                income_sources_added=[
                    IncomeSourceUpdate(
                        member_id="applicant",
                        source_type="wages",
                        monthly_gross=Decimal("120"),
                        is_earned=True,
                    )
                ],
                countable_resources=Decimal("50"),
            ),
            expected_next_topic=QuestionTopic.HOUSING_COST,
            script_writer_output=_next_question(QuestionTopic.HOUSING_COST),
        ),
        TurnExpectation(
            user_utterance="No housing right now.",
            interpreter_output=InterpreterOutput(
                confidence=0.95,
                rent_or_mortgage=Decimal("0"),
                utilities_actual=Decimal("0"),
                sua_tier=SUATier.PHONE_ONLY,
                is_homeless=True,
            ),
            expected_next_topic=QuestionTopic.DONE,
            assert_terminal=True,
            assert_eligibility_status=EligibilityStatus.ELIGIBLE,
        ),
    ],
)


ELDERLY_HIGH_SHELTER = Trace(
    name="elderly_high_shelter_no_cap",
    description="Elderly applicant — excess shelter deduction is uncapped.",
    state="MA",
    turns=[
        TurnExpectation(
            user_utterance="Just me, I'm 68, US citizen.",
            interpreter_output=InterpreterOutput(
                confidence=0.97,
                member_updates=[
                    HouseholdMemberUpdate(
                        member_id="applicant",
                        age=68,
                        is_applicant=True,
                        is_elderly=True,
                        citizenship=CitizenshipStatus.US_CITIZEN,
                        student_status=StudentStatus.NOT_STUDENT,
                    )
                ],
            ),
            expected_next_topic=QuestionTopic.CASH_PROGRAM_RECEIPT,
            script_writer_output=_next_question(QuestionTopic.CASH_PROGRAM_RECEIPT),
        ),
        _no_cash_programs_turn(),
        TurnExpectation(
            user_utterance="$1,500 from Social Security.",
            interpreter_output=InterpreterOutput(
                confidence=0.96,
                income_sources_added=[
                    IncomeSourceUpdate(
                        member_id="applicant",
                        source_type="social_security",
                        monthly_gross=Decimal("1500"),
                        is_earned=False,
                    )
                ],
            ),
            expected_next_topic=QuestionTopic.HOUSING_COST,
            script_writer_output=_next_question(QuestionTopic.HOUSING_COST),
        ),
        TurnExpectation(
            user_utterance="$1,800 rent in a senior building, I pay all utilities.",
            interpreter_output=InterpreterOutput(
                confidence=0.93,
                rent_or_mortgage=Decimal("1800"),
                sua_tier=SUATier.HEATING_COOLING,
                is_homeless=False,
            ),
            expected_next_topic=QuestionTopic.DONE,
            assert_terminal=True,
            assert_eligibility_status=EligibilityStatus.ELIGIBLE,
        ),
    ],
)


CONTRADICTION_FLAGGED = Trace(
    name="contradiction_flagged",
    description="User contradicts an earlier fact; interpreter flags it for clarification.",
    state="MA",
    turns=[
        _applicant_intro_turn(),
        _no_cash_programs_turn(),
        TurnExpectation(
            user_utterance="I make $1,800 a month.",
            interpreter_output=InterpreterOutput(
                confidence=0.96,
                income_sources_added=[
                    IncomeSourceUpdate(
                        member_id="applicant",
                        source_type="wages",
                        monthly_gross=Decimal("1800"),
                        is_earned=True,
                    )
                ],
            ),
            expected_next_topic=QuestionTopic.HOUSING_COST,
            script_writer_output=_next_question(QuestionTopic.HOUSING_COST),
        ),
        TurnExpectation(
            user_utterance="Wait, sorry — actually $2,400.",
            interpreter_output=InterpreterOutput(
                confidence=0.94,
                income_sources_added=[
                    IncomeSourceUpdate(
                        member_id="applicant",
                        source_type="wages",
                        monthly_gross=Decimal("2400"),
                        is_earned=True,
                    )
                ],
                contradicts_prior=["wages_changed_from_1800_to_2400"],
            ),
            # The contradiction is flagged on the InterpreterOutput; the
            # priority walker still advances since housing was already
            # asked. Phase D may add a "revisit housing" path for
            # surfaced contradictions.
            expected_next_topic=QuestionTopic.UTILITY_COSTS,
            script_writer_output=_next_question(QuestionTopic.UTILITY_COSTS),
        ),
    ],
)


INCOME_LOSS_RESETS = Trace(
    name="income_loss_resets_source",
    description="User reports losing their job — income source is removed via removed list.",
    state="MA",
    turns=[
        _applicant_intro_turn(),
        _no_cash_programs_turn(),
        TurnExpectation(
            user_utterance="I was making $1,800 but I lost my job last week.",
            interpreter_output=InterpreterOutput(
                confidence=0.92,
                income_sources_removed=["applicant"],
            ),
            expected_next_topic=QuestionTopic.HOUSING_COST,
            script_writer_output=_next_question(QuestionTopic.HOUSING_COST),
        ),
    ],
)


ALL_TRACES = [
    CANONICAL_DEMO,
    HIGH_EARNER_INELIGIBLE,
    CATEGORICAL_TANF,
    CLARIFICATION_FLOW,
    STUDENT_NO_EXEMPTION_INELIGIBLE,
    STUDENT_WORK_STUDY_ELIGIBLE,
    STUDENT_DTA_SELF_SUFFICIENCY,
    SPANISH_LANGUAGE_PASSTHROUGH,
    HOMELESS_EXPEDITED,
    ELDERLY_HIGH_SHELTER,
    CONTRADICTION_FLAGGED,
    INCOME_LOSS_RESETS,
]
