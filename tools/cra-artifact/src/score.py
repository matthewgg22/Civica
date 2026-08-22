"""County-grain need metrics for a bank's assessment area.

Data grain contract (eng review 2026-08-22): everything here is COUNTY-grain,
computed from the existing track1-food-desert county_metrics.csv. No PUMA math,
no crosswalks — that work already happened upstream of the CSV.
"""
import csv
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
COUNTY_METRICS = REPO_ROOT / "data-ops/analysis/track1-food-desert/artifacts/county_metrics.csv"

ANNUAL_BENEFIT_PER_HOUSEHOLD = None  # set from funnel assumptions at call time


class DataGapError(Exception):
    """A county the computation requires is missing entirely (hard error)."""


def load_county_metrics(path=COUNTY_METRICS):
    rows = {}
    with open(path, newline="") as f:
        for r in csv.DictReader(f):
            rows[r["County"]] = {
                "eligible_pop": float(r["eligible_pop"]),
                "non_enroll_rate": float(r["non_enroll_rate"]),
            }
    if not rows:
        raise DataGapError(f"county metrics file is empty: {path}")
    return rows


def state_average(metrics):
    """Eligible-population-weighted statewide non-enrollment rate."""
    tot_e = sum(m["eligible_pop"] for m in metrics.values())
    if tot_e == 0:
        raise DataGapError("state denominator is zero — refusing to divide")
    tot_non = sum(m["eligible_pop"] * m["non_enroll_rate"] for m in metrics.values())
    return tot_non / tot_e


def bank_need(aa_counties, metrics, assumptions):
    """Compute the artifact's numbers for a bank's assessment-area counties.

    Returns a dict with absolute-need headline numbers, the (possibly
    suppressed) disproportionality ratio, and data-gap notes. Counties present
    in the AA but absent from the metrics are recorded as gaps (rendered gray,
    never zero) — but if ALL AA counties are missing, that's a hard error.
    """
    covered, gaps = [], []
    for c in aa_counties:
        (covered if c in metrics else gaps).append(c)
    if not covered:
        raise DataGapError(f"no metrics coverage for any AA county: {aa_counties}")

    eligible = sum(metrics[c]["eligible_pop"] for c in covered)
    unenrolled = sum(metrics[c]["eligible_pop"] * metrics[c]["non_enroll_rate"] for c in covered)
    aa_rate = unenrolled / eligible
    state_rate = state_average(metrics)
    ratio = aa_rate / state_rate

    hh = assumptions["household_size_eligible"]
    monthly = assumptions["benefit"]["avg_household_monthly_usd"]
    annual = monthly * 12
    benefit_low = unenrolled / hh["low_dollar"] * annual
    benefit_high = unenrolled / hh["high_dollar"] * annual

    threshold = assumptions["ratio_display_threshold"]
    return {
        "covered_counties": covered,
        "gap_counties": gaps,
        "eligible": eligible,
        "unenrolled": unenrolled,
        "aa_enrolled_pct": (1 - aa_rate) * 100,
        "state_enrolled_pct": (1 - state_rate) * 100,
        "ratio": ratio,
        # Ratio suppression rule (design review Pass 2 / eng tension T2):
        # show only where favorable AND robust; threshold lives in assumptions.
        "show_ratio": ratio >= threshold,
        "benefit_low_usd": benefit_low,
        "benefit_high_usd": benefit_high,
        "avg_household_monthly_usd": monthly,
    }
