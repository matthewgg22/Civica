"""Ask sizing rules."""
import sys, json
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.ask import (size_ask, gap_multiplier, NoDocumentedGapError,
                     MIN_VIABLE_GRANT, CEILING)
from src import generate


def test_ask_is_a_share_of_the_assessment_area_budget_not_the_whole_thing():
    ask, verdict, d = size_ask(300_000, 3, "Low Satisfactory", "")
    assert verdict == "earmark"
    assert ask < d["annual_aa_giving_usd"], "an ask may never exceed one year of AA giving"


def test_a_bank_too_small_to_fund_a_campaign_is_a_pool_candidate_not_a_smaller_ask():
    """Below the minimum viable grant a cheque cannot fund a campaign that
    reaches an assessment area, so the answer is pooling -- not rounding up."""
    ask, verdict, _ = size_ask(24_000, 3, "Low Satisfactory", "Low Satisfactory")
    assert verdict == "pool"
    assert ask < MIN_VIABLE_GRANT


def test_ask_never_exceeds_the_earmarked_tier_ceiling():
    """City National was carrying a $75,000 ask anchored on $13.2M of
    institution-wide giving while its target assessment area received
    $142,000. Nothing may price off institution-wide giving again."""
    ask, _v, _d = size_ask(50_000_000, 3, "Needs to Improve", "Needs to Improve")
    assert ask == CEILING


def test_severity_orders_the_multiplier():
    low = gap_multiplier("Low Satisfactory", "")
    nti = gap_multiplier("Needs to Improve", "")
    sn = gap_multiplier("Substantial Noncompliance", "")
    assert low < nti < sn
    assert gap_multiplier("Low Satisfactory", "Low Satisfactory") > low


def test_a_lending_only_gap_earns_nothing():
    """A grant is a qualified investment and our outreach is a service. Neither
    moves the Lending Test, so a lending-only gap is not our pitch."""
    with pytest.raises(NoDocumentedGapError):
        gap_multiplier("Outstanding", "High Satisfactory")


def test_sizing_requires_giving_actually_read_from_a_pe():
    with pytest.raises(ValueError):
        size_ask(0, 3, "Low Satisfactory", "")
    with pytest.raises(ValueError):
        size_ask(None, 3, "Low Satisfactory", "")


def test_every_bank_records_how_its_ask_was_sized():
    """Either the formula sized it, or the record says why it could not."""
    banks, _a, _o = generate.load_inputs()
    for key, b in banks.items():
        assert b.get("ask_sizing"), f"{key}: no ask_sizing provenance"


def test_sized_banks_agree_with_the_formula():
    """The stored ask must be reproducible from the stored inputs -- otherwise
    a hand-edited number can drift away from its own stated basis."""
    banks, _a, _o = generate.load_inputs()
    for key, b in banks.items():
        if b.get("target_status") != "target" or "UNSIZED" in b.get("ask_sizing", ""):
            continue
        amt, yrs = b.get("aa_giving_usd"), b.get("review_period_years")
        assert amt and yrs, f"{key}: sized but missing aa_giving_usd/review_period_years"
        ask, _verdict, _d = size_ask(amt, yrs, b.get("inv_rating", ""), b.get("svc_rating", ""))
        assert ask == b["ask_usd"], f"{key}: stored {b['ask_usd']} != computed {ask}"


def test_sized_banks_store_their_ratings_as_data_not_only_prose():
    """component_ratings is a sentence for humans. The sizing inputs must exist
    as fields, or the ask cannot be recomputed when a PE is re-read."""
    banks, _a, _o = generate.load_inputs()
    for key, b in banks.items():
        if b.get("target_status") != "target" or "UNSIZED" in b.get("ask_sizing", ""):
            continue
        assert "inv_rating" in b and "svc_rating" in b, f"{key}: ratings not stored as fields"


def test_send_refuses_a_bank_with_no_gap_on_any_test_we_feed():
    """American Business Bank carried a $25,000 ask against three High
    Satisfactory ratings, and Bank Irvine -- this channel's original first
    target -- is a Small Bank whose only test is Lending, which no grant moves.
    Both must be unsendable rather than merely mis-sized."""
    from src import generate
    banks, _a, _o = generate.load_inputs()
    flagged = {k for k, b in banks.items() if b.get("target_status") == "no-target"}
    assert {"american_business_bank", "bank_irvine", "helm_bank", "mega_bank"} <= flagged
    for key in flagged:
        assert "NO TARGET" in banks[key].get("ask_sizing", ""), f"{key}: no stated reason"


def test_every_bank_declares_a_target_status():
    from src import generate
    banks, _a, _o = generate.load_inputs()
    for key, b in banks.items():
        assert b.get("target_status") in ("target", "no-target"), key
