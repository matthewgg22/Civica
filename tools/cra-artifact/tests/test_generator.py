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
from src import access_evidence, generate, mapsvg, report, score, states  # noqa: E402

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
    """Exercises the ACTUAL refusal path.

    The previous version of this test asserted bank_irvine was unverified and
    then raised UnverifiedBankError itself inside pytest.raises -- a tautology
    that never touched the guard. It only broke when the last unverified bank
    was verified, revealing it had been testing nothing. A guard test must not
    depend on real data happening to be in the failing state."""
    banks, assumptions, org = generate.load_inputs()
    fake = dict(banks["bank_irvine"]); fake["verified"] = False
    patched = dict(banks); patched["__unverified_fixture__"] = fake
    monkeypatch.setattr(generate, "load_inputs",
                        lambda: (patched, assumptions, org))
    with pytest.raises(generate.UnverifiedBankError):
        generate.main(["--bank", "__unverified_fixture__", "--send"])


def test_every_shipped_bank_is_verified():
    """The counterpart: nothing in the real inputs may ship unverified."""
    banks, _a, _o = generate.load_inputs()
    unverified = [k for k, v in banks.items() if not v.get("verified")]
    assert unverified == [], f"unverified banks present: {unverified}"


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
    # closing next-step + contact present (quiet close, not a "the ask" box)
    assert "30-minute call" in html and org["contact_email"] in html
    # CA banks render the sub-county PUMA choropleth (replaces the county bars)
    assert "data-puma" in html and "Eligible but not enrolled" in html
    assert "Census PUMA" in html and 'class="geo-ticks"' in html
    # every core-table number carries a clarifying sub-line (formatting parity)
    for sub in ("income-eligible for SNAP", "of those eligible",
                "in federal SNAP funds", "per eligible household"):
        assert sub in html
    # never render the HIGH scenario words
    assert "Optimistic" not in html and "best case" not in html.lower()
    # credibility line present, with the CA-only substantiation (trained model +
    # the CDSS ME review that only exists for California banks)
    assert "Why Civica" in html and "Management Evaluation" in html
    # no fabricated traction: the doc never claims a delivered-user count
    assert "300 people" not in html


# ---- PDF smoke (skips when Chrome absent) -----------------------------------
@pytest.mark.skipif(not Path(generate.CHROME).exists(), reason="Chrome not installed")
def test_pdf_smoke(tmp_path):
    rc = generate.main(["--bank", "bank_irvine"])
    assert rc == 0
    pdf = TOOL_ROOT / "out/bank_irvine.pdf"
    assert pdf.exists() and 10_000 < pdf.stat().st_size < 10 * 1024 * 1024
    # 3 pages: 2-page pitch + 1 detachable appendix (PROJECTED sample + methodology)
    n_pages = subprocess.run(
        ["mdls", "-name", "kMDItemNumberOfPages", "-raw", str(pdf)],
        capture_output=True, text=True).stdout.strip()
    if n_pages not in ("", "(null)"):
        assert n_pages == "3"


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
    # CalFresh is California's SNAP brand; it must never appear in a non-CA
    # artifact. Regressed once: the page-1 ask line and the page-2 crafile
    # "Activity" row both hardcoded "CalFresh" instead of [[program_ref]].
    assert "CalFresh" not in html
    # Credibility line is present but state-correct: no CA-only claims leak in.
    # FL is a direct survey-weighted estimate — no trained model (AUC) and no
    # CDSS Management Evaluation review exists outside California.
    assert "Why Civica" in html
    assert "Management Evaluation" not in html
    assert "AUC" not in html


# ---- sub-county PUMA choropleth ---------------------------------------------
from src import pumamap  # noqa: E402


