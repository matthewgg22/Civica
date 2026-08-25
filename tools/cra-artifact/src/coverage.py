"""Relative-need ranking for states where an absolute gap cannot be claimed.

Some states' fact bases carry an FNS-divergence CAUTION. Pennsylvania is the
extreme case: USDA FNS rates PA participation at 100% (capped) under federal
eligibility rules -- a statistically-zero gap -- while our gross-income proxy
shows ~803,000 people in non-receipt households. Both cannot be true, and in PA
the proxy's known upward biases (ACS SNAP under-reporting, a 130% screen against
a 200% BBCE state) dominate. The fact base itself says: use these figures ONLY
as geographic ranking, never as an absolute-gap claim.

So for those states the artifact must not say "N residents are not receiving
benefits" and must not put a dollar figure on unclaimed benefits. What it CAN
do is rank: which counties inside this assessment area are least covered
relative to the others.

That ranking comes from the national coverage index
(data-ops/analysis/national-snap-coverage), which is deliberately a screening
index and not an eligibility model:

    coverage = SNAP households / households below 100% FPL

Both terms are ACS (B22003 and B17017). Because SNAP eligibility reaches roughly
130-200% FPL while the denominator stops at 100%, **coverage above 1.0 is
expected and common** -- it does not mean more people are enrolled than qualify.
The index orders geographies. It counts nothing.
"""
import csv
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
COVERAGE_CSV = REPO_ROOT / "data-ops/analysis/national-snap-coverage/national_snap_coverage_county.csv"


class NoCoverageDataError(Exception):
    """Raised when none of an assessment area's counties are in the index."""


def _norm(name):
    return (name or "").split(",")[0].strip().upper() \
        .replace(" COUNTY", "").replace(" PARISH", "").replace(".", "").replace(" ", "")


def load_coverage(path=COVERAGE_CSV):
    """{(state, NORMALISEDCOUNTY): {...}} for all 3,222 counties."""
    out = {}
    with open(path) as fh:
        for row in csv.DictReader(fh):
            try:
                ratio = float(row["coverage_ratio"])
            except (TypeError, ValueError):
                continue
            out[(row["state"], _norm(row["county"]))] = {
                "county": row["county"].split(",")[0].strip().removesuffix(" County")
                                     .removesuffix(" Parish").removesuffix(" city"),
                "state": row["state"],
                "coverage_ratio": ratio,
                "poor_hh": float(row["poor_hh"] or 0),
                "snap_hh": float(row["snap_hh"] or 0),
            }
    return out


def rank_assessment_area(aa_counties, state, index, extra_states=None):
    """Rank an assessment area's counties from least to best covered.

    `extra_states` lets a multi-state assessment area be ranked whole: pass
    {"NJ": ["Burlington", ...]} alongside the home-state counties.
    """
    wanted = [(state, c) for c in aa_counties]
    for st, counties in (extra_states or {}).items():
        wanted += [(st, c) for c in counties]

    found, missing = [], []
    for st, c in wanted:
        hit = index.get((st, _norm(c)))
        (found.append(hit) if hit else missing.append(f"{c} ({st})"))
    if not found:
        raise NoCoverageDataError(
            f"no coverage-index rows for any assessment-area county: {wanted}")

    found.sort(key=lambda r: r["coverage_ratio"])
    return {
        "ranked": found,
        "missing": missing,
        "least_covered": found[0],
        "n_counties": len(found),
        # counties whose coverage sits below the assessment area's own median
        "below_median": found[: max(1, len(found) // 2)],
    }
