"""Merging interpreter diffs into the running session state.

Why this is a separate module: it's pure logic, has zero LLM
dependencies, and is the most likely place for subtle correctness bugs
(updates clobbering accumulated facts, contradictions silently being
overwritten, member_id collisions). Keeping it isolated keeps the
unit tests laser-focused.

Merge semantics:
  - Scalar fields (state, rent_or_mortgage, etc.): later non-None
    overwrites earlier. None means "no update from this turn".
  - Lists (members, income sources): merged by member_id. Adding a
    member with an existing id updates that member's fields; only the
    fields the LLM populated are touched.
  - Income sources: replaced for any member listed in
    `income_sources_added`'s member_ids OR mentioned in
    `income_sources_removed`. Avoids drift where a user updates their
    job and the new entry stacks on top of the old one.
"""
from __future__ import annotations

from typing import Iterable

from ..rules.interfaces import (
    AssetFacts,
    ExpenseFacts,
    HouseholdMember,
    IncomeFacts,
    IncomeSource,
)
from .schemas import (
    HouseholdMemberUpdate,
    IncomeSourceUpdate,
    InterpreterOutput,
    PartialHousehold,
)


def apply_interpreter_output(
    current: PartialHousehold, output: InterpreterOutput
) -> PartialHousehold:
    """Return a new PartialHousehold with the interpreter's diffs applied.

    Pure function — does not mutate `current`. The orchestrator persists
    the returned state and uses the prior one only for diff-versus-prior
    comparisons (e.g. to log what changed).
    """
    members = _merge_members(current.members, output.member_updates)
    income = _merge_income(
        current.income,
        added=output.income_sources_added,
        removed=output.income_sources_removed,
    )
    expenses = _merge_expenses(current.expenses, output)
    assets = _merge_assets(current.assets, output)

    return PartialHousehold(
        state=output.state if output.state is not None else current.state,
        members=members,
        income=income,
        expenses=expenses,
        assets=assets,
        receives_tanf=_coalesce(output.receives_tanf, current.receives_tanf),
        receives_ssi=_coalesce(output.receives_ssi, current.receives_ssi),
        receives_general_assistance=_coalesce(
            output.receives_general_assistance, current.receives_general_assistance
        ),
        is_homeless=_coalesce(output.is_homeless, current.is_homeless),
        is_seasonal_or_migrant_farmworker=_coalesce(
            output.is_seasonal_or_migrant_farmworker,
            current.is_seasonal_or_migrant_farmworker,
        ),
        asked_topics=list(current.asked_topics),
    )


def _coalesce(*values):
    for v in values:
        if v is not None:
            return v
    return None


def _merge_members(
    existing: list[HouseholdMember], updates: Iterable[HouseholdMemberUpdate]
) -> list[HouseholdMember]:
    by_id: dict[str, HouseholdMember] = {m.member_id: m for m in existing}
    for update in updates:
        if update.member_id in by_id:
            current = by_id[update.member_id]
            patched_data = current.model_dump()
            for field_name in (
                "age",
                "is_applicant",
                "is_elderly",
                "is_disabled",
                "is_pregnant",
                "citizenship",
                "student_status",
                "student_exemption",
                "is_abawd",
                "is_work_registered",
            ):
                value = getattr(update, field_name)
                if value is not None:
                    patched_data[field_name] = value
            by_id[update.member_id] = HouseholdMember(**patched_data)
        else:
            # New member — fill required fields with sensible defaults if the
            # LLM left them None. age and is_applicant must come through;
            # the schema already constrains age >= 0.
            if update.age is None:
                # Skip silently; the orchestrator will surface a
                # clarification request via InterpreterOutput.needs_clarification.
                continue
            by_id[update.member_id] = HouseholdMember(
                member_id=update.member_id,
                age=update.age,
                is_applicant=update.is_applicant if update.is_applicant is not None else False,
                is_elderly=update.is_elderly if update.is_elderly is not None else False,
                is_disabled=update.is_disabled if update.is_disabled is not None else False,
                is_pregnant=update.is_pregnant if update.is_pregnant is not None else False,
                citizenship=update.citizenship
                if update.citizenship is not None
                else HouseholdMember.model_fields["citizenship"].default,
                student_status=update.student_status
                if update.student_status is not None
                else HouseholdMember.model_fields["student_status"].default,
                student_exemption=update.student_exemption
                if update.student_exemption is not None
                else HouseholdMember.model_fields["student_exemption"].default,
                is_abawd=update.is_abawd if update.is_abawd is not None else False,
                is_work_registered=update.is_work_registered
                if update.is_work_registered is not None
                else True,
            )
    return list(by_id.values())


def _merge_income(
    existing: IncomeFacts,
    *,
    added: Iterable[IncomeSourceUpdate],
    removed: Iterable[str],
) -> IncomeFacts:
    removed_set = set(removed)
    affected_members = {update.member_id for update in added} | removed_set

    # Drop any existing source whose member_id is in the affected set.
    # This implements the "replace" semantic so users updating their job
    # don't end up with their old job stacked alongside the new one.
    kept = [s for s in existing.sources if s.member_id not in affected_members]
    new_sources = [
        IncomeSource(
            member_id=update.member_id,
            source_type=update.source_type,
            monthly_gross=update.monthly_gross,
            is_earned=update.is_earned,
        )
        for update in added
    ]
    return IncomeFacts(sources=kept + new_sources)


def _merge_expenses(existing: ExpenseFacts, output: InterpreterOutput) -> ExpenseFacts:
    return existing.model_copy(
        update={
            "rent_or_mortgage": output.rent_or_mortgage
            if output.rent_or_mortgage is not None
            else existing.rent_or_mortgage,
            "property_taxes": output.property_taxes
            if output.property_taxes is not None
            else existing.property_taxes,
            "homeowners_insurance": output.homeowners_insurance
            if output.homeowners_insurance is not None
            else existing.homeowners_insurance,
            "utilities_actual": output.utilities_actual
            if output.utilities_actual is not None
            else existing.utilities_actual,
            "sua_tier": output.sua_tier if output.sua_tier is not None else existing.sua_tier,
            "dependent_care": output.dependent_care
            if output.dependent_care is not None
            else existing.dependent_care,
            "medical_out_of_pocket_elderly_disabled": (
                output.medical_out_of_pocket_elderly_disabled
                if output.medical_out_of_pocket_elderly_disabled is not None
                else existing.medical_out_of_pocket_elderly_disabled
            ),
            "legally_obligated_child_support_paid": (
                output.legally_obligated_child_support_paid
                if output.legally_obligated_child_support_paid is not None
                else existing.legally_obligated_child_support_paid
            ),
        }
    )


def _merge_assets(existing: AssetFacts, output: InterpreterOutput) -> AssetFacts:
    if output.countable_resources is None:
        return existing
    return existing.model_copy(update={"countable_resources": output.countable_resources})
