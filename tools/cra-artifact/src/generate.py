"""Generate a per-bank CRA pitch PDF.

Usage:
  python3 -m src.generate --bank bank_irvine            # HTML + PDF into out/
  python3 -m src.generate --bank bank_irvine --send     # + content-hash archive into sent/
  python3 -m src.generate --bank bank_irvine --html-only

Build fails loudly on: unknown bank, missing template field, no metrics
coverage, metrics/geometry mismatch, invalid assumptions. --send refuses
unverified banks (assessment_areas.json verified:false).
"""
import argparse
import datetime
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

TOOL_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOL_ROOT))
from src import archetype, coverage, liveness, mapsvg, report, score, states  # noqa: E402

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

REQUIRED_ASSUMPTION_KEYS = {
    "version", "cpc_usd", "budget_split", "rates", "benefit",
    "household_size_eligible", "ratio_display_threshold", "mock_report_policy",
}


class TemplateFieldError(Exception):
    pass


class UnsizedAskError(Exception):
    """Raised when a bank has no defensible ask.

    Five Star and Bank of Marin have real documented gaps, but their PEs
    disclose no per-assessment-area donation figure, so the ask on the record is
    a retained placeholder rather than a computed figure. Printing it into a PDF
    would put a number in front of a bank that we cannot justify."""


class NoDocumentedGapError(Exception):
    """Raised when --send targets a bank with no gap on any test we feed.

    A pitch to such a bank asks it to fund an activity that cannot help its
    examination. American Business Bank sat in the roster with a $25,000 ask and
    three High Satisfactory component ratings; Bank Irvine, the original first
    target of this channel, is a Small Bank whose only test is Lending -- which
    no grant can move."""


class UnverifiedBankError(Exception):
    pass


def load_inputs():
    inputs = TOOL_ROOT / "inputs"
    banks = json.loads((inputs / "assessment_areas.json").read_text())["banks"]
    assumptions = json.loads((inputs / "funnel_assumptions.json").read_text())
    org = json.loads((inputs / "org.json").read_text())
    missing = REQUIRED_ASSUMPTION_KEYS - set(assumptions)
    if missing:
        raise ValueError(f"funnel_assumptions.json missing keys: {sorted(missing)}")
    return banks, assumptions, org


def fmt_int(x):
    return f"{x:,.0f}"


def fmt_musd(x):
    if x >= 1e9:
        return f"${x/1e9:.2f}B"
    return f"${x/1e6:.1f}M" if x >= 1e6 else f"${x/1e3:,.0f}K"


def render(template: str, values: dict) -> str:
    """Strict [[field]] substitution: missing field or leftover marker fails."""
    def sub(m):
        key = m.group(1)
        if key not in values:
            raise TemplateFieldError(f"template field has no value: {key}")
        return str(values[key])
    out = re.sub(r"\[\[(\w+)\]\]", sub, template)
    if "[[" in out:
        raise TemplateFieldError("unsubstituted template marker remains")
    return out



def _absolute_headline(need, meta, fmt_int, fmt_musd, ratio_line, aa_label):
    """Page 1 for states whose fact base supports an absolute claim."""
    return (
        f'<div class="big">{fmt_int(round(need["unenrolled"], -3))}</div>\n'
        f'  <div class="head-sentence">eligible residents of <em>your assessment area</em> '
        f'are not receiving {meta["program_ref"]} benefits they qualify for.</div>\n'
        f'  <div class="subline">That is an estimated <strong>'
        f'{fmt_musd(need["benefit_low_usd"])}–{fmt_musd(need["benefit_high_usd"])} per year</strong> '
        f'in unclaimed federal nutrition benefits that would be spent in {aa_label} grocery stores.</div>\n'
        f'  <div class="qualifier">Estimated from 2023 ACS 1-Year PUMS ({meta["method_short"]}); '
        f'dollar range reflects household-size assumptions, not a confidence interval. '
        f'Methodology and known biases: page 5.</div>\n  {ratio_line}')


