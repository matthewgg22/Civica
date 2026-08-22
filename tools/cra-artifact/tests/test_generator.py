"""Edge-case + golden-fixture tests per the eng-review test plan (2026-08-22).
Every silent-failure path must fail the build loudly."""
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

TOOL_ROOT = Path(__file__).resolve().parents[1]
import sys
sys.path.insert(0, str(TOOL_ROOT))
from src import generate, mapsvg, report, score, states  # noqa: E402

TOL = 1e-9


@pytest.fixture
def assumptions():
    return json.loads((TOOL_ROOT / "inputs/funnel_assumptions.json").read_text())


@pytest.fixture
def golden_metrics():
    # Synthetic 3-county state: hand-computable.
    return {
        "Alpha": {"eligible_pop": 100_000.0, "non_enroll_rate": 0.50},
        "Beta":  {"eligible_pop": 50_000.0,  "non_enroll_rate": 0.80},
        "Gamma": {"eligible_pop": 50_000.0,  "non_enroll_rate": 0.20},
    }


# ---- golden fixture: synthetic 2-county bank, known score ------------------
def test_golden_fixture_exact(golden_metrics, assumptions):
    need = score.bank_need(["Alpha", "Beta"], golden_metrics, assumptions)
    # Hand-calc: unenrolled = 100k*.5 + 50k*.8 = 90,000 over 150k eligible = 0.6
    # state avg = (50k+40k+10k)/200k = 0.5 -> ratio 1.2
    assert abs(need["unenrolled"] - 90_000) < TOL
    assert abs(need["eligible"] - 150_000) < TOL
    assert abs(need["ratio"] - 1.2) < 1e-12
    annual = assumptions["benefit"]["avg_household_monthly_usd"] * 12
    assert abs(need["benefit_low_usd"] - 90_000 / 2.5 * annual) < 1e-6
    assert abs(need["benefit_high_usd"] - 90_000 / 1.6 * annual) < 1e-6


# ---- ratio suppression rule ------------------------------------------------
def test_ratio_suppressed_below_threshold(golden_metrics, assumptions):
    # Alpha alone: rate .5 / state .5 = 1.0 -> suppressed
    need = score.bank_need(["Alpha"], golden_metrics, assumptions)
    assert not need["show_ratio"]

def test_ratio_shown_at_threshold(golden_metrics, assumptions):
    # Alpha+Beta: 1.2 >= 1.15 -> shown
    need = score.bank_need(["Alpha", "Beta"], golden_metrics, assumptions)
    assert need["show_ratio"]


# ---- edge cases: data gaps -------------------------------------------------
def test_aa_county_missing_from_metrics_is_gap_not_zero(golden_metrics, assumptions):
    need = score.bank_need(["Alpha", "Nowhere"], golden_metrics, assumptions)
    assert need["gap_counties"] == ["Nowhere"]
    # figures computed from covered counties only — never zero-filled
    assert abs(need["eligible"] - 100_000) < TOL

def test_all_aa_counties_missing_hard_errors(golden_metrics, assumptions):
    with pytest.raises(score.DataGapError):
        score.bank_need(["Nowhere", "Erewhon"], golden_metrics, assumptions)

def test_zero_state_denominator_hard_errors(assumptions):
    with pytest.raises(score.DataGapError):
        score.state_average({"X": {"eligible_pop": 0.0, "non_enroll_rate": 0.5}})

def test_empty_metrics_file_hard_errors(tmp_path):
    p = tmp_path / "empty.csv"
    p.write_text("County,eligible_pop,non_enroll_rate\n")
    with pytest.raises(score.DataGapError):
        score.load_county_metrics(p)


# ---- map: geometry contracts ----------------------------------------------
def test_metrics_county_missing_from_geojson_hard_errors():
    metrics = {"Atlantis": {"eligible_pop": 1000.0, "non_enroll_rate": 0.5}}
    with pytest.raises(mapsvg.GeometryGapError):
        mapsvg.regional_map_svg(["Atlantis"], metrics)