def test_pumamap_supported_states_render_and_others_fall_back():
    # geometry + need data wired for CA and FL; not for other states
    assert pumamap.available("CA") and pumamap.available("FL")
    assert not pumamap.available("TX")
    # a CA AA resolves many PUMAs and shades them
    svg = pumamap.regional_puma_svg(["Los Angeles", "Orange"], "CA")
    assert svg.count("<polygon") > 30 and "data-puma" in svg
    # the full right-column block carries the honest PUMA/not-tracts labels
    html = pumamap.puma_visual_html(["Miami-Dade"], "FL", "survey-weighted fact base")
    assert "PUMA" in html and "Census PUMA" in html
    # unsupported state -> empty, so generate.py uses the county-bar fallback
    assert pumamap.puma_visual_html(["Harris"], "TX", "x") == ""


def test_pumamap_need_join_is_complete():
    """Every PUMA in the need CSV must join to geometry (vintage alignment)."""
    for state in ("CA", "FL"):
        need = set(pumamap.load_puma_need(state))
        import json
        geo = {f["properties"]["puma"]
               for f in json.loads(pumamap.STATES[state][1].read_text())["features"]}
        assert need and need <= geo, f"{state}: {len(need - geo)} PUMAs missing geometry"


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
    # (a) CD category + primary purpose. The CD category cites the bank's own
    # CFR part (bank_irvine is FDIC -> 12 CFR 345); the Q&A citations stay in the
    # harmonized "§__" form the Interagency Q&A itself uses.
    assert "12 CFR 345.12(g)(2)" in html and "__.12(h)—8" in html
    # (b) LMI proof: the SNAP proxy quoted from the Q&A
    assert "__.12(g)(2)—1" in html and "Supplemental Nutrition Assistance programs" in html
    # (c) geographic nexus
    assert "__.12(h)—6" in html and "Orange" in html
    # (d) amount / date / recipient identity
    assert "$15,000" in html and "2026-10-01" in html and "501(c)(3)" in html
    # (e) attestations
    assert "entirely to program delivery" in html
    assert "no other institution" in html
    assert "not</strong> tied to applications" in html


def test_cra_citation_is_regulator_specific():
    """The CD citation names the bank's OWN CFR part — FDIC -> 12 CFR 345,
    OCC -> 12 CFR 25 — in both the pager and the memo, and the pager marks the
    activity as community development, not a lending-test item."""
    banks, assumptions, org = generate.load_inputs()
    metrics = score.load_county_metrics()
    pager = (TOOL_ROOT / "templates/artifact.html").read_text()
    memo_tmpl = (TOOL_ROOT / "templates/memo.html").read_text()
    # FDIC bank (bank_irvine): Part 345, plus the not-a-lending-test clause.
    fdic = generate.build_values(banks["bank_irvine"], assumptions, org, metrics,
                                 states.state_meta("CA"))[0]
    fdic_pager = generate.render(pager, fdic)
    assert "12 CFR Part 345 (FDIC)" in fdic_pager
    assert "not on the lending test" in fdic_pager
    # OCC bank (city_national): Part 25 in the pager and 25.12(g)(2) in the memo.
    occ = generate.build_values(banks["city_national"], assumptions, org, metrics,
                                states.state_meta("CA"))[0]
    assert "12 CFR Part 25 (OCC)" in generate.render(pager, occ)
    occ_memo = generate.render(
        memo_tmpl, memo.build_memo_values(banks["city_national"], org, _Args(specimen=True)))
    assert "12 CFR 25.12(g)(2)" in occ_memo


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


def test_dense_mode_engages_on_total_content_not_the_county_line():
    """The trigger measures ALL variable-length content. The old rule read
    `len(counties) > 24` where `counties` is a string -- string length dressed
    up as a county count. Ocean Bank exposed it: shortest county line in the
    set ("Miami-Dade County") but the longest PE quote, so it never went dense
    and overflowed to two pages."""
    banks, _a, org = generate.load_inputs()
    short = memo.build_memo_values(banks["bank_irvine"], org, _Args(specimen=True))
    assert short["density"] == ""
    ocean = memo.build_memo_values(banks["ocean_bank"], org, _Args(specimen=True))
    assert len(ocean["counties_line"]) < 24          # would have failed the old rule
    assert ocean["density"] == " dense"              # but its total content needs it


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
def test_quarterly_renders_seven_pages():
    """Seven: page 5 is the research-implied tier, page 6 maps performance onto
    examination criteria, page 7 carries methodology. Pages grew rather than
    tightened because .page is overflow:hidden -- a too-long page loses content
    silently instead of failing."""
    rc = quarterly.main(["--bank", "ocean_bank", "--amount", "25000", "--sample"])
    assert rc == 0
    pdf = TOOL_ROOT / "out/quarterly-ocean_bank-sample.pdf"
    assert memo.page_count(pdf) == 7


