"""Shared fixtures for the SNAP rules-engine test suite.

Design notes:
  - Every test pins an explicit effective_date inside the FY25 window
    (10/01/2024 — 09/30/2025) so tests stay deterministic regardless of
    when CI runs.
  - `make_household(...)` is the single household builder. Tests should
    NEVER instantiate Household directly — going through this builder
    keeps cases readable and makes future schema changes one-place fixes.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Iterable

import pytest

from backend.civic_api.snap.rules.federal import FederalSNAPRules
from backend.civic_api.snap.rules.interfaces import (
    AssetFacts,
    CitizenshipStatus,
    ExpenseFacts,
    Household,
    HouseholdMember,
    IncomeFacts,
    IncomeSource,
    StudentExemption,
    StudentStatus,
    SUATier,
)
from backend.civic_api.snap.rules.states.massachusetts import MassachusettsSNAPRules


FY25_REFERENCE_DATE = date(2025, 5, 10)


@pytest.fixture
def fy25() -> date:
    return FY25_REFERENCE_DATE


@pytest.fixture
def federal_rules(fy25: date) -> FederalSNAPRules:
    return FederalSNAPRules(effective_date=fy25)


@pytest.fixture
def ma_rules(fy25: date) -> MassachusettsSNAPRules:
    return MassachusettsSNAPRules(effective_date=fy25)


def _member(
    *,
    member_id: str = "applicant",
    age: int = 32,
    is_applicant: bool = True,
    is_elderly: bool = False,
    is_disabled: bool = False,
    citizenship: CitizenshipStatus = CitizenshipStatus.US_CITIZEN,
    student_status: StudentStatus = StudentStatus.NOT_STUDENT,
    student_exemption: StudentExemption = StudentExemption.NONE,
    is_abawd: bool = False,
) -> HouseholdMember:
    return HouseholdMember(
        member_id=member_id,
        age=age,
        is_applicant=is_applicant,
        is_elderly=is_elderly,
        is_disabled=is_disabled,
        citizenship=citizenship,
        student_status=student_status,
        student_exemption=student_exemption,
        is_abawd=is_abawd,
    )


@pytest.fixture
def make_member():
    return _member


def _household(
    *,
    state: str = "MA",
    members: Iterable[HouseholdMember] | None = None,
    wages: Decimal | int | str | float = 0,
    unearned: Decimal | int | str | float = 0,
    rent: Decimal | int | str | float = 0,
    utilities_actual: Decimal | int | str | float = 0,
    sua_tier: SUATier = SUATier.NONE,
    dependent_care: Decimal | int | str | float = 0,
    medical: Decimal | int | str | float = 0,
    child_support_paid: Decimal | int | str | float = 0,
    countable_resources: Decimal | int | str | float = 0,
    receives_tanf: bool = False,
    receives_ssi: bool = False,
    receives_ga: bool = False,
    is_homeless: bool = False,
    is_seasonal_farmworker: bool = False,
) -> Household:
    if members is None:
        members = [_member()]
    sources: list[IncomeSource] = []
    if Decimal(str(wages)) > 0:
        sources.append(
            IncomeSource(
                member_id="applicant",
                source_type="wages",
                monthly_gross=Decimal(str(wages)),
                is_earned=True,
            )
        )
    if Decimal(str(unearned)) > 0:
        sources.append(
            IncomeSource(
                member_id="applicant",
                source_type="other_unearned",
                monthly_gross=Decimal(str(unearned)),
                is_earned=False,
            )
        )
    return Household(
        state=state,
        members=list(members),
        income=IncomeFacts(sources=sources),
        expenses=ExpenseFacts(
            rent_or_mortgage=Decimal(str(rent)),
            utilities_actual=Decimal(str(utilities_actual)),
            sua_tier=sua_tier,
            dependent_care=Decimal(str(dependent_care)),
            medical_out_of_pocket_elderly_disabled=Decimal(str(medical)),
            legally_obligated_child_support_paid=Decimal(str(child_support_paid)),
        ),
        assets=AssetFacts(countable_resources=Decimal(str(countable_resources))),
        receives_tanf=receives_tanf,
        receives_ssi=receives_ssi,
        receives_general_assistance=receives_ga,
        is_homeless=is_homeless,
        is_seasonal_or_migrant_farmworker=is_seasonal_farmworker,
    )


@pytest.fixture
def make_household():
    return _household