def _coverage_headline(rank, meta, aa_label):
    """Page 1 for FNS-divergence states.

    States NO population count and NO dollar figure -- both are unsupportable
    where FNS and the gross-income proxy disagree by this much. It leads with
    the ranking, which is the one thing the fact base explicitly permits, and
    says plainly what it is not claiming.
    """
    worst = rank["least_covered"]
    named = ", ".join(f'{c["county"]} ({c["state"]})' for c in rank["below_median"])
    return (
        f'<div class="big">{worst["county"]}, {worst["state"]}</div>\n'
        f'  <div class="head-sentence">is the least-covered county in <em>your assessment area</em> '
        f'— the place a {meta["program_ref"]} outreach dollar goes furthest.</div>\n'
        f'  <div class="subline">Ranked below the assessment-area midpoint: <strong>{named}</strong>. '
        f'Coverage is the ratio of households receiving {meta["program_ref"]} to households below the '
        f'poverty line; a lower ratio means fewer of those households are reached '
        f'<em>relative to</em> the rest of your assessment area.</div>\n'
        f'  <div class="qualifier"><strong>This page deliberately states no gap size and no dollar '
        f'figure.</strong> {meta["fns_note"]} Counties are ranked, not counted — coverage above 1.0 is '
        f'expected because eligibility reaches well above the poverty line. Methodology: page 5.</div>'
    )


def _absolute_tiles(need, fmt_int):
    return (
        f'<div class="stat"><div class="label">Eligible residents, est.</div>'
        f'<div class="value">{fmt_int(need["eligible"])}</div>'
        f'<div class="note">in covered assessment-area counties</div></div>\n'
        f'      <div class="stat"><div class="label">Currently enrolled, est.</div>'
        f'<div class="value">{need["aa_enrolled_pct"]:.0f}%</div>'
        f'<div class="note">vs. {need["state_enrolled_pct"]:.0f}% statewide</div></div>\n'
        f'      <div class="stat"><div class="label">Avg. household benefit</div>'
        f'<div class="value">${need["avg_household_monthly_usd"]:.0f}/mo</div>'
        f'<div class="note">USDA FNS, FY2024 national average</div></div>')


def _coverage_tiles(rank):
    worst, best = rank["least_covered"], rank["ranked"][-1]
    return (
        f'<div class="stat"><div class="label">Counties ranked</div>'
        f'<div class="value">{rank["n_counties"]}</div>'
        f'<div class="note">across your assessment area</div></div>\n'
        f'      <div class="stat"><div class="label">Lowest coverage</div>'
        f'<div class="value">{worst["coverage_ratio"]:.2f}</div>'
        f'<div class="note">{worst["county"]}, {worst["state"]}</div></div>\n'
        f'      <div class="stat"><div class="label">Highest coverage</div>'
        f'<div class="value">{best["coverage_ratio"]:.2f}</div>'
        f'<div class="note">{best["county"]}, {best["state"]} — already well served</div></div>')