def test_research_implied_tier_is_never_presented_as_measured():
    """The deliverable applies WP 34434 effect sizes to households we served.
    That is defensible ONLY while it is unmistakably a third tier, separate
    from observed counts and from panel estimates. Strip the disclaimers and
    it becomes a claim that we measured credit outcomes, which we cannot."""
    tpl = (TOOL_ROOT / "templates/quarterly.html").read_text()
    i = tpl.index("Research-implied financial outcomes")
    j = tpl.index("Page 6 of 7")          # section runs to the end of its page
    section = " ".join(tpl[i:j].split()).lower()   # normalise HTML wrapping
    assert "not a measurement" in section
    assert "upper bound" in section
    assert "we do not observe credit outcomes" in section
    assert "preliminary" in section and "subject to revision" in section
    # the marginal-household mismatch is the load-bearing caveat
    assert "marginal" in section
    assert "would have enrolled without us" in section


def test_research_implied_totals_scale_from_approved_households():
    """The applied column must derive from the households we actually served,
    not from a headline the reader cannot audit."""
    banks, assumptions, org = generate.load_inputs()

    class A:
        amount, period, sample = 25000, "Q1 2027", True
    v = quarterly.build(banks["ocean_bank"], org, assumptions, A())
    approved = float(v["approved"].replace(",", ""))   # displayed, rounded
    savings = float(v["ri_savings_total"].replace("$", "").replace(",", ""))
    # within one household of the displayed count -- the totals carry full
    # precision internally while the count is rendered rounded
    per = quarterly.WP34434["borrower_savings_usd"]
    assert abs(savings - approved * per) < per
    delinq = float(v["ri_delinq_households"].replace(",", ""))
    assert abs(delinq - approved * quarterly.WP34434["delinquency_pp"]) < 1.0


# ---- research-claim + indirect-rate guards ---------------------------------
def test_credit_claims_are_never_first_person_and_always_sourced():
    """Two failures caught in review: (1) a citation described from memory that
    a first search pass could not find, and (2) the risk of claiming OUR program
    moves credit scores. Rule: templates may report the research finding, never
    claim it as our own effect, and never without the citation."""
    first_person = ["we improve credit", "we raise credit", "our program improves credit",
                    "our program raises credit", "civica improves credit"]
    for tpl in ("artifact.html", "memo.html", "quarterly.html", "lender.html"):
        text = (TOOL_ROOT / "templates" / tpl).read_text().lower()
        for phrase in first_person:
            assert phrase not in text, f"{tpl} claims a first-person credit effect: {phrase}"
        if "credit score" in text:
            assert "nber" in text or "homonoff" in text, (
                f"{tpl} mentions credit scores without a citation")


def test_indirect_rate_is_the_federal_de_minimis():
    from src import quarterly as q
    rate = dict((k, v) for k, v in q.SPLIT)
    indirect = [v for k, v in q.SPLIT if "de minimis" in k]
    assert indirect == [0.15], "indirect must be the 15% federal de minimis rate"
    assert abs(sum(v for _, v in q.SPLIT) - 1.0) < 1e-9
    # program share must clear BBB Wise Giving Standard 8 (>=65% on programs)
    program = sum(v for k, v in q.SPLIT if "de minimis" not in k)
    assert program >= 0.65


