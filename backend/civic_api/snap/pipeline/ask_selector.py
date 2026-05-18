"""Ask-Selector — pick the next-most-informative question topic.

Phase C implementation: deterministic priority walker over the running
PartialHousehold. The walker checks a fixed list of "is this fact
collected yet?" predicates in priority order and returns the first
unanswered one.

Why deterministic for MVP:
  - The eval harness needs reproducible decisions to assert against.
  - LLM-driven prioritization is genuinely valuable (the plan calls
    this out as the cleverest stage), but its value materializes when
    you have eval data showing the deterministic order is suboptimal
    for real users. Without that data, an LLM here adds latency and
    cost without measurable benefit.

When to swap in an LLM-driven Ask-Selector: after the eval harness has
collected real conversation traces and we can identify cases where
the deterministic order asked a low-information-value question. Then
the LLM is wrapped behind the same `pick_next_topic` signature so the
swap is one import.

Priority order rationale:
  1. State (rules class can't run without it)
  2. Applicant existence + age (needed for every other test)
  3. Citizenship (gates everything)
  4. Cash-program receipt (categorical eligibility short-circuit)
  5. Student status (gates eligibility for 18–49)
  6. Income (gross income test)
  7. Household composition (changes thresholds)
  8. Housing + utilities (shelter deduction)
  9. Dependents/medical (additional deductions)
 10. Assets (asset test, may be moot under BBCE)
 11. Other edge cases (homeless, farmworker, child support paid)
"""
from __future__ import annotations

from dataclasses import dataclass

from ..rules.interfaces import (
    CitizenshipStatus,
    StudentExemption,
    StudentStatus,
    SUATier,
)
from .schemas import AskSelectorOutput, PartialHousehold, QuestionTopic


@dataclass(frozen=True)
class _Rule:
    topic: QuestionTopic
    priority: str
    justification: str
    predicate: callable  # type: ignore[type-arg]


def _rules() -> list[_Rule]:
    """Construct the priority-ordered rule list. Each predicate returns
    True when the topic still needs to be asked."""
    return [
        _Rule(
            topic=QuestionTopic.HOUSEHOLD_STATE,
            priority="high",
            justification="State is required to select rules (federal vs MA-specific).",
            predicate=lambda h: not h.state,
        ),
        _Rule(
            topic=QuestionTopic.HOUSEHOLD_COMPOSITION,
            priority="high",
            justification="No household members recorded yet; cannot determine size.",
            predicate=lambda h: not h.members,
        ),
        _Rule(
            topic=QuestionTopic.APPLICANT_AGE,
            priority="high",
            justification="Applicant age is required for student rule and ABAWD checks.",
            predicate=lambda h: any(
                m.is_applicant and m.age is None for m in h.members
            ),
        ),
        _Rule(
            topic=QuestionTopic.APPLICANT_CITIZENSHIP,
            priority="high",
            justification="Citizenship is the first eligibility gate.",
            predicate=lambda h: any(
                m.is_applicant and m.citizenship == CitizenshipStatus.UNKNOWN
                for m in h.members
            ),
        ),
        _Rule(
            topic=QuestionTopic.CASH_PROGRAM_RECEIPT,
            priority="high",
            justification="TANF/SSI/GA receipt triggers categorical eligibility short-circuit.",
            predicate=lambda h: (
                h.receives_tanf is None
                and h.receives_ssi is None
                and h.receives_general_assistance is None
            ),
        ),
        _Rule(
            topic=QuestionTopic.APPLICANT_STUDENT_STATUS,
            priority="high",
            justification="Student rule applies to applicants 18-49; status not yet collected.",
            predicate=lambda h: any(
                m.is_applicant
                and 18 <= m.age <= 49
                and m.student_status == StudentStatus.UNKNOWN
                for m in h.members
            ),
        ),
        _Rule(
            topic=QuestionTopic.APPLICANT_STUDENT_EXEMPTION,
            priority="high",
            justification="Applicant is enrolled at least half time; exemption status determines eligibility.",
            predicate=lambda h: any(
                m.is_applicant
                and m.student_status == StudentStatus.ENROLLED_HALF_TIME_OR_MORE
                and m.student_exemption == StudentExemption.NONE
                for m in h.members
            ),
        ),
        _Rule(
            topic=QuestionTopic.EARNED_INCOME,
            priority="medium",
            justification="No earned income recorded; needed for gross-income test and 20% deduction.",
            predicate=_no_income_collected,
        ),
        _Rule(
            topic=QuestionTopic.HOUSING_COST,
            priority="medium",
            justification="Housing cost feeds the excess shelter deduction.",
            predicate=lambda h: h.expenses.rent_or_mortgage == 0
            and h.expenses.property_taxes == 0,
        ),
        _Rule(
            topic=QuestionTopic.UTILITY_COSTS,
            priority="medium",
            justification="Utilities (or SUA election) feed the excess shelter deduction.",
            predicate=lambda h: h.expenses.utilities_actual == 0
            and h.expenses.sua_tier == SUATier.NONE,
        ),
        _Rule(
            topic=QuestionTopic.APPLICANT_DISABILITY,
            priority="low",
            justification="Disability status changes elderly/disabled deduction caps.",
            predicate=lambda h: any(
                m.is_applicant and m.age >= 60 and not m.is_elderly for m in h.members
            ),
        ),
        _Rule(
            topic=QuestionTopic.LIQUID_ASSETS,
            priority="low",
            justification="Asset value is required outside BBCE states and for expedited determination.",
            predicate=lambda h: h.assets.countable_resources == 0
            and h.state not in {"MA"},  # MA waives assets under BBCE
        ),
        _Rule(
            topic=QuestionTopic.HOMELESS_STATUS,
            priority="low",
            justification="Homeless status affects expedited service path 2.",
            predicate=lambda h: h.is_homeless is None,
        ),
    ]


def _no_income_collected(h: PartialHousehold) -> bool:
    """We've never asked about income if income.sources is empty AND no
    explicit zero-income marker has been set. (Phase D: add an explicit
    `income_zero_confirmed` flag so we can tell "user said no income"
    apart from "we haven't asked yet". For Phase C, treat 'sources empty'
    as 'unasked' — costs at most one redundant question.)"""
    return len(h.income.sources) == 0


def pick_next_topic(state: PartialHousehold) -> AskSelectorOutput:
    """Return the next QuestionTopic to ask, based on what's missing.

    Topics already in `state.asked_topics` are skipped — once a topic
    has been asked, even an answer of "$0" or "no" counts as asked.
    Re-asking would create infinite loops where the user's "no rent"
    answer keeps triggering the housing topic.

    If every topic has been asked or otherwise satisfied, returns DONE.
    """
    asked = set(state.asked_topics)
    for rule in _rules():
        if rule.topic.value in asked:
            continue
        try:
            if rule.predicate(state):
                return AskSelectorOutput(
                    next_topic=rule.topic,
                    justification=rule.justification,
                    priority=rule.priority,
                )
        except (AttributeError, TypeError):
            # Defensive: if the partial state is malformed in a way the
            # predicate doesn't expect, treat the topic as needing
            # clarification rather than crashing the orchestrator.
            return AskSelectorOutput(
                next_topic=QuestionTopic.CLARIFICATION_NEEDED,
                justification=f"Predicate for {rule.topic.value} raised on current state.",
                priority="high",
                is_clarification=True,
                clarification_text="The session state is in an unexpected shape; please confirm the latest answer.",
            )
    return AskSelectorOutput(
        next_topic=QuestionTopic.DONE,
        justification="All required facts collected; rules engine can run.",
        priority="low",
    )