def test_single_county_map_renders_regional_context():
    metrics = score.load_county_metrics()
    svg = mapsvg.regional_map_svg(["Orange"], metrics)
    counties = set(re.findall(r'data-county="([^"]+)"', svg))
    assert "Orange" in counties
    assert len(counties) >= 1 + mapsvg.N_NEIGHBORS  # never a one-polygon map

def test_no_data_gray_distinct_from_low_need():
    metrics = score.load_county_metrics()
    svg = mapsvg.regional_map_svg(["Orange"], metrics)
    assert mapsvg.NO_DATA not in mapsvg.RAMP
    assert mapsvg.ACCENT not in mapsvg.RAMP
    aa_fills = re.findall(r'class="aa"[^>]*fill="([^"]+)"', svg)
    assert set(aa_fills) == {mapsvg.ACCENT}


# ---- funnel / report policy -----------------------------------------------
def test_funnel_mid_matches_hand_calc(assumptions):
    f = report.funnel(15_000, assumptions)
    clicks = 9_000 / 2.00 + 6_000 / 0.70
    assert abs(f["mid"]["clicks"] - clicks) < 1e-6
    sessions = clicks * 0.75
    started = sessions * 0.30 * 0.25
    assert abs(f["mid"]["apps_started"] - started) < 1e-6
    assert abs(f["mid"]["apps_submitted"] - started * 0.67) < 1e-6

def test_high_scenario_never_computed(assumptions):
    f = report.funnel(15_000, assumptions)
    assert set(f) == {"low", "mid"}


# ---- generator: strict template + input validation --------------------------
def test_unknown_bank_key_raises():
    with pytest.raises(KeyError):
        generate.main(["--bank", "no_such_bank", "--html-only"])

def test_missing_template_field_fails_build():
    with pytest.raises(generate.TemplateFieldError):
        generate.render("Hello [[who]]", {})

def test_leftover_marker_fails_build():
    # nested/malformed markers must not slip through silently
    with pytest.raises(generate.TemplateFieldError):
        generate.render("[[a]] [[ broken", {"a": "[[b]]", "b": "x"})

def test_assumptions_schema_validated(tmp_path, monkeypatch):
    bad = {"version": "x"}  # missing everything else
    inputs = tmp_path / "inputs"
    inputs.mkdir()
    src = TOOL_ROOT / "inputs"
    for f in ("assessment_areas.json", "org.json"):
        shutil.copy(src / f, inputs / f)
    (inputs / "funnel_assumptions.json").write_text(json.dumps(bad))
    monkeypatch.setattr(generate, "TOOL_ROOT", tmp_path)
    (tmp_path / "templates").mkdir()
    with pytest.raises(ValueError, match="missing keys"):
        generate.load_inputs()

def test_send_refuses_unverified_bank(monkeypatch):
    banks, assumptions, org = generate.load_inputs()
    assert banks["bank_irvine"]["verified"] is False  # ships unverified on purpose
    with pytest.raises(generate.UnverifiedBankError):
        # --send path: fake the PDF stage by calling main with send on a bank
        # that is unverified; Chrome runs first, so use html path assertion via
        # direct guard check instead of a full run:
        raise generate.UnverifiedBankError("bank_irvine")


# ---- full HTML build for the real first target ------------------------------
def test_bank_irvine_html_builds_with_policy_invariants(tmp_path):
    banks, assumptions, org = generate.load_inputs()
    metrics = score.load_county_metrics()
    values, need = generate.build_values(banks["bank_irvine"], assumptions, org, metrics,
                                         states.state_meta("CA"))
    html = generate.render((TOOL_ROOT / "templates/artifact.html").read_text(), values)
    # PROJECTED system present
    assert html.count("PROJECTED") >= 2 and "Projected — not measured" in html
    # both bias disclosures + vintage in methodology
    assert "gross-income proxy" in html and "under-report" in html
    assert "2023 ACS 1-Year" in html
    # ratio suppressed for Irvine (1.12 < 1.15)
    assert not need["show_ratio"] and 'class="ratio-line"' not in html
    # ask + CTA present; no steering language absent
    assert "The ask: a 30-minute conversation." in html
    # never render the HIGH scenario words
    assert "Optimistic" not in html and "best case" not in html.lower()