def build_values(bank, assumptions, org, metrics, meta):
    need = score.bank_need(bank["aa_counties"], metrics, assumptions)
    fun = report.funnel(bank["ask_usd"], assumptions)
    aa_label = (f"{bank['aa_counties'][0]} County" if len(bank["aa_counties"]) == 1
                else "assessment-area")
    map_caption = (f"{aa_label} in regional context · SNAP need by county"
                   if len(bank["aa_counties"]) == 1
                   else "Assessment area · SNAP need by county")
    ratio_line = ""
    if need["show_ratio"]:
        ratio_line = (f'<div class="ratio-line">Unmet need here runs '
                      f'{need["ratio"]:.1f}× the statewide average.</div>')
    gaps = ""
    if need["gap_counties"]:
        gaps = ("Data gaps: no need estimate available for "
                + ", ".join(need["gap_counties"])
                + " (shown gray on the map; excluded from all figures). ")
    if meta.get("headline_mode") == "coverage":
        # FNS-divergence state: rank, never count. See src/coverage.py.
        rank = coverage.rank_assessment_area(
            bank["aa_counties"], bank["state"], coverage.load_coverage(),
            extra_states=bank.get("aa_counties_other_states"))
        headline_block = _coverage_headline(rank, meta, aa_label)
        stat_tiles = _coverage_tiles(rank)
        # The conversion rates below were observed where enrollment gaps are
        # large. Saying so is the honest form of the same table.
        funnel_caveat = (" Conversion rates are drawn from states with a measured "
                         "enrollment gap; in a high-participation state a larger share "
                         "of people reached will already be enrolled, so treat the "
                         "application and approval rows as an upper bound.")
        if rank["missing"]:
            gaps = ("Data gaps: not in the coverage index — "
                    + ", ".join(rank["missing"]) + ". ") + gaps
    else:
        headline_block = _absolute_headline(need, meta, fmt_int, fmt_musd,
                                            ratio_line, aa_label)
        stat_tiles = _absolute_tiles(need, fmt_int)
        funnel_caveat = ""

    hh = assumptions["household_size_eligible"]
    v = {
        "org_name": org["org_name"],
        "program_name": org["program_name"],
        "status_line": org["status_line"],
        "status_line_lc": org["status_line"][0].lower() + org["status_line"][1:],
        "engine_line": org["engine_line"],
        "contact_name": org["contact_name"],
        "contact_title": org["contact_title"],
        "contact_email": org["contact_email"],
        "contact_phone_line": (f" · {org['contact_phone']}" if org.get("contact_phone") else ""),
        "bank_name": bank["name"],
        "regulator": bank["regulator"],
        "pe_date": bank["pe_date"],
        "aa_counties_list": (", ".join(bank["aa_counties"])
                             + (" Counties" if len(bank["aa_counties"]) > 1 else " County")
                             + bank.get("aa_note", "")),
        "aa_label": aa_label,
        "prepared_date": datetime.date.today().strftime("%B %Y"),
        "headline_block": headline_block,
        "stat_tiles": stat_tiles,
        "funnel_caveat": funnel_caveat,
        # still used by the page-4 assumptions list in BOTH modes
        "benefit_monthly": f"{need['avg_household_monthly_usd']:.0f}",
        "map_caption": map_caption,
        "map_svg": mapsvg.regional_map_svg(bank["aa_counties"], metrics,
                                           geojson_kind=meta["geojson"],
                                           state_fips=meta["fips"]),
        "program_ref": meta["program_ref"],
        "model_note": meta["model_note"],
        "method_short": meta["method_short"],
        "method_bullet": meta["method_bullet"],
        "data_gaps_note": gaps,
        "rationale_block": archetype.rationale_block(bank),
        "pitch_headline": archetype.headline(bank),
        "ask_fmt": fmt_int(bank["ask_usd"]),
        "assumptions_version": assumptions["version"],
        "hh_low": hh["low_dollar"],
        "hh_high": hh["high_dollar"],
    }
    for s in ("low", "mid"):
        f = fun[s]
        v[f"{s}_clicks"] = fmt_int(f["clicks"])
        v[f"{s}_sessions"] = fmt_int(f["sessions"])
        v[f"{s}_checks"] = fmt_int(f["checks"])
        v[f"{s}_started"] = fmt_int(f["apps_started"])
        v[f"{s}_submitted"] = fmt_int(f["apps_submitted"])
        v[f"{s}_approved"] = fmt_int(f["approved_households"])
        v[f"{s}_benefit"] = fmt_musd(f["annual_benefit_usd"]) + "/yr"
        v[f"{s}_cps"] = f"${bank['ask_usd'] / f['apps_submitted']:,.0f}"
    return v, need


