"""Validator tests — most logic-heavy piece of Phase E.

Pure functions, no LLM, fully deterministic. ~25 cases covering each
invariant + the prior-paystub comparison rules.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from backend.civic_api.snap.documents.schemas import (
    Paystub,
    PaystubDeduction,
    PaystubDeductionCategory,
)
from backend.civic_api.snap.documents.validator import (
    has_blocker,
    overall_extraction_confidence,
    validate_paystub,
)


def _flag_codes(flags) -> set[str]:
    return {f.code for f in flags}


# ---------------------------------------------------------------------------
# Period dates
# ---------------------------------------------------------------------------


class TestPeriodDates:
    def test_normal_two_week_period_no_flags(self, make_paystub):
        flags = validate_paystub(make_paystub())
        assert "period_end_before_start" not in _flag_codes(flags)
        assert "period_span_too_long" not in _flag_codes(flags)

    def test_end_before_start_blocks(self, make_paystub):
        p = make_paystub(
            pay_period_start=date(2025, 4, 14),
            pay_period_end=date(2025, 4, 1),
        )
        flags = validate_paystub(p)
        assert "period_end_before_start" in _flag_codes(flags)
        assert has_blocker(flags)

    def test_unusually_long_period_warns(self, make_paystub):
        p = make_paystub(
            pay_period_start=date(2025, 4, 1),
            pay_period_end=date(2025, 5, 30),  # ~60 days
        )
        flags = validate_paystub(p)
        assert "period_span_too_long" in _flag_codes(flags)
        assert not has_blocker(flags)


# ---------------------------------------------------------------------------
# Net vs gross
# ---------------------------------------------------------------------------


class TestNetVersusGross:
    def test_net_below_gross_passes(self, make_paystub):
        flags = validate_paystub(make_paystub())
        assert "net_exceeds_gross" not in _flag_codes(flags)

    def test_net_exceeding_gross_blocks(self, make_paystub):
        p = make_paystub(
            gross_pay_period=Decimal("1000"),
            net_pay_period=Decimal("1500"),
            deductions=[],
            gross_pay_ytd=Decimal("12000"),
            net_pay_ytd=Decimal("9000"),
        )
        flags = validate_paystub(p)
        assert "net_exceeds_gross" in _flag_codes(flags)
        assert has_blocker(flags)


# ---------------------------------------------------------------------------
# gross - deductions = net
# ---------------------------------------------------------------------------


class TestGrossMinusDeductionsMatchesNet:
    def test_balanced_paystub_passes(self, make_paystub):
        # Default fixture sums to 419.90 in deductions. 1800 - 419.90 = 1380.10.
        # Printed net is 1380.00 → diff $0.10, within $2 tolerance.
        flags = validate_paystub(make_paystub())
        assert "gross_minus_deductions_does_not_match_net" not in _flag_codes(flags)

    def test_imbalance_within_tolerance_passes(self, make_paystub):
        p = make_paystub(net_pay_period=Decimal("1381.50"))  # off by $1.40
        flags = validate_paystub(p)
        assert "gross_minus_deductions_does_not_match_net" not in _flag_codes(flags)

    def test_imbalance_over_tolerance_warns(self, make_paystub):
        p = make_paystub(net_pay_period=Decimal("1500.00"))  # off by ~$120
        flags = validate_paystub(p)
        assert "gross_minus_deductions_does_not_match_net" in _flag_codes(flags)
        # Warning, not blocker.
        assert not has_blocker(flags)

    def test_no_deductions_with_net_below_gross_warns(self, make_paystub):
        p = make_paystub(
            deductions=[],
            net_pay_period=Decimal("1500.00"),
        )
        flags = validate_paystub(p)
        assert "no_deductions_but_net_lower_than_gross" in _flag_codes(flags)

    def test_no_deductions_with_net_equal_gross_no_flag(self, make_paystub):
        p = make_paystub(
            deductions=[],
            net_pay_period=Decimal("1800.00"),
        )
        flags = validate_paystub(p)
        assert "no_deductions_but_net_lower_than_gross" not in _flag_codes(flags)


# ---------------------------------------------------------------------------
# Hours × rate
# ---------------------------------------------------------------------------


class TestHoursTimesRate:
    def test_hours_times_rate_matches_gross(self, make_paystub):
        # 80 hours × $22.50 = $1,800. Default fixture matches.
        flags = validate_paystub(make_paystub())
        assert "hours_times_rate_mismatch" not in _flag_codes(flags)

    def test_hours_times_rate_mismatch_warns(self, make_paystub):
        p = make_paystub(
            hours_worked_in_period=Decimal("40"),
            hourly_rate=Decimal("22.50"),
            # gross stays at 1800 → expected 900, off by 900.
        )
        flags = validate_paystub(p)
        assert "hours_times_rate_mismatch" in _flag_codes(flags)

    def test_salaried_skips_hours_check(self, make_paystub):
        p = make_paystub(
            is_salaried=True,
            hours_worked_in_period=None,
            hourly_rate=None,
        )
        flags = validate_paystub(p)
        assert "hours_times_rate_mismatch" not in _flag_codes(flags)

    def test_missing_hours_skips_check(self, make_paystub):
        p = make_paystub(hours_worked_in_period=None)
        flags = validate_paystub(p)
        assert "hours_times_rate_mismatch" not in _flag_codes(flags)


# ---------------------------------------------------------------------------
# YTD relationships
# ---------------------------------------------------------------------------


class TestYTDRelationships:
    def test_ytd_above_period_passes(self, make_paystub):
        flags = validate_paystub(make_paystub())
        assert "gross_ytd_less_than_period" not in _flag_codes(flags)

    def test_gross_ytd_below_period_warns(self, make_paystub):
        p = make_paystub(gross_pay_ytd=Decimal("500"))
        flags = validate_paystub(p)
        assert "gross_ytd_less_than_period" in _flag_codes(flags)

    def test_net_ytd_below_period_warns(self, make_paystub):
        p = make_paystub(net_pay_ytd=Decimal("500"))
        flags = validate_paystub(p)
        assert "net_ytd_less_than_period" in _flag_codes(flags)

    def test_net_ytd_exceeding_gross_ytd_blocks(self, make_paystub):
        p = make_paystub(
            gross_pay_ytd=Decimal("10000"),
            net_pay_ytd=Decimal("12000"),
        )
        flags = validate_paystub(p)
        assert "net_ytd_exceeds_gross_ytd" in _flag_codes(flags)
        assert has_blocker(flags)

    def test_missing_ytd_fields_no_flags(self, make_paystub):
        p = make_paystub(gross_pay_ytd=None, net_pay_ytd=None)
        flags = validate_paystub(p)
        assert "gross_ytd_less_than_period" not in _flag_codes(flags)
        assert "net_ytd_less_than_period" not in _flag_codes(flags)


# ---------------------------------------------------------------------------
# Prior-paystub comparison
# ---------------------------------------------------------------------------


class TestPriorPaystubComparison:
    def test_no_priors_no_flags(self, make_paystub):
        flags = validate_paystub(make_paystub(), prior_paystubs=[])
        assert "duplicate_pay_period" not in _flag_codes(flags)
        assert "ytd_regressed_versus_prior" not in _flag_codes(flags)

    def test_duplicate_period_flagged(self, make_paystub):
        prior = make_paystub()
        current = make_paystub()  # same employer + period
        flags = validate_paystub(current, prior_paystubs=[prior])
        assert "duplicate_pay_period" in _flag_codes(flags)

    def test_different_period_no_duplicate(self, make_paystub):
        prior = make_paystub()  # 2025-04-01 to 04-14
        current = make_paystub(
            pay_period_start=date(2025, 4, 15),
            pay_period_end=date(2025, 4, 28),
            pay_date=date(2025, 5, 2),
            gross_pay_ytd=Decimal("16200"),
            net_pay_ytd=Decimal("12420"),
        )
        flags = validate_paystub(current, prior_paystubs=[prior])
        assert "duplicate_pay_period" not in _flag_codes(flags)

    def test_ytd_regression_flagged(self, make_paystub):
        prior = make_paystub(
            pay_period_start=date(2025, 4, 1),
            pay_period_end=date(2025, 4, 14),
            gross_pay_ytd=Decimal("14400"),
            net_pay_ytd=Decimal("11040"),
        )
        current = make_paystub(
            pay_period_start=date(2025, 4, 15),
            pay_period_end=date(2025, 4, 28),
            pay_date=date(2025, 5, 2),
            gross_pay_ytd=Decimal("13000"),  # less than prior — regression
            net_pay_ytd=Decimal("9700"),
        )
        flags = validate_paystub(current, prior_paystubs=[prior])
        assert "ytd_regressed_versus_prior" in _flag_codes(flags)

    def test_different_employer_skips_comparison(self, make_paystub):
        prior = make_paystub(employer_name="Other Corp")
        current = make_paystub()
        flags = validate_paystub(current, prior_paystubs=[prior])
        # Same period dates but different employers → not a duplicate.
        assert "duplicate_pay_period" not in _flag_codes(flags)


# ---------------------------------------------------------------------------
# overall_extraction_confidence helper
# ---------------------------------------------------------------------------


class TestOverallConfidence:
    def test_zero_when_blocker(self, make_paystub):
        p = make_paystub(
            gross_pay_period=Decimal("1000"),
            net_pay_period=Decimal("1500"),
            deductions=[],
        )
        flags = validate_paystub(p)
        confidence = overall_extraction_confidence(0.95, flags)
        assert confidence == 0.0

    def test_full_confidence_when_no_flags(self, make_paystub):
        flags = validate_paystub(make_paystub())
        # Default fixture should produce no warning flags.
        confidence = overall_extraction_confidence(0.95, flags)
        assert 0.85 <= confidence <= 0.95

    def test_warnings_apply_penalty(self, make_paystub):
        p = make_paystub(net_pay_period=Decimal("1500"))  # off by $120
        flags = validate_paystub(p)
        assert any(f.severity == "warning" for f in flags)
        confidence = overall_extraction_confidence(0.95, flags)
        # 0.95 minus 10% penalty per warning, capped at 30%.
        assert confidence < 0.95
