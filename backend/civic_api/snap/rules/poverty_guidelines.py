"""Effective-dated HHS Poverty Guidelines and SNAP federal allotments / standards.

Why effective dating matters: SNAP eligibility is determined "as of" the
application month. Replaying a 2024 determination must use 2024 tables;
replaying a 2026 determination must use 2026 tables. Every test in the
rules engine threads `effective_date` through, and looks up the table
in effect on that date.

Sources of truth:
  - HHS Poverty Guidelines: https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines
  - FNS SNAP Cost-of-Living Adjustments memo (annual, August):
    https://www.fns.usda.gov/snap/allotment/COLA

Data integrity rule: never edit a published table after its effective
date has passed. If FNS publishes a correction, add a new effective
date entry — never mutate the prior row.

NOTE FOR DEPLOYMENT: The FY26 (10/01/2025) tables must be loaded from
the official FNS COLA memo before any production determinations are run.
The FY24 entries below are the verified-correct seed used for testing
and to lock the schema. There is a CI test (in tests/snap/rules/
test_effective_dating.py — to be added) that fails if a production
determination uses an effective_date with no matching table loaded.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass(frozen=True)
class PovertyGuidelineTable:
    """Annual HHS Poverty Guidelines for the 48 contiguous states + DC.

    Alaska and Hawaii have separate tables; not yet loaded since MVP is MA only.
    """

    fiscal_year: int
    effective_start: date  # First date this table applies for SNAP determinations.
    effective_end: date  # Inclusive last date.
    annual_first_person: Decimal
    annual_each_additional_person: Decimal

    def annual_for_household_size(self, size: int) -> Decimal:
        if size < 1:
            raise ValueError("Household size must be >= 1")
        return self.annual_first_person + self.annual_each_additional_person * (size - 1)

    def monthly_for_household_size(self, size: int) -> Decimal:
        # SNAP rounds the monthly figure to the nearest dollar at the table
        # level for income-test thresholds; we keep the unrounded Decimal
        # here and let test_thresholds.py do the rounding per-test.
        return self.annual_for_household_size(size) / Decimal(12)


@dataclass(frozen=True)
class MaxAllotmentTable:
    """FNS annual maximum SNAP allotments for the 48 contiguous states + DC.

    Published in the FNS COLA memo each August, effective Oct 1.
    """

    fiscal_year: int
    effective_start: date
    effective_end: date
    by_household_size: dict[int, Decimal]
    each_additional_person: Decimal

    def for_household_size(self, size: int) -> Decimal:
        if size < 1:
            raise ValueError("Household size must be >= 1")
        if size in self.by_household_size:
            return self.by_household_size[size]
        largest = max(self.by_household_size.keys())
        if size > largest:
            base = self.by_household_size[largest]
            return base + self.each_additional_person * (size - largest)
        raise KeyError(f"No max allotment defined for household size {size}")


# ---------------------------------------------------------------------------
# Verified historical tables (do not modify after their effective_end passes)
# ---------------------------------------------------------------------------

# HHS 2024 Poverty Guidelines, 48 contiguous states + DC
# Federal Register, January 2024.
# Used by SNAP for FY25 (10/01/2024 – 09/30/2025).
FY25_POVERTY_48 = PovertyGuidelineTable(
    fiscal_year=2025,
    effective_start=date(2024, 10, 1),
    effective_end=date(2025, 9, 30),
    annual_first_person=Decimal("15060"),
    annual_each_additional_person=Decimal("5380"),
)

# FNS SNAP COLA memo, FY25 (effective 10/01/2024)
FY25_MAX_ALLOTMENT_48 = MaxAllotmentTable(
    fiscal_year=2025,
    effective_start=date(2024, 10, 1),
    effective_end=date(2025, 9, 30),
    by_household_size={
        1: Decimal("292"),
        2: Decimal("536"),
        3: Decimal("768"),
        4: Decimal("975"),
        5: Decimal("1158"),
        6: Decimal("1390"),
        7: Decimal("1536"),
        8: Decimal("1756"),
    },
    each_additional_person=Decimal("220"),
)


# Standard deductions (FY25, 48 contiguous states + DC)
# 7 CFR 273.9(d)(1). Vary by household size.
FY25_STANDARD_DEDUCTION_48 = {
    1: Decimal("204"),
    2: Decimal("204"),
    3: Decimal("204"),
    4: Decimal("217"),
    5: Decimal("254"),
    6: Decimal("291"),  # applies to 6+
}


def standard_deduction_for_size_fy25(size: int) -> Decimal:
    if size <= 3:
        return FY25_STANDARD_DEDUCTION_48[1]
    if size == 4:
        return FY25_STANDARD_DEDUCTION_48[4]
    if size == 5:
        return FY25_STANDARD_DEDUCTION_48[5]
    return FY25_STANDARD_DEDUCTION_48[6]


# Maximum excess shelter deduction (FY25, 48 contiguous + DC).
# Households containing an elderly or disabled member have NO cap.
FY25_MAX_EXCESS_SHELTER_DEDUCTION_48 = Decimal("712")


# Federal minimum monthly benefit for 1- and 2-person eligible households
# (FY25, 48 contiguous + DC). Equal to 8% of the 1-person max allotment,
# rounded. Households of 3+ can receive $0 and still be approved.
FY25_MINIMUM_BENEFIT_48 = Decimal("23")


# Earned income deduction percentage (statutory, does not vary by year).
EARNED_INCOME_DEDUCTION_RATE = Decimal("0.20")


# Income test thresholds as a fraction of FPL.
GROSS_INCOME_TEST_RATIO = Decimal("1.30")  # 130% FPL
NET_INCOME_TEST_RATIO = Decimal("1.00")  # 100% FPL


# Asset limits (FY25, federal). States with BBCE may waive these.
FY25_ASSET_LIMIT_HOUSEHOLD = Decimal("3000")
FY25_ASSET_LIMIT_ELDERLY_DISABLED = Decimal("4500")


# ---------------------------------------------------------------------------
# Lookup
# ---------------------------------------------------------------------------

# State Standard Utility Allowance tables. Each state publishes its own
# values; SNAP regulations require state SUAs to be approved by FNS.
# Outer key is USPS state code. Inner key is the SUATier value.
# Massachusetts FY25 SUAs (effective 10/01/2024) per MA DTA chart:
_SUA_TABLES_FY25: dict[str, dict[str, Decimal]] = {
    "MA": {
        "heating_cooling": Decimal("799"),
        "non_heating": Decimal("507"),
        "phone_only": Decimal("63"),
    },
}


@dataclass(frozen=True)
class SUATable:
    fiscal_year: int
    effective_start: date
    effective_end: date
    by_state_and_tier: dict[str, dict[str, Decimal]]

    def lookup(self, state: str, tier: str) -> Decimal:
        if tier == "none":
            return Decimal("0")
        state_table = self.by_state_and_tier.get(state.upper())
        if state_table is None:
            raise NoTableForStateError(
                f"No SUA table loaded for state={state!r}. "
                f"Add the state's FNS-approved values before running determinations there."
            )
        if tier not in state_table:
            raise KeyError(
                f"SUA tier {tier!r} not defined in {state!r} table for FY{self.fiscal_year}."
            )
        return state_table[tier]


FY25_SUA_TABLE = SUATable(
    fiscal_year=2025,
    effective_start=date(2024, 10, 1),
    effective_end=date(2025, 9, 30),
    by_state_and_tier=_SUA_TABLES_FY25,
)


# FY2026 (effective 2025-10-01 → 2026-09-30). Retrieved + corroborated by research
# agents 2026-06-01. ✓ = FNS/HHS/CRS primary-confirmed; ◦ = ≥2 agreeing secondary
# sources (FNS primary table PDF not machine-readable — reconfirm ◦ cells against
# fns.usda.gov/snap/allotment/cola/fy26 before production determinations).
FY26_POVERTY_48 = PovertyGuidelineTable(
    fiscal_year=2026,
    effective_start=date(2025, 10, 1),
    effective_end=date(2026, 9, 30),
    annual_first_person=Decimal("15650"),           # ✓ HHS 2025 guidelines (90 FR 5917)
    annual_each_additional_person=Decimal("5500"),  # ✓ HHS 2025
)

FY26_MAX_ALLOTMENT_48 = MaxAllotmentTable(
    fiscal_year=2026,
    effective_start=date(2025, 10, 1),
    effective_end=date(2026, 9, 30),
    by_household_size={
        1: Decimal("298"), 2: Decimal("546"), 3: Decimal("785"),   # HH4 ✓ FNS; others ◦
        4: Decimal("994"), 5: Decimal("1183"), 6: Decimal("1421"),
        7: Decimal("1571"), 8: Decimal("1789"),
    },
    each_additional_person=Decimal("218"),  # ◦
)

# State SUAs, FY2026. CA = CDSS ACIN I-46-25 (◦ via LSNC); MA = mass.gov DTA (✓).
_SUA_TABLES_FY26: dict[str, dict[str, Decimal]] = {
    "CA": {"heating_cooling": Decimal("663"), "non_heating": Decimal("170"), "phone_only": Decimal("20")},
    "MA": {"heating_cooling": Decimal("890"), "non_heating": Decimal("542"), "phone_only": Decimal("62")},
}
FY26_SUA_TABLE = SUATable(
    fiscal_year=2026,
    effective_start=date(2025, 10, 1),
    effective_end=date(2026, 9, 30),
    by_state_and_tier=_SUA_TABLES_FY26,
)


_POVERTY_TABLES: list[PovertyGuidelineTable] = [FY25_POVERTY_48, FY26_POVERTY_48]
_MAX_ALLOTMENT_TABLES: list[MaxAllotmentTable] = [FY25_MAX_ALLOTMENT_48, FY26_MAX_ALLOTMENT_48]
_SUA_TABLES: list[SUATable] = [FY25_SUA_TABLE, FY26_SUA_TABLE]


class NoTableForStateError(LookupError):
    """Raised when a state's rules engine asks for a SUA value that
    hasn't been loaded for the requested state."""


