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


def test_a_wrong_scope_giving_figure_blocks_the_artifact():
    """A pitch that QUOTES a giving figure must not quote one at the wrong scope.

    The fixture was firstbank_tn until 2026-08-26. Its $126,000 is institution-
    wide, but it is a SERVICE PARTNERSHIP -- the ask is the floor and the pitch
    never cites a donations number -- so the scope caveat no longer blocks it.
    glacier_phoenix is the case that still bites: a PEER pitch leads with the
    bank's own disclosed figure, and Glacier's Phoenix area is limited-scope with
    no figure of its own.
    """
    import json
    import subprocess
    import sys
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    banks = json.loads((root / "inputs/assessment_areas.json").read_text())["banks"]
    assert banks["glacier_phoenix"].get("ask_scope_caveat"), "fixture lost its caveat"

    before = set((root / "out").glob("glacier_phoenix.*"))
    r = subprocess.run([sys.executable, "-m", "src.generate", "--bank", "glacier_phoenix"],
                       cwd=root, capture_output=True, text=True)
    assert r.returncode != 0, "a wrong-scope peer bank generated anyway"
    assert "wrong scope" in (r.stderr + r.stdout).lower()
    assert set((root / "out").glob("glacier_phoenix.*")) == before, \
        "refused bank still left a file behind"


def test_instrument_quote_is_preferred_over_a_needs_quote():
    bank = dict(INSTRUMENT, pe_need_quote="a needs narrative",
                pe_instrument_quote="credit is reflected at the institution level")
    block = archetype.rationale_block(bank)
    assert "institution level" in block
    assert "a needs narrative" not in block


def test_a_missing_service_rating_is_refused_not_treated_as_clean():
    """Ocean, Texas First and Western Alliance had EMPTY svc_rating and fell
    through to `peer` -- which would have sent them a letter praising giving we
    never verified, justified by a rating nobody read. An absent rating is not a
    clean rating."""
    with pytest.raises(archetype.ArchetypeError):
        archetype.resolve({"name": "No Rating", "aa_giving_usd": 900_000})
    with pytest.raises(archetype.ArchetypeError):
        archetype.resolve({"name": "Blank", "svc_rating": "  ",
                           "inv_rating": "Low Satisfactory", "aa_giving_usd": 900_000})
    # ...but an explicit archetype, which requires a human decision, still works.
    assert archetype.resolve({"name": "Plan bank", "aa_giving_usd": 900_000,
                              "pitch_archetype": "pooled"}) == "pooled"


def test_a_service_partnership_survives_a_wrong_scope_giving_figure():
    """The scope guard exists to stop a MIS-SIZED ask and a MIS-QUOTED figure.
    A service partnership does neither: its ask is the floor, and its pitch leads
    on the investment-versus-service mismatch rather than on a donations number.

    Prosperity, Glacier and FirstBank each disclose no per-assessment-area
    donations figure anywhere in their evaluations -- limited-scope areas get no
    breakout, and FirstBank's $126,000 is institution-wide. Blocking on scope
    alone would permanently bar real targets over a number that does not exist.
    """
    import json
    import subprocess
    import sys
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    banks = json.loads((root / "inputs/assessment_areas.json").read_text())["banks"]

    sp = banks["prosperity_houston"]
    assert sp.get("ask_scope_caveat"), "fixture lost its caveat"
    assert archetype.resolve(sp) == "service_partnership"
    r = subprocess.run([sys.executable, "-m", "src.generate", "--bank",
                        "prosperity_houston", "--html-only"],
                       cwd=root, capture_output=True, text=True)
    assert r.returncode == 0, f"service partnership wrongly refused:\n{r.stderr[-600:]}"

    # ...and the artifact must NOT cite the wrong-scope figure it carries.
    html = (root / "out/prosperity_houston.html").read_text()
    assert "3,489,000" not in html and "$3.489" not in html, \
        "a state-level giving figure leaked into an assessment-area pitch"

    # A PEER bank with a wrong-scope figure is still refused: its pitch quotes it.
    glacier = banks["glacier_phoenix"]
    assert archetype.resolve(glacier) == "peer"
    r2 = subprocess.run([sys.executable, "-m", "src.generate", "--bank", "glacier_phoenix"],
                        cwd=root, capture_output=True, text=True)
    assert r2.returncode != 0, "a peer pitch built on a wrong-scope figure"
    assert "wrong scope" in (r2.stdout + r2.stderr).lower()
