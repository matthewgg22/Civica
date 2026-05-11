"""Shared SNAP-suite fixtures available to all subdirectories.

Domain-specific fixtures (rules, pipeline, documents) stay in their
own conftest.py files — only put genuinely shared things here.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from backend.civic_api.snap.documents.schemas import (
    Paystub,
    PaystubDeduction,
    PaystubDeductionCategory,
)


def _paystub(**overrides) -> Paystub:
    """Default fixture: a balanced 2-week paystub from "Acme Retail".
    Adjusted by tests via keyword overrides.
    """
    defaults = dict(
        employer_name="Acme Retail",
        pay_period_start=date(2025, 4, 1),
        pay_period_end=date(2025, 4, 14),
        pay_date=date(2025, 4, 18),
        hours_worked_in_period=Decimal("80"),
        hourly_rate=Decimal("22.50"),
        is_salaried=False,
        gross_pay_period=Decimal("1800.00"),
        net_pay_period=Decimal("1380.00"),
        deductions=[
            PaystubDeduction(
                category=PaystubDeductionCategory.FEDERAL_INCOME_TAX,
                label_as_printed="FED TAX",
                amount=Decimal("180.00"),
            ),
            PaystubDeduction(
                category=PaystubDeductionCategory.SOCIAL_SECURITY,
                label_as_printed="FICA-OASDI",
                amount=Decimal("111.60"),
            ),
            PaystubDeduction(
                category=PaystubDeductionCategory.MEDICARE,
                label_as_printed="FICA-MEDI",
                amount=Decimal("26.10"),
            ),
            PaystubDeduction(
                category=PaystubDeductionCategory.STATE_INCOME_TAX,
                label_as_printed="MA TAX",
                amount=Decimal("90.00"),
            ),
            PaystubDeduction(
                category=PaystubDeductionCategory.HEALTH_INSURANCE,
                label_as_printed="MED PLAN",
                amount=Decimal("12.30"),
            ),
        ],
        gross_pay_ytd=Decimal("14400.00"),
        net_pay_ytd=Decimal("11040.00"),
        pay_frequency_label_as_printed="BI-WEEKLY",
    )
    defaults.update(overrides)
    return Paystub(**defaults)


@pytest.fixture
def make_paystub():
    return _paystub