def test_wp34434_numbers_always_carry_the_preliminary_version_stamp():
    """WP 34434 is cited from a PRELIMINARY draft under R&R, against the
    draft's own "do not cite" notice. That is defensible ONLY because every
    use is version-stamped: a reader opening a CRA exam file years later must
    see which draft we relied on and that a published version supersedes it.
    Drop the stamp and the citation posture collapses."""
    repo = TOOL_ROOT.parent.parent
    targets = [TOOL_ROOT / "templates" / t
               for t in ("artifact.html", "memo.html", "quarterly.html", "lender.html")]
    targets.append(repo / "docs/strategy/cra-officer-call-guide.md")
    for f in targets:
        if not f.exists():
            continue
        text = f.read_text()
        if "34434" not in text:
            continue
        low = text.lower()
        assert "preliminary" in low, (
            f"{f.name} cites WP 34434 without the word 'preliminary'")
        assert "november 2025" in low, (
            f"{f.name} cites WP 34434 without the draft date")
        assert "subject to revision" in low, (
            f"{f.name} cites WP 34434 without 'estimates subject to revision'")


def test_wp34434_precision_caveat_travels_with_the_credit_score_figure():
    """The credit-score results are the paper's weakest -- marginally
    significant in SF, significant only in the final quarter in LA. Anywhere
    we print the 17-point figure we also say the debt/delinquency effects are
    the stronger ones, so no reader takes the softest number as the firmest."""
    for f in [TOOL_ROOT / "templates/artifact.html"]:
        text = f.read_text()
        if "17 points" in text or "17</strong> points" in text:
            low = text.lower()
            assert "least precisely estimated" in low or "weakest" in low, (
                f"{f.name} prints the credit-score effect without its "
                f"precision caveat")


def test_no_aggregated_credit_savings_claim():
    """The authors' '$100 per year' is a PER-BORROWER figure from their own
    arithmetic. Multiplying it by our projected enrollments would manufacture
    exactly the invented aggregate this channel has refused since day one."""
    import re
    for tpl in ("artifact.html", "memo.html", "quarterly.html", "lender.html"):
        text = (TOOL_ROOT / "templates" / tpl).read_text().lower()
        for m in re.finditer(r"\$100", text):
            window = text[m.start():m.start() + 200]
            for bad in ("per household across", "total savings", "aggregate"):
                assert bad not in window, (
                    f"{tpl} aggregates the per-borrower savings figure")


def test_examination_criteria_page_never_predicts_an_outcome():
    """The criterion mapping describes what the activity provided. Claiming it
    earns a rating -- or that any examiner will weigh it a given way -- is the
    one thing that would make the document a liability in the file it goes in."""
    tpl = (TOOL_ROOT / "templates/quarterly.html").read_text()
    i = tpl.index("Performance in examination terms")
    j = tpl.index("Page 7 of 7")
    section = " ".join(tpl[i:j].split()).lower()
    banned = ["will qualify", "guarantees", "ensures a", "will be rated",
              "counts toward your rating", "satisfies the test"]
    for phrase in banned:
        assert phrase not in section, f"criterion page predicts an outcome: {phrase}"
    # the disclaimer itself must survive edits
    assert "not a representation about how any examiner will weigh it" in section
    # innovativeness must stay hedged -- it is not a factor for every institution
    assert "not required of every institution" in section


def test_shortfall_stays_on_the_criteria_page():
    """Reporting the miss beside the criteria is the integrity claim the whole
    deliverable rests on. It must not drift off into an appendix."""
    tpl = (TOOL_ROOT / "templates/quarterly.html").read_text()
    i = tpl.index("Performance in examination terms")
    j = tpl.index("Page 7 of 7")
    section = tpl[i:j]
    assert "[[s2c_measured]]" in section and "[[proj_low_sub]]" in section
    assert "fell short" in section.lower()


# ---- lender artifact (state CRA, not federal) --------------------------------
from src import lender  # noqa: E402


def test_lender_refuses_a_state_with_no_fact_base():
    """A covered state we cannot source a need figure for must fail loudly,
    never silently drop out of the table or print a guessed number."""
    _, _, org = generate.load_inputs()
    fake = {"name": "Test Lender", "originations": {"MA": 100, "ZZ": 500}}
    with pytest.raises(lender.UnsupportedLenderStateError):
        lender.build_values(fake, org)


