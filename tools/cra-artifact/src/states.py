"""State registry for the CRA artifact generator.

Adding a state = one entry here + its fact base existing in
data-ops/sample/{xx}-snap-gap/ (built by tools/snap-gap-states/build_state.py).

`program_ref` is the resident-facing benefit name used in ad copy and the
proposal page ("You may qualify for X — check in 5 minutes").
`fns_caution` marks states whose fact-base summaries carry an FNS-divergence
CAUTION note (PA, NJ): their PDFs must not lead with absolute-gap headlines —
the generator refuses those states until a state-appropriate template exists.
"""
from pathlib import Path


class ArtifactBlockedError(Exception):
    """Raised for a bank whose evidence is sound but whose fact base is not.

    Meridian Bank's single assessment area spans Pennsylvania, New Jersey,
    Delaware and Maryland. PA and NJ are refused on purpose -- their fact bases
    carry FNS-divergence CAUTION notes, so the artifact's headline metric cannot
    be stated for them -- and DE and MD were never built. Nine of its eleven
    counties are in refused states and the other two have no data, so no figure
    in that assessment area can be produced. The bank is fine; our data is not.
    """


def assert_buildable(key, bank):
    """Refuse a blocked bank loudly, before any figure is computed."""
    if bank.get("artifact_status") == "blocked":
        raise ArtifactBlockedError(
            f"{key}: {bank.get('artifact_block_reason', 'no reason recorded')}")

REPO_ROOT = Path(__file__).resolve().parents[3]

