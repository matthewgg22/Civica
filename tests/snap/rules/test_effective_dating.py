"""Effective-dating discipline tests.

Every rules-engine determination must be replayable. That requires:
  1. The poverty/allotment/SUA tables for the determination's effective_date
     are loaded — running with an unloaded date raises NoTableForDateError
     instead of silently falling back to a "best guess."
  2. The rules_version string captures the federal+state vintage so a
     stored EligibilityResult can be recomputed deterministically.
"""
from __future__ import annotations

from datetime import date

import pytest

from backend.civic_api.snap.rules.federal import FederalSNAPRules
from backend.civic_api.snap.rules.poverty_guidelines import (
    NoTableForDateError,
    NoTableForStateError,
    max_allotment_for,
    minimum_benefit_for,
    poverty_guideline_for,
    sua_table_for,
)
from backend.civic_api.snap.rules.states.massachusetts import MassachusettsSNAPRules


FY25_REFERENCE = date(2025, 5, 10)
FY24_REFERENCE = date(2024, 5, 10)
FY30_FUTURE = date(2030, 1, 1)


class TestPovertyTableLookup:
    def test_fy25_in_window_returns_table(self):
        table = poverty_guideline_for(FY25_REFERENCE)
        assert table.fiscal_year == 2025

    def test_window_start_inclusive(self):
        # FY25 starts 10/01/2024 inclusive.
        table = poverty_guideline_for(date(2024, 10, 1))
        assert table.fiscal_year == 2025

    def test_window_end_inclusive(self):
        # FY25 ends 09/30/2025 inclusive.
        table = poverty_guideline_for(date(2025, 9, 30))
        assert table.fiscal_year == 2025

    def test_outside_window_raises(self):
        with pytest.raises(NoTableForDateError):
            poverty_guideline_for(FY24_REFERENCE)

    def test_future_date_raises(self):
        with pytest.raises(NoTableForDateError):
            poverty_guideline_for(FY30_FUTURE)


class TestMaxAllotmentLookup:
    def test_fy25_returns_table(self):
        assert max_allotment_for(FY25_REFERENCE).fiscal_year == 2025

    def test_outside_window_raises(self):
        with pytest.raises(NoTableForDateError):
            max_allotment_for(FY30_FUTURE)


class TestSUALookup:
    def test_ma_heating_cooling_in_fy25(self):
        from decimal import Decimal

        table = sua_table_for(FY25_REFERENCE)
        assert table.lookup("MA", "heating_cooling") == Decimal("799")

    def test_unloaded_state_raises(self):
        table = sua_table_for(FY25_REFERENCE)
        with pytest.raises(NoTableForStateError):
            table.lookup("WY", "heating_cooling")

    def test_outside_date_window_raises(self):
        with pytest.raises(NoTableForDateError):
            sua_table_for(FY30_FUTURE)


class TestMinimumBenefitLookup:
    def test_fy25_minimum_benefit(self):
        from decimal import Decimal

        assert minimum_benefit_for(FY25_REFERENCE) == Decimal("23")

    def test_outside_window_raises(self):
        with pytest.raises(NoTableForDateError):
            minimum_benefit_for(FY30_FUTURE)


class TestRulesVersionString:
    def test_federal_only_version(self):
        rules = FederalSNAPRules(effective_date=FY25_REFERENCE)
        assert rules.rules_version == "federal-2025-05-10"

    def test_ma_version_includes_both(self):
        rules = MassachusettsSNAPRules(effective_date=FY25_REFERENCE)
        assert rules.rules_version == "federal-2025-05-10/MA-2025-05-10"

    def test_eligibility_result_carries_rules_version(self, ma_rules, make_household):
        hh = make_household(wages=1000)
        result = ma_rules.determine_eligibility(hh)
        assert result.rules_version == ma_rules.rules_version
        assert result.effective_date == ma_rules.effective_date