def test_lender_send_refuses_until_coverage_is_verified():
    """HMDA proves volume, not coverage. Only the state licensee register
    proves a lender is subject to the statute we are citing at them."""
    with pytest.raises(lender.UnverifiedLenderError):
        lender.main(["--lender", "total_mortgage", "--send"])


def test_multi_state_ask_scales_but_stays_inside_disclosed_giving():
    """Multi-state programs price higher because the value spans separate
    obligations -- but the single-state base stays anchored to what these
    lenders actually give (MA PEs: $1,600-$18,250 for a whole review period)."""
    one = lender.ask_for(6000, 1)
    three = lender.ask_for(6000, 3)
    assert three == int(one * 2.5)
    assert lender.ask_for(100, 1) == 2500      # no giving history -> small
    assert one <= 15000                        # single-state never exceeds the ladder


def test_lender_artifact_states_the_no_lead_generation_line():
    """The bright line is load-bearing for qualification, not just ethics: an
    activity that generates the funder's customers has no community
    development primary purpose. It must survive template edits."""
    t = " ".join((TOOL_ROOT / "templates/lender.html").read_text().split()).lower()
    assert "no lead generation" in t
    assert "will not route participants to you" in t
    assert "not an activity whose primary purpose is community development" in t
    assert "compliance or community budget" in t


def test_lender_artifact_never_promises_an_examination_outcome():
    t = " ".join((TOOL_ROOT / "templates/lender.html").read_text().split()).lower()
    assert "no agency pre-certifies" in t
    for bad in ("will qualify", "guarantees", "will be rated", "ensures a"):
        assert bad not in t


def test_lender_artifact_renders_three_pages_unclipped():
    """.page is overflow:hidden, so a too-long page loses content silently
    while still reporting the right page count -- check the final element."""
    rc = lender.main(["--lender", "guaranteed_rate"])
    assert rc == 0
    pdf = TOOL_ROOT / "out/lender-guaranteed_rate.pdf"
    assert memo.page_count(pdf) == 3
    import subprocess
    tail = subprocess.run(["pdftotext", "-layout", "-f", "3", "-l", "3", str(pdf), "-"],
                          capture_output=True, text=True).stdout
    assert "Prepared" in tail and "Guaranteed Rate" in tail


def test_every_bank_ask_is_anchored_to_disclosed_giving_in_its_target_aa():
    """Per-AA re-baseline. Giving varies by orders of magnitude BETWEEN
    assessment areas of the same bank -- Hanmi runs $281,080 in Los Angeles
    against $13,000 in Houston, and Woodforest $17.8M in Houston against
    $86,614 in Dallas. An institution-wide average misprices both ends, so
    every ask must record which AA's giving it is anchored on."""
    banks, _, _ = generate.load_inputs()
    for name, b in banks.items():
        assert b.get("pe_giving"), f"{name}: no disclosed giving recorded"
        assert "assessment area" in b.get("ask_basis", ""), (
            f"{name}: ask_basis must state the anchor is the target AA")


def test_the_per_aa_rule_can_raise_an_ask_not_only_lower_it():
    """Guards against reading the correction as 'always ask for less'. Hanmi's
    prior $15,000 sat below their average Los Angeles donation of $20,077."""
    banks, _, _ = generate.load_inputs()
    h = banks["hanmi_bank"]
    assert h["ask_usd"] > h["ask_usd_prior"]
    assert "281,080" in h["pe_giving"]


# ---- pro rata attribution for pooled county programs -------------------------
class _PA:
    period, sample, html_only = "Q1 2027", True, False
    def __init__(self, amount, total=None, funders=None):
        self.amount, self.pool_total, self.pool_funders = amount, total, funders


