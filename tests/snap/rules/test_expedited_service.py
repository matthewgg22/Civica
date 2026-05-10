"""Expedited service tests (7 CFR 273.2(i)).

Three eligibility paths for expedited (within-7-day) processing:
  1. Gross monthly income < $150 AND liquid resources <= $100
  2. Combined gross + liquid < monthly housing + utility costs
  3. Migrant/seasonal farmworker with liquid resources <= $100
"""
from __future__ import annotations

from decimal import Decimal


class TestExpeditedPath1LowIncomeLowResources:
    def test_under_150_income_and_under_100_resources_qualifies(
        self, federal_rules, make_household
    ):
        hh = make_household(wages=149, countable_resources=99)
        result = federal_rules.determine_eligibility(hh)
        assert result.expedited_eligible is True

    def test_at_150_income_does_not_qualify_path_1(self, federal_rules, make_household):
        # The threshold is strict less-than, so $150 exactly does not qualify
        # by path 1 (may still qualify by path 2 if shelter is high).
        hh = make_household(wages=150, countable_resources=99)
        result = federal_rules.determine_eligibility(hh)
        # No shelter cost in this fixture, so path 2 also won't fire.
        assert result.expedited_eligible is False

    def test_resources_over_100_does_not_qualify_path_1(self, federal_rules, make_household):
        hh = make_household(wages=100, countable_resources=101)
        result = federal_rules.determine_eligibility(hh)
        assert result.expedited_eligible is False


class TestExpeditedPath2HighShelter:
    def test_combined_below_shelter_qualifies(self, federal_rules, make_household):
        # Income $400, resources $100, rent $600. 400 + 100 = 500 < 600.
        hh = make_household(wages=400, countable_resources=100, rent=600)
        result = federal_rules.determine_eligibility(hh)
        assert result.expedited_eligible is True

    def test_combined_at_shelter_does_not_qualify(self, federal_rules, make_household):
        # Path 2 uses strict less-than.
        hh = make_household(wages=400, countable_resources=200, rent=600)
        result = federal_rules.determine_eligibility(hh)
        assert result.expedited_eligible is False

    def test_combined_above_shelter_does_not_qualify(self, federal_rules, make_household):
        hh = make_household(wages=500, countable_resources=200, rent=600)
        result = federal_rules.determine_eligibility(hh)
        assert result.expedited_eligible is False


class TestExpeditedPath3Farmworker:
    def test_farmworker_with_low_resources_qualifies(self, ma_rules, make_household):
        # Path 3 fires for any SNAP-eligible migrant/seasonal farmworker
        # with <= $100 liquid resources. Wages picked low enough to clear
        # both gross (< 200% FPL = $2,510) and net (< 100% FPL = $1,255).
        hh = make_household(
            wages=1200,
            countable_resources=100,
            is_seasonal_farmworker=True,
        )
        result = ma_rules.determine_eligibility(hh)
        assert result.expedited_eligible is True

    def test_non_farmworker_low_income_low_resources_not_path_3(
        self, ma_rules, make_household
    ):
        hh = make_household(
            wages=1200,
            countable_resources=100,
            is_seasonal_farmworker=False,
        )
        result = ma_rules.determine_eligibility(hh)
        # Path 1 fails ($1,200 not < $150), path 2 fails (no shelter), path 3
        # requires farmworker. So expedited should be False even though the
        # household is otherwise SNAP-eligible.
        assert result.expedited_eligible is False

    def test_farmworker_with_high_resources_does_not_qualify(
        self, ma_rules, make_household
    ):
        hh = make_household(
            wages=200,
            countable_resources=500,
            is_seasonal_farmworker=True,
        )
        result = ma_rules.determine_eligibility(hh)
        # Path 1 fails (income > 150 OR resources > 100), path 3 fails (resources > 100)
        # Path 2 might fire if shelter is high enough, but no shelter here.
        assert result.expedited_eligible is False


def test_expedited_only_set_when_eligible(ma_rules, make_household):
    """expedited_eligible should remain False on ineligibility outcomes —
    the field shouldn't be populated for an ineligible result."""
    hh = make_household(wages=10000)  # blow past every threshold
    result = ma_rules.determine_eligibility(hh)
    # Defaults to False on ineligible result construction.
    assert result.expedited_eligible is False