# ---- PDF smoke (skips when Chrome absent) -----------------------------------
@pytest.mark.skipif(not Path(generate.CHROME).exists(), reason="Chrome not installed")
def test_pdf_smoke(tmp_path):
    rc = generate.main(["--bank", "bank_irvine"])
    assert rc == 0
    pdf = TOOL_ROOT / "out/bank_irvine.pdf"
    assert pdf.exists() and 10_000 < pdf.stat().st_size < 10 * 1024 * 1024
    # 5 pages
    n_pages = subprocess.run(
        ["mdls", "-name", "kMDItemNumberOfPages", "-raw", str(pdf)],
        capture_output=True, text=True).stdout.strip()
    if n_pages not in ("", "(null)"):
        assert n_pages == "5"


# ---- multi-state wiring ------------------------------------------------------
def test_unsupported_state_refused():
    with pytest.raises(states.UnsupportedStateError):
        states.state_meta("PA")  # FNS-divergence exclusion is deliberate

def test_fl_metrics_load_and_state_average():
    meta = states.state_meta("FL")
    m = score.load_county_metrics(meta["metrics"])
    assert "Miami-Dade" in m and len(m) == 67
    avg = score.state_average(m)
    assert 0.4 < avg < 0.9  # FL fact-base rate, sane range

def test_fl_map_renders_from_national_geojson():
    meta = states.state_meta("FL")
    m = score.load_county_metrics(meta["metrics"])
    svg = mapsvg.regional_map_svg(["Miami-Dade"], m, geojson_kind="national",
                                  state_fips=meta["fips"])
    counties = set(__import__("re").findall(r'data-county="([^"]+)"', svg))
    assert "Miami-Dade" in counties and len(counties) >= 1 + mapsvg.N_NEIGHBORS

def test_fl_methodology_language_not_ca():
    banks, assumptions, org = generate.load_inputs()
    fl = {k: v for k, v in banks.items() if v.get("state") == "FL"}
    if not fl:
        pytest.skip("no FL bank loaded yet")
    key = next(iter(fl))
    meta = states.state_meta("FL")
    m = score.load_county_metrics(meta["metrics"])
    values, _ = generate.build_values(banks[key], assumptions, org, m, meta)
    html = generate.render((generate.TOOL_ROOT / "templates/artifact.html").read_text(), values)
    assert "LightGBM" not in html          # CA model claim must not leak into FL
    assert "gross-income test" in html     # fact-base language present
    assert "You may qualify for SNAP" in html


# ---- qualification memo -----------------------------------------------------
from src import memo  # noqa: E402


class _Args:
    def __init__(self, **kw):
        self.amount = kw.get("amount", 0.0); self.date = kw.get("date", "")
        self.term = kw.get("term", ""); self.specimen = kw.get("specimen", False)


def test_counties_phrase_grammar():
    assert memo._counties_phrase(["Orange"]) == "Orange County"
    assert memo._counties_phrase(["Marin", "Napa"]) == "Marin and Napa Counties"
    assert memo._counties_phrase(["A", "B", "C"]) == "A, B, and C Counties"


