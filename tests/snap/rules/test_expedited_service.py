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
        # Path 3 requires the household to be destitute: all income sources
        # terminated (is_ongoing=False) and any new-source income ≤ $25 by
        # day 10. When income is fully terminated effective_gross=$0, so
        # Path 1 also fires — both paths independently qualify the household.
        hh = make_household(
            wages=1200,
            wages_ongoing=False,
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


# ---------------------------------------------------------------------------
# Income projection — terminated income (is_ongoing=False)
# ---------------------------------------------------------------------------

class TestTerminatedIncome:
    def test_terminated_wages_not_counted_in_path1(self, federal_rules, make_household):
        # Worker whose job just ended: wages=1200 is_ongoing=False → effective
        # gross = $0. Liquid ≤ $100 → qualifies via Path 1.
        hh = make_household(wages=1200, wages_ongoing=False, countable_resources=80)
        result = federal_rules.determine_eligibility(hh)
        assert result.expedited_eligible is True

    def test_ongoing_wages_above_150_do_not_qualify_path1(
        self, federal_rules, make_household
    ):
        # Same dollar amount but still employed: must not qualify via Path 1.
        hh = make_household(wages=1200, wages_ongoing=True, countable_resources=80)
        result = federal_rules.determine_eligibility(hh)
        assert result.expedited_eligible is False

    def test_terminated_income_plus_liquid_vs_shelter_path2(
        self, federal_rules, make_household
    ):
        # Worker laid off: wages=800 terminated, liquid=$200, rent=$500.
        # effective_gross=$0, so 0 + 200 = $200 < $500 → Path 2 qualifies.
        hh = make_household(
            wages=800, wages_ongoing=False,
            countable_resources=200,
            rent=500,
        )
        result = federal_rules.determine_eligibility(hh)
        assert result.expedited_eligible is True

    def test_ongoing_income_above_shelter_path2_does_not_qualify(
        self, federal_rules, make_household
    ):
        # Same household but income still ongoing: 800 + 200 = $1000 > $500.
        hh = make_household(
            wages=800, wages_ongoing=True,
            countable_resources=200,
            rent=500,
        )
        result = federal_rules.determine_eligibility(hh)
        assert result.expedited_eligible is False

    def test_mixed_ongoing_and_terminated_sources(
        self, federal_rules, make_household
    ):
        # Wages ended but unearned (UI) still ongoing: effective_gross = $400
        # (UI only). $400 ≥ $150 → Path 1 does not fire.
        hh = make_household(
            wages=1200, wages_ongoing=False,
            unearned=400, unearned_ongoing=True,
            countable_resources=80,
        )
        result = federal_rules.determine_eligibility(hh)
        assert result.expedited_eligible is False


# ---------------------------------------------------------------------------
# Path 3 destitute test — income-source condition (7 CFR 273.10(e)(3))
# ---------------------------------------------------------------------------

class TestDestituteFarmworker:
    def test_terminated_source_no_new_income_qualifies(
        self, ma_rules, make_household
    ):
        # Farmworker: grower relationship ended (wages_ongoing=False),
        # no new job lined up. Fully destitute.
        hh = make_household(
            wages=1200,
            wages_ongoing=False,
            countable_resources=80,
            is_seasonal_farmworker=True,
        )
        result = ma_rules.determine_eligibility(hh)
        assert result.expedited_eligible is True

    def test_ongoing_wages_means_not_destitute(self, ma_rules, make_household):
        # Same farmworker but income is ongoing — not destitute per 273.10(e)(3).
        hh = make_household(
            wages=1200,
            wages_ongoing=True,
            countable_resources=80,
            is_seasonal_farmworker=True,
        )
        result = ma_rules.determine_eligibility(hh)
        assert result.expedited_eligible is False

    def test_new_source_negligible_still_qualifies(self, ma_rules, make_household):
        # Old job ended, new grower starts soon but will pay only $20 by day 10
        # ($20 ≤ $25 threshold). Still destitute.
        hh = make_household(
            wages=1200,
            wages_ongoing=False,
            countable_resources=80,
            is_seasonal_farmworker=True,
            new_source_income_within_10_days=20,
        )
        result = ma_rules.determine_eligibility(hh)
        assert result.expedited_eligible is True

    def test_employed_farmworker_not_destitute_path3(
        self, ma_rules, make_household
    ):
        # A farmworker whose income is STILL ONGOING is not destitute — the
        # grower relationship has not ended. With $1,200 ongoing wages, Path 1
        # and Path 2 also fail (income too high, no shelter). Path 3 destitute
        # check fails because all_sources_terminated=False. No path qualifies.
        #
        # NOTE on new_source isolation: when income IS terminated
        # (wages_ongoing=False) and liquid ≤ $100, effective_gross drops to $0
        # which makes Path 1 fire independently of Path 3. This means the
        # destitute new-source gate (new_source_income_within_10_days > $25)
        # can never be the sole deciding factor in that scenario — Path 1
        # always supersedes it. The gate is still implemented and checked;
        # see test_new_source_negligible_still_qualifies /
        # test_new_source_exactly_25_still_qualifies for the cases where the
        # field is exercised (alongside Path 1 also qualifying).
        hh = make_household(
            wages=1200,
            wages_ongoing=True,
            countable_resources=80,
            is_seasonal_farmworker=True,
        )
        result = ma_rules.determine_eligibility(hh)
        assert result.expedited_eligible is False

    def test_new_source_exactly_25_still_qualifies(self, ma_rules, make_household):
        # Boundary: exactly $25 is still ≤ $25, so the household is still
        # destitute (the regulation uses a strict greater-than for exclusion).
        hh = make_household(
            wages=1200,
            wages_ongoing=False,
            countable_resources=80,
            is_seasonal_farmworker=True,
            new_source_income_within_10_days=25,
        )
        result = ma_rules.determine_eligibility(hh)
        assert result.expedited_eligible is True

    def test_high_resources_blocks_path3_regardless_of_destitute_status(
        self, ma_rules, make_household
    ):
        # Destitute income-source condition met, but liquid > $100. Path 3
        # requires both conditions; resources fail.
        hh = make_household(
            wages=1200,
            wages_ongoing=False,
            countable_resources=150,
            is_seasonal_farmworker=True,
        )
        result = ma_rules.determine_eligibility(hh)
        assert result.expedited_eligible is False