def test_pooled_figures_are_exactly_the_funders_share():
    """Two banks in one county must never be handed the same household. Every
    claimed figure is cut to the contribution share."""
    banks, assumptions, org = generate.load_inputs()
    solo = quarterly.build(banks["ocean_bank"], org, assumptions, _PA(15000))
    third = quarterly.build(banks["ocean_bank"], org, assumptions, _PA(5000, 15000, 3))
    s = float(solo["submitted"].replace(",", ""))
    t = float(third["submitted"].replace(",", ""))
    assert abs(t - s / 3) < 1.5, f"pooled {t} is not one third of {s}"


def test_no_double_scaling_regression():
    """The share was briefly applied twice -- once by computing the funnel on
    the bank's own dollars and again by multiplying by the share -- which
    understated a 33% funder by 3x. A pool of one must equal a solo grant."""
    banks, assumptions, org = generate.load_inputs()
    solo = quarterly.build(banks["ocean_bank"], org, assumptions, _PA(15000))
    whole = quarterly.build(banks["ocean_bank"], org, assumptions, _PA(15000, 15000, 1))
    assert solo["submitted"] == whole["submitted"]
    assert solo["approved"] == whole["approved"]


def test_pool_disclosure_is_present_when_pooled_and_absent_when_solo():
    banks, assumptions, org = generate.load_inputs()
    assert quarterly.build(banks["ocean_bank"], org, assumptions, _PA(25000))["pool_block"] == ""
    blk = quarterly.build(banks["ocean_bank"], org, assumptions, _PA(5000, 15000, 3))["pool_block"]
    assert "pooled county program" in blk and "33%" in blk


def test_pool_disclosure_cites_the_rule_and_states_its_limit():
    """Citing 345.22(d) as if it governed grants would be an overstatement --
    it addresses community development LOANS under the lending test. The
    report must carry that limit, not just the citation."""
    banks, assumptions, org = generate.load_inputs()
    blk = quarterly.build(banks["ocean_bank"], org, assumptions, _PA(5000, 15000, 3))["pool_block"]
    assert "345.22(d)" in blk
    assert "percentage share" in blk
    assert "loans" in blk.lower() and "qualified investment rather than a loan" in blk


def test_pool_share_must_be_stateable():
    banks, assumptions, org = generate.load_inputs()
    with pytest.raises(quarterly.PoolShareError):
        quarterly.build(banks["ocean_bank"], org, assumptions, _PA(20000, 15000, 2))


def test_cofunders_are_never_named_without_written_consent():
    """A bank's CD grants are not in its public CRA file, so participation is
    not public information. Naming a participant to its competitor would
    publish what the regulatory system does not -- and since shares are
    printed, naming also lets a reader derive the others' contributions."""
    banks, _, _ = generate.load_inputs()
    for name, b in banks.items():
        assert b.get("cofunder_naming_consent") is not True, (
            f"{name}: consent is set to True — it must only be set after the "
            f"institution consents in writing")
    pool = {"share": .33, "total": 15000, "members":
            ["ocean_bank", "helm_bank", "banco_do_brasil_americas"], "cofunders": 2}
    phrase = quarterly.cofunder_phrase(pool, "ocean_bank", banks)
    for b in banks.values():
        assert b["name"] not in phrase
    assert "consented to be named" in phrase


def test_consent_names_only_the_consenting_and_counts_the_rest():
    banks, _, _ = generate.load_inputs()
    banks = {k: dict(v) for k, v in banks.items()}
    banks["helm_bank"]["cofunder_naming_consent"] = True
    pool = {"share": .33, "total": 15000, "members":
            ["ocean_bank", "helm_bank", "banco_do_brasil_americas"], "cofunders": 2}
    phrase = quarterly.cofunder_phrase(pool, "ocean_bank", banks)
    assert "Helm Bank USA" in phrase
    assert banks["banco_do_brasil_americas"]["name"] not in phrase
    assert "1 further institution" in phrase