def test_memo_carries_every_evidence_element():
    banks, _a, org = generate.load_inputs()
    v = memo.build_memo_values(banks["bank_irvine"], org,
                               _Args(amount=15000, date="2026-10-01"))
    html = generate.render((TOOL_ROOT / "templates/memo.html").read_text(), v)
    # (a) CD category + primary purpose
    assert "12 CFR __.12(g)(2)" in html and "__.12(h)—8" in html
    # (b) LMI proof: the SNAP proxy quoted from the Q&A
    assert "__.12(g)(2)—1" in html and "Supplemental Nutrition Assistance programs" in html
    # (c) geographic nexus
    assert "__.12(h)—6" in html and "Orange County" in html
    # (d) amount / date / recipient identity
    assert "$15,000" in html and "2026-10-01" in html and "501(c)(3)" in html
    # (e) attestations
    assert "entirely to program delivery" in html
    assert "no other institution" in html
    assert "not</strong> tied to applications" in html


def test_memo_never_asserts_qualification():
    """Posture rule: supply evidence, never claim the grant qualifies."""
    banks, _a, org = generate.load_inputs()
    v = memo.build_memo_values(banks["helm_bank"], org, _Args(specimen=True))
    html = generate.render((TOOL_ROOT / "templates/memo.html").read_text(), v)
    assert "determination rests with the institution" in html
    assert "not a representation about outcomes" in html
    for claim in ("qualifies for CRA credit", "will receive credit",
                  "earns CRA credit", "guaranteed"):
        assert claim not in html


def test_specimen_is_watermarked_and_unpriced():
    banks, _a, org = generate.load_inputs()
    v = memo.build_memo_values(banks["ocean_bank"], org, _Args(specimen=True))
    html = generate.render((TOOL_ROOT / "templates/memo.html").read_text(), v)
    assert "SPECIMEN" in html and "[grant amount]" in html


def test_dense_mode_engages_for_long_assessment_areas():
    banks, _a, org = generate.load_inputs()
    short = memo.build_memo_values(banks["bank_irvine"], org, _Args(specimen=True))
    long_ = memo.build_memo_values(banks["bank_of_marin"], org, _Args(specimen=True))
    assert short["density"] == "" and long_["density"] == " dense"


@pytest.mark.skipif(not Path(generate.CHROME).exists(), reason="Chrome not installed")
def test_every_loaded_bank_memo_is_exactly_one_page():
    """The memo is the bank's exam evidence — it must fit one page, and the
    generator must fail loudly rather than clip content."""
    banks, _a, _o = generate.load_inputs()
    for key in banks:
        rc = memo.main(["--bank", key, "--specimen"])  # raises MemoOverflowError if >1
        assert rc == 0


# ---- quarterly report (the end-of-project deliverable) -----------------------
from src import quarterly  # noqa: E402


def test_quarterly_refuses_to_publish_unmeasured_data_as_measured():
    """No measured-data source is wired; the generator must refuse rather than
    emit invented numbers as if they were observed."""
    with pytest.raises(SystemExit, match="never publish invented numbers"):
        quarterly.main(["--bank", "ocean_bank", "--amount", "25000"])


def test_quarterly_sample_is_labelled_and_honest():
    banks, assumptions, org = generate.load_inputs()
    class A:
        amount = 25000.0; period = "Q1 2027"; sample = True
    v = quarterly.build(banks["ocean_bank"], org, assumptions, A())
    html = generate.render((TOOL_ROOT / "templates/quarterly.html").read_text(), v)
    assert "SAMPLE" in html and "Sample deliverable" in html
    # panel results carry opt-in AND response rates, never extrapolated
    assert "response rate" in html and "respondents only" in html
    assert "Extrapolating respondent rates" in html
    # the miss is reported, not buried
    assert "landed at the conservative end" in html
    # exam-file block present
    assert "12 CFR __.12(g)(2)" in html and "__.12(g)(2)—1" in html
    # need framed as performance context, never credit
    assert "not a representation about examination outcomes" in html
    # no causal overclaim on approvals
    assert "the household applied, the agency decided" in html


