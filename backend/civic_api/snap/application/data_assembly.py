"""Flatten session state + eligibility result + confirmed paystubs
into a single ApplicationPacket suitable for PDF rendering.

Why this is a separate module: the rendering logic shouldn't have to
reach into PartialHousehold, IncomeFacts, ExpenseFacts, etc. directly.
Centralizing the projection here means a future change to the rules
schemas only ripples through one file.

Currency formatting: amounts are kept as Decimal at this layer; the
PDF renderer handles formatting. Doing the formatting here would make
the projection harder to assert against in tests.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from ..documents.schemas import Paystub
from ..pipeline.schemas import PartialHousehold
from ..rules.interfaces import (
    CitizenshipStatus,
    EligibilityResult,
    SUATier,
)


@dataclass
class ApplicantSummary:
    name_or_label: str
    age: int
    is_applicant: bool
    is_elderly: bool
    is_disabled: bool
    is_pregnant: bool
    citizenship: str
    student_status: str
    student_exemption: str


@dataclass
class IncomeLine:
    member_label: str
    source_type: str
    monthly_gross: Decimal
    is_earned: bool


@dataclass
class ExpenseLine:
    label: str
    monthly_amount: Decimal
    note: str = ""


@dataclass
class PaystubReference:
    employer_name: str
    pay_period: str
    gross_period: Decimal
    net_period: Decimal


@dataclass
class ApplicationPacket:
    """Everything the application PDF needs, normalized.

    `generated_at` is set by the assembler so two PDFs generated for
    the same session at different times can be distinguished in the
    audit log."""

    session_id: str
    state: str
    language: str
    generated_at: datetime
    rules_version: str | None
    effective_date: str | None
    eligibility_status: str
    monthly_benefit: Decimal | None
    expedited_eligible: bool
    ineligibility_reason: str | None
    contributing_factors: list[str]

    applicants: list[ApplicantSummary]
    household_size: int
    receives_tanf: bool
    receives_ssi: bool
    receives_general_assistance: bool
    is_homeless: bool
    is_seasonal_or_migrant_farmworker: bool

    income_lines: list[IncomeLine]
    expense_lines: list[ExpenseLine]
    countable_resources: Decimal

    confirmed_paystubs: list[PaystubReference] = field(default_factory=list)
    required_verifications: list[dict[str, Any]] = field(default_factory=list)

    # The set of field paths that were actually populated, used by the
    # audit log so we can prove what was on the printed packet.
    populated_field_paths: list[str] = field(default_factory=list)


def assemble_application_packet(
    *,
    session_id: str,
    state: str,
    language: str,
    partial: PartialHousehold,
    eligibility: EligibilityResult | None,
    confirmed_paystubs: list[Paystub] | None = None,
) -> ApplicationPacket:
    confirmed_paystubs = confirmed_paystubs or []

    populated: list[str] = []

    applicants = [
        ApplicantSummary(
            name_or_label=member.member_id,
            age=member.age,
            is_applicant=member.is_applicant,
            is_elderly=member.is_elderly,
            is_disabled=member.is_disabled,
            is_pregnant=member.is_pregnant,
            citizenship=_citizenship_label(member.citizenship),
            student_status=member.student_status.value,
            student_exemption=member.student_exemption.value,
        )
        for member in partial.members
    ]
    if applicants:
        populated.append("members")

    income_lines = [
        IncomeLine(
            member_label=src.member_id,
            source_type=src.source_type,
            monthly_gross=src.monthly_gross,
            is_earned=src.is_earned,
        )
        for src in partial.income.sources
    ]
    if income_lines:
        populated.append("income.sources")

    expense_lines: list[ExpenseLine] = []
    if partial.expenses.rent_or_mortgage > 0:
        expense_lines.append(ExpenseLine("Rent or mortgage", partial.expenses.rent_or_mortgage))
        populated.append("expenses.rent_or_mortgage")
    if partial.expenses.property_taxes > 0:
        expense_lines.append(ExpenseLine("Property taxes", partial.expenses.property_taxes))
        populated.append("expenses.property_taxes")
    if partial.expenses.homeowners_insurance > 0:
        expense_lines.append(
            ExpenseLine("Homeowners insurance", partial.expenses.homeowners_insurance)
        )
        populated.append("expenses.homeowners_insurance")

    sua_tier = partial.expenses.sua_tier
    if sua_tier == SUATier.NONE and partial.expenses.utilities_actual > 0:
        expense_lines.append(
            ExpenseLine("Utilities (actual)", partial.expenses.utilities_actual)
        )
        populated.append("expenses.utilities_actual")
    elif sua_tier != SUATier.NONE:
        expense_lines.append(
            ExpenseLine(
                "Utilities (Standard Utility Allowance)",
                Decimal("0"),
                note=f"Elected {sua_tier.value.replace('_', ' ')} SUA",
            )
        )
        populated.append("expenses.sua_tier")

    if partial.expenses.dependent_care > 0:
        expense_lines.append(ExpenseLine("Dependent care", partial.expenses.dependent_care))
        populated.append("expenses.dependent_care")
    if partial.expenses.medical_out_of_pocket_elderly_disabled > 0:
        expense_lines.append(
            ExpenseLine(
                "Medical (elderly/disabled)",
                partial.expenses.medical_out_of_pocket_elderly_disabled,
            )
        )
        populated.append("expenses.medical_out_of_pocket_elderly_disabled")
    if partial.expenses.legally_obligated_child_support_paid > 0:
        expense_lines.append(
            ExpenseLine(
                "Child support paid (legally obligated)",
                partial.expenses.legally_obligated_child_support_paid,
            )
        )
        populated.append("expenses.legally_obligated_child_support_paid")

    paystub_refs = [
        PaystubReference(
            employer_name=p.employer_name,
            pay_period=f"{p.pay_period_start.isoformat()} — {p.pay_period_end.isoformat()}",
            gross_period=p.gross_pay_period,
            net_period=p.net_pay_period,
        )
        for p in confirmed_paystubs
    ]
    if paystub_refs:
        populated.append("confirmed_paystubs")

    required_verifications: list[dict[str, Any]] = []
    if eligibility is not None:
        required_verifications = [
            {
                "code": v.code,
                "label": v.label_en,
                "explanation": v.explanation_en,
            }
            for v in eligibility.required_verifications
        ]

    if partial.assets.countable_resources > 0:
        populated.append("assets.countable_resources")

    return ApplicationPacket(
        session_id=session_id,
        state=state,
        language=language,
        generated_at=datetime.now(timezone.utc),
        rules_version=eligibility.rules_version if eligibility else None,
        effective_date=eligibility.effective_date.isoformat() if eligibility else None,
        eligibility_status=eligibility.status.value if eligibility else "insufficient_information",
        monthly_benefit=eligibility.monthly_benefit if eligibility else None,
        expedited_eligible=eligibility.expedited_eligible if eligibility else False,
        ineligibility_reason=eligibility.ineligibility_reason if eligibility else None,
        contributing_factors=list(eligibility.contributing_factors) if eligibility else [],
        applicants=applicants,
        household_size=len(partial.members),
        receives_tanf=bool(partial.receives_tanf),
        receives_ssi=bool(partial.receives_ssi),
        receives_general_assistance=bool(partial.receives_general_assistance),
        is_homeless=bool(partial.is_homeless),
        is_seasonal_or_migrant_farmworker=bool(partial.is_seasonal_or_migrant_farmworker),
        income_lines=income_lines,
        expense_lines=expense_lines,
        countable_resources=partial.assets.countable_resources,
        confirmed_paystubs=paystub_refs,
        required_verifications=required_verifications,
        populated_field_paths=populated,
    )


def _citizenship_label(value: CitizenshipStatus) -> str:
    return {
        CitizenshipStatus.US_CITIZEN: "U.S. citizen",
        CitizenshipStatus.QUALIFIED_NONCITIZEN: "Qualified noncitizen",
        CitizenshipStatus.INELIGIBLE_NONCITIZEN: "Not eligible based on citizenship",
        CitizenshipStatus.UNKNOWN: "Not yet provided",
    }[value]