class NoTableForDateError(LookupError):
    """Raised when the rules engine is invoked with an effective_date for
    which no FPL or max-allotment table has been loaded.

    Surfaces deployment-time gaps instead of silently using stale numbers.
    """


def poverty_guideline_for(effective_date: date) -> PovertyGuidelineTable:
    for table in _POVERTY_TABLES:
        if table.effective_start <= effective_date <= table.effective_end:
            return table
    raise NoTableForDateError(
        f"No HHS Poverty Guideline table loaded for {effective_date}. "
        f"Load the FNS-published values for that fiscal year before running determinations."
    )


def max_allotment_for(effective_date: date) -> MaxAllotmentTable:
    for table in _MAX_ALLOTMENT_TABLES:
        if table.effective_start <= effective_date <= table.effective_end:
            return table
    raise NoTableForDateError(
        f"No SNAP maximum allotment table loaded for {effective_date}."
    )


def sua_table_for(effective_date: date) -> SUATable:
    for table in _SUA_TABLES:
        if table.effective_start <= effective_date <= table.effective_end:
            return table
    raise NoTableForDateError(
        f"No SUA table loaded for {effective_date}."
    )


def minimum_benefit_for(effective_date: date) -> Decimal:
    """Federal minimum monthly benefit for 1- and 2-person eligible households."""
    if FY25_POVERTY_48.effective_start <= effective_date <= FY25_POVERTY_48.effective_end:
        return FY25_MINIMUM_BENEFIT_48
    raise NoTableForDateError(
        f"No federal minimum benefit loaded for {effective_date}."
    )
