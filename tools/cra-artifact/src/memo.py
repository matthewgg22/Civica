"""One-page CRA qualification memorandum — the artifact a bank keeps in its
community reinvestment file for a grant it made to us.

Why this exists: community-development grants are never publicly filed and
never reported item-by-item to a regulator. The bank's internal log, plus
whatever the grantee supplied, is the ENTIRE evidence base an examiner sees
(12 CFR __.43 public-file contents; Large Institution CRA Examination
Procedures, Investment Test step 1). So this memo is not a courtesy — it is
the bank's exam evidence, and it is built to satisfy, item by item, what
examiners verify:

    (a) CD category + primary purpose        -> __.12(g)(2), Q&A __.12(h)-8
    (b) LMI beneficiary proof                -> Q&A __.12(g)(2)-1 (SNAP named)
    (c) geographic nexus to the AA           -> Q&A __.12(h)-6/-7
    (d) amount / date / recipient identity
    (e) not-counted-elsewhere + no-benefit-returned attestations

Posture rule: the memo supplies evidence, it never asserts that the grant
qualifies or that any rating follows. That determination is the bank's.

Usage:
  python3 -m src.memo --bank helm_bank --amount 30000 --date 2026-10-01
  python3 -m src.memo --bank helm_bank --amount 30000 --date 2026-10-01 \
      --term "under a two-year commitment of $60,000 executed 2026-10-01"
  python3 -m src.memo --bank helm_bank --specimen      # unsigned sample for the pitch
"""
from __future__ import annotations

import argparse
import datetime
import json
import re
import sys
from pathlib import Path

TOOL_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOL_ROOT))
from src import generate, score, states  # noqa: E402


class MemoOverflowError(Exception):
    """The memo must be exactly one page; never silently clipped."""


def page_count(pdf_path: Path) -> int:
    return len(re.findall(rb"/Type\s*/Page[^s]", Path(pdf_path).read_bytes()))


def _counties_phrase(counties: list[str]) -> str:
    """Marin County · Marin and Napa Counties · Marin, Napa, and Sonoma Counties."""
    if len(counties) == 1:
        return f"{counties[0]} County"
    if len(counties) == 2:
        return f"{counties[0]} and {counties[1]} Counties"
    return ", ".join(counties[:-1]) + f", and {counties[-1]} Counties"


def build_memo_values(bank, org, args) -> dict:
    meta = states.state_meta(bank.get("state", "CA"))
    metrics = score.load_county_metrics(meta["metrics"])
    need = score.bank_need(bank["aa_counties"], metrics, {
        "household_size_eligible": {"low_dollar": 2.5, "high_dollar": 1.6},
        "benefit": {"avg_household_monthly_usd": 351.49},
        "ratio_display_threshold": 1.15,
    })
    counties = _counties_phrase(need["covered_counties"])
    unserved = f"{need['unenrolled']:,.0f}"

    nexus = (
        f"The program serves residents of {counties}, comprising or falling within "
        f"the assessment area the institution delineated in its most recent CRA "
        f"Performance Evaluation; geography is recorded at county level from "
        f"participant-reported location. Where the footprint extends beyond that "
        f"area, the program's purpose and function include serving individuals "
        f"within it (Q&A §__.12(h)—6)."
    )
    responsiveness = (
        f"An estimated {unserved} residents of these counties are income-eligible "
        f"for SNAP but not enrolled, leaving federal nutrition benefits unclaimed "
        f"in the assessment area. Examiners consider information an institution "
        f"provides about community development needs when establishing performance "
        f"context, and responsiveness to identified needs is a criterion under each "
        f"applicable test. Offered as input to the institution's needs narrative — "
        f"a documented need, not a representation about outcomes."
    )

    phone = org.get("contact_phone") or ""
    return {
        "org_name": org["org_name"],
        "program_name": org["program_name"],
        "program_description": org.get("program_description", org["engine_line"]),
        "ein": org.get("ein", "[EIN]"),
        "determination": org.get("determination_date", "2026"),
        "org_address": org.get("address", "[address]"),
        "contact_name": org["contact_name"],
        "contact_title": org["contact_title"],
        "contact_email": org["contact_email"],
        "contact_phone_line": (f" · {phone}" if phone else ""),
        "bank_name": bank["name"],
        "regulator": bank["regulator"],
        "pe_date": bank["pe_date"],
        "memo_date": datetime.date.today().strftime("%B %-d, %Y"),
        "amount": ("[grant amount]" if args.specimen else f"${args.amount:,.0f}"),
        "grant_date": ("[date]" if args.specimen else args.date),
        "grant_term": (f", {args.term}" if args.term else ""),
        "counties_line": counties,
        "nexus_paragraph": nexus,
        "responsiveness_paragraph": responsiveness,
        "model_note": meta["model_note"],
        "specimen_mark": ('<div class="specimen"><span>SPECIMEN</span></div>'
                          if args.specimen else ""),
        # Long county lists push the memo past one page; tighten leading rather
        # than drop content. The page-count guard below is the real backstop.
        "density": (" dense" if len(counties) > 24 else ""),
    }


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--bank", required=True)
    ap.add_argument("--amount", type=float, default=0.0)
    ap.add_argument("--date", default="")
    ap.add_argument("--term", default="", help="e.g. multi-year commitment language")
    ap.add_argument("--specimen", action="store_true",
                    help="unsigned sample memo for the pitch packet")
    ap.add_argument("--html-only", action="store_true")
    args = ap.parse_args(argv)

    banks, _assumptions, org = generate.load_inputs()
    if args.bank not in banks:
        raise KeyError(f"unknown bank key {args.bank!r}; known: {sorted(banks)}")
    if not args.specimen and (not args.amount or not args.date):
        raise SystemExit("--amount and --date are required unless --specimen")

    values = build_memo_values(banks[args.bank], org, args)
    html = generate.render((TOOL_ROOT / "templates/memo.html").read_text(), values)

    out = TOOL_ROOT / "out"
    out.mkdir(exist_ok=True)
    stem = f"memo-{args.bank}" + ("-specimen" if args.specimen else f"-{args.date}")
    html_path = out / f"{stem}.html"
    html_path.write_text(html)
    print(f"HTML: {html_path}")
    if args.html_only:
        return 0
    pdf_path = out / f"{stem}.pdf"
    generate.html_to_pdf(html_path, pdf_path)
    pages = page_count(pdf_path)
    if pages != 1:
        raise MemoOverflowError(
            f"memo rendered {pages} pages — the qualification memo must be one "
            f"page. Shorten the program description or attestations; do not "
            f"clip content.")
    print(f"PDF:  {pdf_path} ({pdf_path.stat().st_size/1024:.0f} KB, 1 page)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