def test_the_receiving_bank_is_never_its_own_cofunder():
    banks, _, _ = generate.load_inputs()
    banks = {k: dict(v) for k, v in banks.items()}
    for k in banks:
        banks[k]["cofunder_naming_consent"] = True
    pool = {"share": .5, "total": 10000, "members": ["ocean_bank", "helm_bank"], "cofunders": 1}
    assert banks["ocean_bank"]["name"] not in quarterly.cofunder_phrase(pool, "ocean_bank", banks)


def test_consent_must_be_exactly_true_not_merely_truthy():
    """'pending', 'verbal', 1 must not be read as consent."""
    banks, _, _ = generate.load_inputs()
    banks = {k: dict(v) for k, v in banks.items()}
    for bad in ("pending", "verbal", 1, "yes"):
        banks["helm_bank"]["cofunder_naming_consent"] = bad
        pool = {"share": .5, "total": 10000, "members": ["ocean_bank", "helm_bank"], "cofunders": 1}
        assert "Helm" not in quarterly.cofunder_phrase(pool, "ocean_bank", banks), bad


def test_pooled_report_offers_examiner_verification():
    """The examiner's need is confidence in the share, not names. Meet it
    directly so confidentiality never costs auditability."""
    banks, assumptions, org = generate.load_inputs()
    blk = quarterly.build(banks["ocean_bank"], org, assumptions, _PA(5000, 15000, 3))["pool_block"]
    assert "Verification without disclosure" in blk
    assert "directly to them on request" in blk


def test_verified_banks_carry_the_pe_sentence_that_verifies_them():
    """verified:true asserts someone read the assessment-area delineation out
    of the PE. The evidence must travel with the claim, so the next person can
    check the reading instead of trusting it -- Hanmi's record merged four
    separate California assessment areas into one before this was enforced."""
    banks, _, _ = generate.load_inputs()
    for name, b in banks.items():
        if not b.get("verified"):
            continue
        note = b.get("verify_note", "")
        assert len(note) > 120, f"{name}: verified but verify_note is not an evidence trail"
        assert "'" in note or '"' in note or "\u2018" in note, (
            f"{name}: verified but verify_note quotes no PE language")
        assert any(w in note.lower() for w in ("assessment area", "delineat")), (
            f"{name}: verify_note does not reference the AA delineation")


def test_hanmi_targets_one_assessment_area_not_four():
    """Regression: Hanmi delineates NINE assessment areas, four in California,
    evaluated separately. The record previously listed Los Angeles, Orange,
    San Diego, San Francisco and Santa Clara as one AA -- which would have
    overstated the area to the bank and mismatched the $281,080 giving figure,
    which is the Los Angeles AA alone."""
    banks, _, _ = generate.load_inputs()
    h = banks["hanmi_bank"]
    assert h["aa_counties"] == ["Los Angeles", "Orange"]
    for wrong in ("San Diego", "San Francisco", "Santa Clara"):
        assert wrong not in h["aa_counties"]


def test_no_bank_merges_separately_evaluated_assessment_areas():
    """The 2026-08-22 adversarial pass found FIVE of eight banks merging AAs
    that their examiners evaluate separately. Merging overstates the area to
    the bank, aggregates need across areas scored apart, and mismatches the
    per-AA giving the ask is anchored on. Where a bank has multiple AAs, the
    record must target ONE and say so."""
    banks, _, _ = generate.load_inputs()
    known_multi = {"five_star_bank", "ocean_bank", "banco_do_brasil_americas",
                   "helm_bank", "hanmi_bank"}
    for name in known_multi:
        b = banks[name]
        assert b.get("aa_counties_prior"), f"{name}: correction not recorded"
        assert len(b["aa_counties"]) < len(b["aa_counties_prior"]), (
            f"{name}: aa_counties was not narrowed to a single assessment area")
        assert b.get("verified") is not True or "CORRECTED" in b.get("verify_note", ""), (
            f"{name}: verified without recording the correction")


def test_ocean_bank_does_not_claim_orange_county():
    """Ocean's PE tables exactly two AAs -- Miami MD (Miami-Dade) and Fort
    Lauderdale MD (Broward). Orange County was in our record and appears in
    neither. A county the bank does not serve is the fastest way to lose a
    CRA officer's confidence."""
    banks, _, _ = generate.load_inputs()
    assert "Orange" not in banks["ocean_bank"]["aa_counties"]
    assert banks["ocean_bank"]["aa_counties"] == ["Miami-Dade"]


