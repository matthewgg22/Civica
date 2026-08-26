"""Guards on which pitch a bank gets.

The failure these protect against is not a crash -- it is sending a bank the
wrong letter. Telling an Outstanding-rated institution that examiners have
flagged it is a factual error about a regulated entity, and it ends the
conversation.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src import archetype  # noqa: E402

CLEAN_HIGH = {"name": "Clean", "svc_rating": "High Satisfactory",
              "aa_giving_usd": 1_600_000, "pe_date": "2024-01-01"}
GAP_HIGH = {"name": "Gapped", "svc_rating": "Low Satisfactory",
            "aa_giving_usd": 511_526, "pe_date": "2024-01-01"}
INSTRUMENT = {"name": "Parkway", "svc_rating": "Low Satisfactory",
              "aa_giving_usd": 7_000, "pe_investment_usd": 27_100_000,
              "pe_date": "2024-01-01"}
SMALL = {"name": "Small", "svc_rating": "Low Satisfactory",
         "aa_giving_usd": 65_000, "pe_date": "2024-01-01"}


def test_each_axis_resolves_to_its_archetype():
    assert archetype.resolve(CLEAN_HIGH) == "peer"
    assert archetype.resolve(GAP_HIGH) == "remediation"
    assert archetype.resolve(INSTRUMENT) == "service_partnership"
    assert archetype.resolve(SMALL) == "pooled"


def test_instrument_heavy_outranks_low_grant_capacity():
    """Parkway's $7,000 of grants must not route it to a $500 pooled ask.

    Its capacity is the $27.1M of investments; the grant figure is low BECAUSE
    it does not write grants, which is the finding, not the budget.
    """
    assert archetype.capacity_band(INSTRUMENT) == "low"
    assert archetype.resolve(INSTRUMENT) == "service_partnership"


def test_investment_rating_is_never_a_targeting_signal():
    """An Investment gap alone must not produce a remediation pitch.

    A bank can satisfy the Investment Test with bonds while writing no grants,
    so the rating does not predict grant propensity. Only the Service Test does
    work here.
    """
    inv_gap_only = dict(CLEAN_HIGH, inv_rating="Low Satisfactory")
    assert archetype.resolve(inv_gap_only) == "peer"


def test_clean_bank_is_never_told_it_has_a_finding():
    block = archetype.rationale_block(CLEAN_HIGH)
    low = block.lower()
    for forbidden in ("examiner attention", "gap this program addresses",
                      "needs to improve", "deficien", "fix"):
        assert forbidden not in low, f"remediation language leaked to a clean bank: {forbidden}"
    assert "already" in low


def test_peer_block_cites_their_own_disclosed_giving():
    assert "$1,600,000" in archetype.rationale_block(CLEAN_HIGH)


def test_pe_quote_never_appears_in_a_peer_pitch():
    """A quote pulled from a needs narrative reads as an accusation when the
    institution has no service finding."""
    withquote = dict(CLEAN_HIGH, pe_need_quote="some identified need")
    assert "some identified need" not in archetype.rationale_block(withquote)
    gapped = dict(GAP_HIGH, pe_need_quote="some identified need")
    assert "some identified need" in archetype.rationale_block(gapped)


def test_instrument_heavy_requires_both_figures_not_a_rating():
    assert not archetype.is_instrument_heavy({"svc_rating": "Low Satisfactory"})
    assert not archetype.is_instrument_heavy({"aa_giving_usd": 7_000})
    assert archetype.is_instrument_heavy({"aa_giving_usd": 7_000,
                                          "pe_investment_usd": 27_100_000})


def test_explicit_override_wins_but_must_be_valid():
    assert archetype.resolve(dict(CLEAN_HIGH, pitch_archetype="pooled")) == "pooled"
    with pytest.raises(archetype.ArchetypeError):
        archetype.resolve(dict(CLEAN_HIGH, pitch_archetype="grovel"))


def test_every_archetype_has_a_headline_and_a_block():
    for kind in sorted(archetype.VALID):
        bank = dict(CLEAN_HIGH, pitch_archetype=kind)
        assert archetype.headline(bank)
        assert archetype.rationale_block(bank).startswith('<div class="body-block">')


def test_no_archetype_asserts_a_rating_will_change():
    for kind in sorted(archetype.VALID):
        block = archetype.rationale_block(dict(GAP_HIGH, pitch_archetype=kind)).lower()
        for forbidden in ("will improve", "will raise", "guarantee",
                          "ensures a", "upgrade your rating"):
            assert forbidden not in block
