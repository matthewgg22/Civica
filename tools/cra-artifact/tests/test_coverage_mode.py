"""FNS-divergence states: rank, never count."""
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src import coverage, generate, states

TOOL_ROOT = Path(__file__).resolve().parents[1]
COVERAGE_BANKS = ("meridian_bank",)


def _page_one_text(key):
    generate.main(["--bank", key, "--html-only"])
    html = (TOOL_ROOT / f"out/{key}.html").read_text()
    page1 = html.split("<!-- PAGE 2")[0]
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", page1))


def _headline_text(key):
    """Just the claim block -- the research strip lower on page 1 legitimately
    cites figures (a $2,436 debt effect, ~65,000 study subjects) that are not
    claims about this assessment area."""
    generate.main(["--bank", key, "--html-only"])
    html = (TOOL_ROOT / f"out/{key}.html").read_text()
    page1 = html.split("<!-- PAGE 2")[0]
    block = page1.split('<div class="maprow">')[0]
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", block))


def test_pennsylvania_and_new_jersey_are_coverage_mode():
    """They were previously refused outright. The refusal was right -- an
    absolute gap cannot be claimed where FNS puts participation at 100% -- but
    refusing a state is not the same as having nothing true to say about it."""
    for st in ("PA", "NJ"):
        assert states.state_meta(st).get("headline_mode") == "coverage"
        assert states.state_meta(st).get("fns_note")


def test_a_coverage_artifact_states_no_population_gap():
    """The whole point. No 'N residents are not receiving benefits'."""
    for key in COVERAGE_BANKS:
        text = _page_one_text(key)
        assert "are not receiving" not in text, f"{key}: page 1 claims a population gap"
        # "not enrolled" is permitted ONLY inside the sentence disclaiming it
        stripped = text.replace(
            "makes no claim about the number of eligible residents not enrolled", "")
        assert "not enrolled" not in stripped, f"{key}: asserts non-enrollment outside the disclaimer"
        assert not re.search(r"\b\d[\d,]{4,}\b", _headline_text(key)), (
            f"{key}: the headline block carries a population-scale count")


def test_a_coverage_artifact_puts_no_dollar_figure_on_unclaimed_benefits():
    for key in COVERAGE_BANKS:
        text = _page_one_text(key)
        assert "unclaimed federal nutrition benefits" not in text, key
        assert not re.search(r"\$[\d.]+ ?[MB]", _headline_text(key)), (
            f"{key}: the headline block carries a dollar magnitude")


def test_a_coverage_artifact_says_what_it_is_not_claiming():
    """A silent omission is not a disclosure."""
    for key in COVERAGE_BANKS:
        text = _page_one_text(key)
        assert "states no gap size and no dollar figure" in text, key
        assert "USDA FNS rates" in text, f"{key}: no FNS divergence disclosure"
        assert "ranked, not counted" in text, key


def test_a_coverage_artifact_names_the_county_to_work_in():
    """Refusing to size the gap is only useful if it still directs the money."""
    for key in COVERAGE_BANKS:
        text = _page_one_text(key)
        assert "least-covered county" in text, key
        assert "Burlington" in text, f"{key}: does not name the target county"


def test_coverage_above_one_is_explained_not_hidden():
    """Most Pennsylvania counties score above 1.0 because the denominator stops
    at the poverty line while eligibility does not. Unexplained, that number
    reads as 'more enrolled than qualify', which is false."""
    text = _page_one_text("meridian_bank")
    assert "coverage above 1.0 is expected" in text


def test_the_funnel_is_caveated_in_a_high_participation_state():
    """Conversion rates were observed where gaps are large. In a state at ~100%
    participation more of the people reached are already enrolled."""
    generate.main(["--bank", "meridian_bank", "--html-only"])
    html = (TOOL_ROOT / "out/meridian_bank.html").read_text()
    assert "upper bound" in html and "already be enrolled" in html


def test_absolute_states_are_untouched():
    """The variant must not soften states whose fact base does support a claim."""
    text = _page_one_text("busey_bank")
    assert "are not receiving" in text
    assert "unclaimed federal nutrition benefits" in text
    assert "states no gap size" not in text


def test_the_ranking_orders_least_covered_first():
    idx = coverage.load_coverage()
    r = coverage.rank_assessment_area(["Philadelphia", "Chester"], "PA", idx)
    ratios = [c["coverage_ratio"] for c in r["ranked"]]
    assert ratios == sorted(ratios)
    assert r["least_covered"]["county"] == "Chester"


def test_ranking_refuses_an_assessment_area_it_cannot_place():
    idx = coverage.load_coverage()
    with pytest.raises(coverage.NoCoverageDataError):
        coverage.rank_assessment_area(["Nowhere"], "ZZ", idx)