# ---- Page-1 documented-access callout (issue #1129) ------------------------
# Presentation-only evidence: verbatim, silent-when-absent, and never math.

def _evidence():
    return access_evidence.load()


def test_access_evidence_every_entry_is_verified_and_complete():
    for county, e in _evidence().items():
        assert e.get("verified") is True, f"{county} not verified"
        for k in ("ffy", "sev", "quote", "source"):
            assert e.get(k), f"{county} missing {k}"


def test_access_evidence_silent_for_non_ca_state():
    # A Florida bank's AA counties must render nothing (production is CA-only).
    assert access_evidence.evidence_html(
        ["Miami-Dade", "Broward", "Palm Beach"], state="FL") == ""


def test_access_evidence_silent_for_uncovered_county():
    # A county with no entry renders nothing — never a fabricated barrier.
    assert access_evidence.evidence_html(["Nowhere", "Erewhon"], state="CA") == ""


def test_access_evidence_is_quote_verbatim():
    e = _evidence()["San Bernardino"]
    html = access_evidence.evidence_html(["San Bernardino"], state="CA")
    assert e["quote"] in html          # rendered verbatim, not paraphrased
    assert e["source"] in html         # source always shown
    assert "San Bernardino County" in html


def test_access_evidence_caps_and_orders_by_severity():
    # Dense AA: at most MAX_ENTRIES, strongest (lowest sev) first.
    aa = ["Los Angeles", "Orange", "San Bernardino", "Riverside"]
    hits = access_evidence.select(aa, state="CA")
    assert len(hits) <= access_evidence.MAX_ENTRIES
    assert hits[0][0] == "San Bernardino"           # sev 1 wins
    assert [c for c, _ in hits] == sorted(
        [c for c, _ in hits], key=lambda c: (_evidence()[c]["sev"], c))


def test_access_evidence_never_returns_a_number():
    # The module is presentation-only; its output is a string or ''.
    out = access_evidence.evidence_html(["Sacramento"], state="CA")
    assert isinstance(out, str) and "does not provide appropriate access" in out


def test_access_callout_does_not_perturb_need_math():
    # build_values must produce exactly the need score.bank_need computes alone —
    # proving the callout path never feeds the figures.
    banks = json.loads((TOOL_ROOT / "inputs/assessment_areas.json").read_text())["banks"]
    assumptions = json.loads((TOOL_ROOT / "inputs/funnel_assumptions.json").read_text())
    org = json.loads((TOOL_ROOT / "inputs/org.json").read_text())
    bank = banks["american_business_bank"]   # AA has San Bernardino + LA entries
    meta = states.state_meta(bank.get("state", "CA"))
    metrics = score.load_county_metrics(meta["metrics"])
    values, need = generate.build_values(bank, assumptions, org, metrics, meta)
    direct = score.bank_need(bank["aa_counties"], metrics, assumptions)
    for k in ("eligible", "unenrolled", "ratio", "benefit_low_usd", "benefit_high_usd"):
        assert abs(need[k] - direct[k]) < TOL
    # and the callout actually rendered into the artifact for this bank
    assert "me-evidence" in values["me_evidence_block"]


def test_access_callout_keeps_artifact_at_three_pages(tmp_path):
    # The strongest overflow guard: a bank whose AA triggers the callout must
    # still render exactly three pages (2-page pitch + appendix).
    rc = generate.main(["--bank", "american_business_bank"])
    assert rc == 0
    pdf = TOOL_ROOT / "out" / "american_business_bank.pdf"
    n_pages = subprocess.run(
        ["mdls", "-name", "kMDItemNumberOfPages", "-raw", str(pdf)],
        capture_output=True, text=True).stdout.strip()
    if n_pages not in ("", "(null)"):
        assert n_pages == "3"
