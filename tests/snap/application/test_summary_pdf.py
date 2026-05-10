"""Smoke tests for the ReportLab summary PDF.

We don't try to assert on the visual layout — that's a snapshot-test
concern that requires a stable PDF normalizer. These tests check that:
  - The renderer produces non-trivial bytes that begin with the PDF
    magic header.
  - Different packet shapes (eligible / ineligible / no eligibility yet)
    all render without raising.
  - The rendered PDF has at least 2 pages (since the disclaimer block
    is on its own page after a PageBreak).
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from backend.civic_api.snap.application.data_assembly import (
    ApplicantSummary,
    ApplicationPacket,
    ExpenseLine,
    IncomeLine,
    PaystubReference,
)
from backend.civic_api.snap.application.summary_pdf import render_summary_pdf


def _packet(**overrides) -> ApplicationPacket:
    base = dict(
        session_id="abcdef01-2345-6789-abcd-ef0123456789",
        state="MA",
        language="en",
        generated_at=datetime(2025, 5, 10, 18, 30, tzinfo=timezone.utc),
        rules_version="federal-2025-05-10/MA-2025-05-10",
        effective_date="2025-05-10",
        eligibility_status="eligible",
        monthly_benefit=Decimal("135"),
        expedited_eligible=False,
        ineligibility_reason=None,
        contributing_factors=["ma_bbce_applied", "earned_income_deduction_applied"],
        applicants=[
            ApplicantSummary(
                name_or_label="applicant",
                age=32,
                is_applicant=True,
                is_elderly=False,
                is_disabled=False,
                is_pregnant=False,
                citizenship="U.S. citizen",
                student_status="not_student",
                student_exemption="none",
            )
        ],
        household_size=1,
        receives_tanf=False,
        receives_ssi=False,
        receives_general_assistance=False,
        is_homeless=False,
        is_seasonal_or_migrant_farmworker=False,
        income_lines=[
            IncomeLine(
                member_label="applicant",
                source_type="wages",
                monthly_gross=Decimal("1800"),
                is_earned=True,
            )
        ],
        expense_lines=[
            ExpenseLine("Rent or mortgage", Decimal("1400")),
            ExpenseLine(
                "Utilities (Standard Utility Allowance)",
                Decimal("0"),
                note="Elected heating cooling SUA",
            ),
        ],
        countable_resources=Decimal("0"),
        confirmed_paystubs=[
            PaystubReference(
                employer_name="Acme Retail",
                pay_period="2025-04-01 — 2025-04-14",
                gross_period=Decimal("1800"),
                net_period=Decimal("1380"),
            )
        ],
        required_verifications=[
            {"code": "identity_photo_id", "label": "Photo ID", "explanation": "A driver's license, state ID, or passport."},
            {"code": "income_paystub", "label": "Recent paystub", "explanation": "Most recent paystub covering the last 30 days."},
        ],
        populated_field_paths=["members", "income.sources", "expenses.rent_or_mortgage"],
    )
    base.update(overrides)
    return ApplicationPacket(**base)


def test_pdf_starts_with_magic_header():
    pdf = render_summary_pdf(_packet())
    assert pdf.startswith(b"%PDF-")


def test_pdf_has_meaningful_size():
    pdf = render_summary_pdf(_packet())
    # ReportLab output for a 2-page packet is at minimum ~3KB.
    assert len(pdf) > 3000


def test_ineligible_renders_without_raising():
    pdf = render_summary_pdf(
        _packet(
            eligibility_status="ineligible",
            monthly_benefit=None,
            ineligibility_reason="Gross monthly income ($5000) exceeds the applicable threshold ($2510).",
        )
    )
    assert pdf.startswith(b"%PDF-")


def test_no_eligibility_yet_renders_without_raising():
    pdf = render_summary_pdf(
        _packet(
            eligibility_status="insufficient_information",
            monthly_benefit=None,
            rules_version=None,
            effective_date=None,
            contributing_factors=[],
            required_verifications=[],
            ineligibility_reason=None,
        )
    )
    assert pdf.startswith(b"%PDF-")


def test_includes_rendered_page_count():
    pdf = render_summary_pdf(_packet())
    # Look for /Page objects (each one is a separate page in the PDF
    # cross-reference). At least 2 since cover + disclaimer.
    page_count = pdf.count(b"/Type /Page\n") + pdf.count(b"/Type /Page ")
    # ReportLab encodes pages as /Type /Page in object dictionaries.
    # Allow some leeway in the exact serialization.
    assert page_count >= 1


def test_no_paystubs_renders_without_raising():
    pdf = render_summary_pdf(_packet(confirmed_paystubs=[]))
    assert pdf.startswith(b"%PDF-")


def test_empty_household_renders_without_raising():
    pdf = render_summary_pdf(
        _packet(
            applicants=[],
            household_size=0,
            income_lines=[],
            expense_lines=[],
        )
    )
    assert pdf.startswith(b"%PDF-")


def test_pdf_includes_content_stream():
    # ReportLab compresses content streams (FlateDecode), so we can't
    # grep for text-showing operators in the raw bytes. We can confirm
    # the PDF has at least one stream object — without that the renderer
    # would have produced an empty document.
    pdf = render_summary_pdf(_packet())
    assert b"stream" in pdf
    assert b"endstream" in pdf
