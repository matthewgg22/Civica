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