def html_to_pdf(html_path: Path, pdf_path: Path):
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
         f"--print-to-pdf={pdf_path}", "--virtual-time-budget=8000",
         html_path.as_uri()],
        check=True, capture_output=True, timeout=120,
    )
    if not pdf_path.exists() or pdf_path.stat().st_size == 0:
        raise RuntimeError("Chrome produced no PDF")
    if pdf_path.stat().st_size > 10 * 1024 * 1024:
        raise RuntimeError("PDF exceeds the 10MB budget")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--bank", required=True)
    ap.add_argument("--send", action="store_true",
                    help="content-hash archive the PDF into sent/")
    ap.add_argument("--html-only", action="store_true")
    ap.add_argument("--allow-nonsendable", action="store_true",
                    help="render a no-target or unsized bank anyway, for inspection only")
    args = ap.parse_args(argv)

    banks, assumptions, org = load_inputs()
    if args.bank not in banks:
        raise KeyError(f"unknown bank key {args.bank!r}; known: {sorted(banks)}")
    bank = banks[args.bank]

    # Refuse before generating anything. A PDF that exists is a PDF that can be
    # attached to an email -- test fixtures and no-target banks were reaching the
    # operator's send folder because the guards only ran after the file was
    # written, and at --send time rather than at generation.
    if not args.allow_nonsendable:
        # A "peer" bank has no gap on purpose -- that is the whole archetype, and
        # it is the segment the old gap-only screen excluded by construction. It
        # still needs the capacity evidence a no-target bank lacks, so require a
        # disclosed giving figure rather than waving the guard through.
        if archetype.resolve(bank) == "peer" and not bank.get("aa_giving_usd"):
            raise NoDocumentedGapError(
                f"{args.bank}: pitched as peer but discloses no per-assessment-area "
                f"giving. A peer pitch leads with their own figure, so without one "
                f"there is nothing to say.")
        if (bank.get("target_status") == "no-target"
                and archetype.resolve(bank) != "peer"):
            raise NoDocumentedGapError(
                f"{args.bank}: target_status is no-target — the PE shows no gap on any "
                f"test our activity feeds, so no artifact should exist. "
                f"{bank.get('ask_sizing','')[:160]}")
        # A giving figure at the wrong scope silently mis-sizes the ask. FirstBank
        # discloses $126,000 BANK-WIDE, so pricing Nashville off it overstates the
        # share. Wrong-scope figures have caused more errors here than any other
        # single cause, so a recorded caveat blocks the artifact outright.
        if bank.get("ask_scope_caveat"):
            raise UnsizedAskError(
                f"{args.bank}: giving figure is at the wrong scope — "
                f"{bank['ask_scope_caveat']}")
        if bank.get("ask_verdict") == "unsized":
            raise UnsizedAskError(
                f"{args.bank}: ask is UNSIZED — the PE discloses no per-assessment-area "
                f"giving figure, so the ask on record is a placeholder. Resolve it before "
                f"generating. {bank.get('ask_sizing','')[:160]}")
        if args.send:
            # Every send-gate runs BEFORE generation. Refusing after the PDF
            # exists still leaves a sendable file on disk.
            liveness.assert_alive(args.bank, bank)
            if not bank.get("verified"):
                raise UnverifiedBankError(
                    f"{args.bank} has verified:false — re-read the PE and flip the "
                    "flag before archiving a send copy")

    states.assert_buildable(bank.get("name", "bank"), bank)
    meta = states.state_meta(bank["state"])  # no default: a missing state must fail, not silently score against CA
    metrics = score.load_county_metrics(meta["metrics"])
    values, need = build_values(bank, assumptions, org, metrics, meta)

    template = (TOOL_ROOT / "templates/artifact.html").read_text()
    html = render(template, values)
    out = TOOL_ROOT / "out"
    out.mkdir(exist_ok=True)
    html_path = out / f"{args.bank}.html"
    html_path.write_text(html)
    print(f"HTML: {html_path}")

    # Numbers the oracle hand-calc (T5e) must independently reproduce:
    if meta.get("headline_mode") == "coverage":
        # Never print a gap or a dollar figure for a state where we refuse to
        # claim one -- an operator copying the oracle line into an email would
        # undo the whole point of the mode.
        rank = coverage.rank_assessment_area(
            bank["aa_counties"], bank["state"], coverage.load_coverage(),
            extra_states=bank.get("aa_counties_other_states"))
        print(f"ORACLE CHECK — {bank['name']}: COVERAGE MODE (no gap claimed) "
              f"counties={rank['n_counties']} "
              f"least_covered={rank['least_covered']['county']},{rank['least_covered']['state']} "
              f"ratio={rank['least_covered']['coverage_ratio']:.3f}")
    else:
        print(f"ORACLE CHECK — {bank['name']}: eligible={need['eligible']:.0f} "
          f"unenrolled={need['unenrolled']:.0f} ratio={need['ratio']:.3f} "
          f"benefit_range=({need['benefit_low_usd']:.0f}, {need['benefit_high_usd']:.0f})")

    if args.html_only:
        return 0
    pdf_path = out / f"{args.bank}.pdf"
    html_to_pdf(html_path, pdf_path)
    print(f"PDF:  {pdf_path} ({pdf_path.stat().st_size/1024:.0f} KB)")

    if args.send:
        digest = hashlib.sha256(pdf_path.read_bytes()).hexdigest()[:8]
        sent = TOOL_ROOT / "sent"
        sent.mkdir(exist_ok=True)
        dest = sent / f"{args.bank}-{datetime.date.today()}-{digest}.pdf"
        shutil.copy2(pdf_path, dest)
        print(f"SENT ARCHIVE: {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
