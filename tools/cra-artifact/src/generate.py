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
from src import access_evidence, mapsvg, report, score, states  # noqa: E402

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

REQUIRED_ASSUMPTION_KEYS = {
    "version", "cpc_usd", "budget_split", "rates", "benefit",
    "household_size_eligible", "ratio_display_threshold", "mock_report_policy",
}


class TemplateFieldError(Exception):
    pass


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
    if x >= 1e6:
        # Whole millions keep the range compact so it never forces a table
        # label to wrap (e.g. "$320M–$500M", not "$320.0M–$500.0M").
        return f"${x/1e6:.0f}M"
    return f"${x/1e3:,.0f}K"


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


def build_county_breakdown(covered_counties, metrics, cap=6):
    """Ranked per-county unmet-need bars — the regional insight a flat AA
    choropleth can't carry (which counties actually drive the need).

    Presentation only: reads the same county metrics the score uses, never
    changes a headline figure. Rows beyond `cap` fold into an 'other counties'
    line so the numbers still sum to the assessment-area total.
    """
    rows = [(c, metrics[c]["eligible_pop"] * metrics[c]["non_enroll_rate"])
            for c in covered_counties]
    rows.sort(key=lambda t: t[1], reverse=True)
    if len(rows) > cap:
        tail = sum(u for _, u in rows[cap - 1:])
        rows = rows[:cap - 1] + [(f"{len(rows) - (cap - 1)} other counties", tail)]
    top = rows[0][1] if rows and rows[0][1] > 0 else 1
    lis = []
    for name, u in rows:
        pct = max(3.0, u / top * 100.0)
        # Stacked row: county + count on one line, a full-width proportional
        # bar beneath. Full-width bars give the ranking room to read (LA dwarfs
        # the rest) instead of stubby bars stranded from their numbers.
        lis.append(
            f'<li><div class="brk-row"><span class="c">{name}</span>'
            f'<span class="n">{fmt_int(round(u, -3))}</span></div>'
            f'<div class="track"><span class="bar" style="width:{pct:.1f}%"></span></div></li>'
        )
    return ('<div class="brk"><div class="brk-cap">Not enrolled, by county</div>'
            f'<ul>{"".join(lis)}</ul></div>')


def build_values(bank, assumptions, org, metrics, meta):
    need = score.bank_need(bank["aa_counties"], metrics, assumptions)
    fun = report.funnel(bank["ask_usd"], assumptions)
    aa_label = (f"{bank['aa_counties'][0]} County" if len(bank["aa_counties"]) == 1
                else "assessment-area")
    map_caption = (f"{aa_label} in regional context · SNAP need by county"
                   if len(bank["aa_counties"]) == 1
                   else "Assessment area · SNAP need by county")
    county_breakdown = build_county_breakdown(need["covered_counties"], metrics)
    ratio_line = ""
    if need["show_ratio"]:
        ratio_line = (f'<div class="ratio-line">Unmet need here runs '
                      f'{need["ratio"]:.1f}× the statewide average.</div>')
    gaps = ""
    if need["gap_counties"]:
        gaps = ("Data gaps: no need estimate available for "
                + ", ".join(need["gap_counties"])
                + " (shown gray on the map; excluded from all figures). ")
    hh = assumptions["household_size_eligible"]
    counties_plain = (", ".join(bank["aa_counties"])
                      + (" Counties" if len(bank["aa_counties"]) > 1 else " County"))
    why_this_bank = (
        f"{bank['name']}'s CRA assessment area covers {counties_plain}. Civica "
        "restricts all outreach and measurement to that geography, so the bank "
        "sees exactly where its community-development dollars go and what they "
        "produce."
    )
    v = {
        "why_this_bank": why_this_bank,
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
        "headline_unenrolled": fmt_int(round(need["unenrolled"], -3)),
        "benefit_range": f"{fmt_musd(need['benefit_low_usd'])}–{fmt_musd(need['benefit_high_usd'])}",
        "ratio_line": ratio_line,
        "map_caption": map_caption,
        "map_svg": mapsvg.regional_map_svg(bank["aa_counties"], metrics,
                                           geojson_kind=meta["geojson"],
                                           state_fips=meta["fips"]),
        "program_ref": meta["program_ref"],
        "model_note": meta["model_note"],
        "method_short": meta["method_short"],
        "method_bullet": meta["method_bullet"],
        "eligible_fmt": fmt_int(need["eligible"]),
        "aa_enrolled_pct": f"{need['aa_enrolled_pct']:.0f}",
        "aa_unenrolled_pct": f"{100 - need['aa_enrolled_pct']:.0f}",
        "state_enrolled_pct": f"{need['state_enrolled_pct']:.0f}",
        "benefit_monthly": f"{need['avg_household_monthly_usd']:.0f}",
        "data_gaps_note": gaps,
        "ask_fmt": fmt_int(bank["ask_usd"]),
        # Page-1 documented-access callout (CDSS ME). Presentation only — see
        # access_evidence.py; never feeds need/funnel/score. Empty = silent.
        "me_evidence_block": access_evidence.evidence_html(
            bank["aa_counties"], state=bank.get("state", "CA")),
        "county_breakdown": county_breakdown,
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
    args = ap.parse_args(argv)

    banks, assumptions, org = load_inputs()
    if args.bank not in banks:
        raise KeyError(f"unknown bank key {args.bank!r}; known: {sorted(banks)}")
    bank = banks[args.bank]
    meta = states.state_meta(bank.get("state", "CA"))
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
    print(f"ORACLE CHECK — {bank['name']}: eligible={need['eligible']:.0f} "
          f"unenrolled={need['unenrolled']:.0f} ratio={need['ratio']:.3f} "
          f"benefit_range=({need['benefit_low_usd']:.0f}, {need['benefit_high_usd']:.0f})")

    if args.html_only:
        return 0
    pdf_path = out / f"{args.bank}.pdf"
    html_to_pdf(html_path, pdf_path)
    print(f"PDF:  {pdf_path} ({pdf_path.stat().st_size/1024:.0f} KB)")

    if args.send:
        if not bank.get("verified"):
            raise UnverifiedBankError(
                f"{args.bank} has verified:false — re-read the PE and flip the "
                "flag before archiving a send copy")
        digest = hashlib.sha256(pdf_path.read_bytes()).hexdigest()[:8]
        sent = TOOL_ROOT / "sent"
        sent.mkdir(exist_ok=True)
        dest = sent / f"{args.bank}-{datetime.date.today()}-{digest}.pdf"
        shutil.copy2(pdf_path, dest)
        print(f"SENT ARCHIVE: {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