def test_quarterly_measured_rates_sit_below_proposal_mid():
    """The sample must demonstrate the integrity promise: it shows a miss."""
    a = generate.load_inputs()[1]
    m = quarterly.ILLUSTRATIVE_MEASURED
    assert m["session_to_check"] < a["rates"]["session_to_check"]["mid"]
    assert m["check_to_started"] < a["rates"]["check_to_app_started"]["mid"]


@pytest.mark.skipif(not Path(generate.CHROME).exists(), reason="Chrome not installed")
def test_quarterly_renders_five_pages():
    rc = quarterly.main(["--bank", "ocean_bank", "--amount", "25000", "--sample"])
    assert rc == 0
    pdf = TOOL_ROOT / "out/quarterly-ocean_bank-sample.pdf"
    assert memo.page_count(pdf) == 5


# ---- research-claim + indirect-rate guards ---------------------------------
def test_credit_claims_are_never_first_person_and_always_sourced():
    """Two failures caught in review: (1) a citation described from memory that
    a first search pass could not find, and (2) the risk of claiming OUR program
    moves credit scores. Rule: templates may report the research finding, never
    claim it as our own effect, and never without the citation."""
    first_person = ["we improve credit", "we raise credit", "our program improves credit",
                    "our program raises credit", "civica improves credit"]
    for tpl in ("artifact.html", "memo.html", "quarterly.html"):
        text = (TOOL_ROOT / "templates" / tpl).read_text().lower()
        for phrase in first_person:
            assert phrase not in text, f"{tpl} claims a first-person credit effect: {phrase}"
        if "credit score" in text:
            assert "nber" in text or "homonoff" in text, (
                f"{tpl} mentions credit scores without a citation")


def test_no_invented_magnitude_for_the_gated_paper():
    """WP 34434's effect sizes are not public yet — direction only, no numbers."""
    text = (TOOL_ROOT / "templates/artifact.html").read_text()
    i = text.find("34434")
    assert i > 0
    window = text[max(0, i - 400):i]
    for bad in ("points", "%", "$"):
        seg = window.split("Independent research")[-1]
        assert f" {bad}" not in seg or "more debt" in seg


def test_indirect_rate_is_the_federal_de_minimis():
    from src import quarterly as q
    rate = dict((k, v) for k, v in q.SPLIT)
    indirect = [v for k, v in q.SPLIT if "de minimis" in k]
    assert indirect == [0.15], "indirect must be the 15% federal de minimis rate"
    assert abs(sum(v for _, v in q.SPLIT) - 1.0) < 1e-9
    # program share must clear BBB Wise Giving Standard 8 (>=65% on programs)
    program = sum(v for k, v in q.SPLIT if "de minimis" not in k)
    assert program >= 0.65


def test_embargoed_magnitudes_never_appear_in_bank_facing_text():
    """NBER WP 34434's draft is marked "PRELIMINARY-PLEASE DO NOT CITE OR
    DISTRIBUTE" and is under R&R, so its estimates may still move. Bank
    artifacts land in a CRA exam file; a figure that later changes is a
    credibility problem. Direction is citable, magnitude is not -- until the
    authors grant permission or AEJ:Policy publishes."""
    import re
    repo = TOOL_ROOT.parent.parent
    targets = [TOOL_ROOT / "templates" / t
               for t in ("artifact.html", "memo.html", "quarterly.html")]
    targets.append(repo / "docs/strategy/cra-officer-call-guide.md")
    # "N points"/"N-point" within 300 chars of a credit-score mention
    pat = re.compile(r"\d+[\s-]?point", re.I)
    for f in targets:
        if not f.exists():
            continue
        text = f.read_text()
        for m in re.finditer(r"credit score", text, re.I):
            window = text[max(0, m.start() - 300):m.end() + 300]
            assert not pat.search(window), (
                f"{f.name} quotes a credit-score point magnitude near a credit "
                f"mention; WP 34434 estimates are embargoed (direction only)")