STATES = {
    "CA": {
        "fips": "06",
        "metrics": REPO_ROOT / "data-ops/analysis/track1-food-desert/artifacts/county_metrics.csv",
        "geojson": "ca_named",  # legacy name-keyed ca_counties.geojson
        "program_ref": "CalFresh (SNAP)",
        "model_note": "modeled from 2023 ACS 1-Year PUMS (LightGBM, CV AUC 0.80)",
        "method_short": "modeled",
        "method_bullet": "Modeled from the 2023 American Community Survey 1-Year Public Use Microdata Sample (PUMS) with a gradient-boosted classifier (cross-validated AUC 0.80), allocated from Public Use Microdata Areas to counties by a tract-weighted crosswalk.",
    },
    "FL": {
        "fips": "12",
        "metrics": REPO_ROOT / "data-ops/sample/fl-snap-gap/fl_county_metrics.csv",
        "geojson": "national",
        "program_ref": "SNAP",
        "model_note": "estimated directly from 2023 ACS 1-Year PUMS household records (gross-income eligibility test, survey-weighted)",
           "method_short": "survey-weighted fact base",
           "method_bullet": "Estimated directly from the 2023 American Community Survey 1-Year Public Use Microdata Sample (PUMS): households passing the SNAP gross-income test (130% of the federal poverty guideline by household size) that do not report SNAP receipt, survey-weighted, allocated from Public Use Microdata Areas to counties by a tract-weighted crosswalk.",
    },
    "TX": {
        "fips": "48",
        "metrics": REPO_ROOT / "data-ops/sample/tx-snap-gap/tx_county_metrics.csv",
        "geojson": "national",
        "program_ref": "SNAP",
        "model_note": "estimated directly from 2023 ACS 1-Year PUMS household records (gross-income eligibility test, survey-weighted)",
           "method_short": "survey-weighted fact base",
           "method_bullet": "Estimated directly from the 2023 American Community Survey 1-Year Public Use Microdata Sample (PUMS): households passing the SNAP gross-income test (130% of the federal poverty guideline by household size) that do not report SNAP receipt, survey-weighted, allocated from Public Use Microdata Areas to counties by a tract-weighted crosswalk.",
    },
    "NY": {
        "fips": "36",
        "metrics": REPO_ROOT / "data-ops/sample/ny-snap-gap/ny_county_metrics.csv",
        "geojson": "national",
        "program_ref": "SNAP",
        "model_note": "estimated directly from 2023 ACS 1-Year PUMS household records (gross-income eligibility test, survey-weighted)",
           "method_short": "survey-weighted fact base",
           "method_bullet": "Estimated directly from the 2023 American Community Survey 1-Year Public Use Microdata Sample (PUMS): households passing the SNAP gross-income test (130% of the federal poverty guideline by household size) that do not report SNAP receipt, survey-weighted, allocated from Public Use Microdata Areas to counties by a tract-weighted crosswalk.",
    },
    "AZ": {"fips": "04", "metrics": REPO_ROOT / "data-ops/sample/az-snap-gap/az_county_metrics.csv",
           "geojson": "national", "program_ref": "SNAP (Nutrition Assistance)",
           "model_note": "estimated directly from 2023 ACS 1-Year PUMS household records (gross-income eligibility test, survey-weighted)",
           "method_short": "survey-weighted fact base",
           "method_bullet": "Estimated directly from the 2023 American Community Survey 1-Year Public Use Microdata Sample (PUMS): households passing the SNAP gross-income test (130% of the federal poverty guideline by household size) that do not report SNAP receipt, survey-weighted, allocated from Public Use Microdata Areas to counties by a tract-weighted crosswalk."},
    # ---- FNS-divergence states -------------------------------------------
    # These carry a CAUTION in their fact base: the gross-income proxy and the
    # FNS administrative estimate disagree badly, and in these states the proxy's
    # upward biases dominate. They are wired in "coverage" mode -- the artifact
    # ranks counties by relative coverage and states NO absolute gap and NO
    # unclaimed-dollar figure. See src/coverage.py.
    "PA": {"fips": "42", "metrics": REPO_ROOT / "data-ops/sample/pa-snap-gap/pa_county_metrics.csv",
           "geojson": "national", "program_ref": "SNAP", "headline_mode": "coverage",
           "fns_note": "USDA FNS rates Pennsylvania participation at 100% (a capped estimate) under federal eligibility rules for FY2022 — statistically, no measurable enrollment gap. This document therefore makes no claim about the number of eligible residents not enrolled, and puts no dollar figure on unclaimed benefits.",
           "model_note": "ranked from the national county coverage index (ACS 2024 5-year, tables B22003 and B17017)",
           "method_short": "relative coverage ranking",
           "method_bullet": "Counties are RANKED, not counted. Coverage is SNAP households divided by households below 100% of the federal poverty line (ACS 2024 5-year, B22003 and B17017). Because SNAP eligibility reaches roughly 130-200% of poverty while that denominator stops at 100%, coverage above 1.0 is expected and does not indicate over-enrollment. This is a screening index for choosing where to work; it is not an eligibility model and produces no population estimate."},
    "NJ": {"fips": "34", "metrics": REPO_ROOT / "data-ops/sample/nj-snap-gap/nj_county_metrics.csv",
           "geojson": "national", "program_ref": "SNAP", "headline_mode": "coverage",
           "fns_note": "USDA FNS rates New Jersey participation at 91% for FY2022 — roughly 70,000 eligible residents not enrolled statewide, far below what a gross-income proxy suggests. This document therefore makes no claim about the number of eligible residents not enrolled in this assessment area, and puts no dollar figure on unclaimed benefits.",
           "model_note": "ranked from the national county coverage index (ACS 2024 5-year, tables B22003 and B17017)",
           "method_short": "relative coverage ranking",
           "method_bullet": "Counties are RANKED, not counted. Coverage is SNAP households divided by households below 100% of the federal poverty line (ACS 2024 5-year, B22003 and B17017). Because SNAP eligibility reaches roughly 130-200% of poverty while that denominator stops at 100%, coverage above 1.0 is expected and does not indicate over-enrollment. This is a screening index for choosing where to work; it is not an eligibility model and produces no population estimate."},
    "IL": {"fips": "17", "metrics": REPO_ROOT / "data-ops/sample/il-snap-gap/il_county_metrics.csv",
           "geojson": "national", "program_ref": "SNAP",
           "model_note": "estimated directly from 2023 ACS 1-Year PUMS household records (gross-income eligibility test, survey-weighted)",
           "method_short": "survey-weighted fact base",
           "method_bullet": "Estimated directly from the 2023 American Community Survey 1-Year Public Use Microdata Sample (PUMS): households passing the SNAP gross-income test (130% of the federal poverty guideline by household size) that do not report SNAP receipt, survey-weighted, allocated from Public Use Microdata Areas to counties by a tract-weighted crosswalk."},
    "KY": {"fips": "21", "metrics": REPO_ROOT / "data-ops/sample/ky-snap-gap/ky_county_metrics.csv",
           "geojson": "national", "program_ref": "SNAP",
           "model_note": "estimated directly from 2023 ACS 1-Year PUMS household records (gross-income eligibility test, survey-weighted)",
           "method_short": "survey-weighted fact base",
           "method_bullet": "Estimated directly from the 2023 American Community Survey 1-Year Public Use Microdata Sample (PUMS): households passing the SNAP gross-income test (130% of the federal poverty guideline by household size) that do not report SNAP receipt, survey-weighted, allocated from Public Use Microdata Areas to counties by a tract-weighted crosswalk."},
    "TN": {"fips": "47", "metrics": REPO_ROOT / "data-ops/sample/tn-snap-gap/tn_county_metrics.csv",
           "geojson": "national", "program_ref": "SNAP",
           "model_note": "estimated directly from 2023 ACS 1-Year PUMS household records (gross-income eligibility test, survey-weighted)",
           "method_short": "survey-weighted fact base",
           "method_bullet": "Estimated directly from the 2023 American Community Survey 1-Year Public Use Microdata Sample (PUMS): households passing the SNAP gross-income test (130% of the federal poverty guideline by household size) that do not report SNAP receipt, survey-weighted, allocated from Public Use Microdata Areas to counties by a tract-weighted crosswalk."},
    "AR": {"fips": "05", "metrics": REPO_ROOT / "data-ops/sample/ar-snap-gap/ar_county_metrics.csv",
           "geojson": "national", "program_ref": "SNAP",
           "model_note": "estimated directly from 2023 ACS 1-Year PUMS household records (gross-income eligibility test, survey-weighted)",
           "method_short": "survey-weighted fact base",
           "method_bullet": "Estimated directly from the 2023 American Community Survey 1-Year Public Use Microdata Sample (PUMS): households passing the SNAP gross-income test (130% of the federal poverty guideline by household size) that do not report SNAP receipt, survey-weighted, allocated from Public Use Microdata Areas to counties by a tract-weighted crosswalk."},
    "SC": {"fips": "45", "metrics": REPO_ROOT / "data-ops/sample/sc-snap-gap/sc_county_metrics.csv",
           "geojson": "national", "program_ref": "SNAP",
           "model_note": "estimated directly from 2023 ACS 1-Year PUMS household records (gross-income eligibility test, survey-weighted)",
           "method_short": "survey-weighted fact base",
           "method_bullet": "Estimated directly from the 2023 American Community Survey 1-Year Public Use Microdata Sample (PUMS): households passing the SNAP gross-income test (130% of the federal poverty guideline by household size) that do not report SNAP receipt, survey-weighted, allocated from Public Use Microdata Areas to counties by a tract-weighted crosswalk."},
    "MS": {"fips": "28", "metrics": REPO_ROOT / "data-ops/sample/ms-snap-gap/ms_county_metrics.csv",
           "geojson": "national", "program_ref": "SNAP",
           "model_note": "estimated directly from 2023 ACS 1-Year PUMS household records (gross-income eligibility test, survey-weighted)",
           "method_short": "survey-weighted fact base",
           "method_bullet": "Estimated directly from the 2023 American Community Survey 1-Year Public Use Microdata Sample (PUMS): households passing the SNAP gross-income test (130% of the federal poverty guideline by household size) that do not report SNAP receipt, survey-weighted, allocated from Public Use Microdata Areas to counties by a tract-weighted crosswalk."},
    # PA/NJ deliberately ABSENT: their fact bases carry FNS-divergence CAUTION
    # notes (FNS rates PA at capped-100%, NJ at 91%) — the absolute-need
    # headline this template leads with would be dishonest there. Add them
    # only with a consent-order-anchored template variant.
}


class UnsupportedStateError(Exception):
    pass


def state_meta(code: str) -> dict:
    try:
        return STATES[code.upper()]
    except KeyError:
        raise UnsupportedStateError(
            f"state {code!r} not wired for artifact generation "
            f"(supported: {sorted(STATES)}). PA/NJ are excluded on purpose — "
            "see src/states.py.")
