"""The mortgage lender artifact — state CRA, not federal.

A different document from the bank pitch (src/generate.py), because the
obligation is different in three ways that change the whole page:

  * The assessment area is the WHOLE STATE. No county map, no per-county need
    table, no assessment-area delineation read out of a Performance Evaluation.
    That removes the generator's largest source of error and its only
    geographic-precision risk.
  * The credit finding is FIRST-ORDER here. For a bank, "SNAP access raises
    credit scores" is community benefit. For a mortgage lender a household
    moving off a 634 average is moving toward the line that decides whether
    they qualify at all. It leads the page instead of supporting it.
  * One lender is often covered in more than one state. 28 of our targets are
    covered in MA, NY and IL simultaneously, so the artifact prices and frames
    a multi-state program rather than a single-state grant.

Qualification basis differs by state and is stated per state, never blended:
  MA  M.G.L. c. 255E s.8 / 209 CMR 54.00 -- mature exam record; a published DOB
      evaluation already credits a lender for funding SNAP application help.
  NY  Banking Law s.28-bb / NYDFS reg effective 2026-07-07 -- evaluates
      "participation in community development-related services"; nobody
      examined yet.
  IL  205 ILCS 735 / 38 Ill. Adm. Code 1055 -- covered at 50+ loans; IDFPR has
      published no mortgage evaluations yet.

Usage:
  python3 -m src.lender --lender guaranteed_rate
  python3 -m src.lender --lender fairway --send
"""
from __future__ import annotations

import argparse
import datetime
import json
import sys
from pathlib import Path

TOOL_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOL_ROOT))
from src import generate  # noqa: E402

REPO_ROOT = TOOL_ROOT.parents[1]


class UnsupportedLenderStateError(Exception):
    """A covered state with no fact base behind it."""


class UnverifiedLenderError(Exception):
    """--send refused: coverage not confirmed against the licensee register."""


# Statewide eligible-unenrolled HOUSEHOLDS, 130% gross-income basis, 2023 ACS
# 1-Year PUMS. Households (not persons) so the three states are comparable.
# A state appears here only once its fact base exists in data-ops/sample/;
# the generator refuses a covered state it cannot source a number for.
STATE_NEED = {
    "MA": {
        "name": "Massachusetts",
        "eligible_hh": 374453,
        "unenrolled_hh": 174358,
        "source": "data-ops/sample/ma-snap-gap/ma_snap_gap_summary.json",
        "authority": "M.G.L. c. 255E, § 8 and 209 CMR 54.00 (Mortgage Lender Community Investment)",
        "regulator": "Massachusetts Division of Banks",
        "threshold": "50 or more home mortgage loans in Massachusetts in the prior calendar year",
    },
    "IL": {
        "name": "Illinois",
        "eligible_hh": 753150,
        "unenrolled_hh": 411481,
        "source": "data-ops/sample/il-snap-gap/il_county_metrics.csv",
        "authority": "205 ILCS 735 (Illinois Community Reinvestment Act) and 38 Ill. Adm. Code 1055",
        "regulator": "Illinois Department of Financial and Professional Regulation",
        "threshold": "50 or more home mortgage loans originated in Illinois in the prior calendar year",
    },
    "NY": {
        "name": "New York",
        "eligible_hh": 1313399,
        "unenrolled_hh": 649776,
        "source": "data-ops/sample/ny-snap-gap/ny_county_metrics.csv",
        "authority": "New York Banking Law § 28-bb and the NYDFS regulation effective July 7, 2026",
        "regulator": "New York State Department of Financial Services",
        "threshold": "200 or more HMDA-reportable New York originations in the prior calendar year",
    },
}

# Ask ladder for mortgage lenders, grounded in the disclosed giving read from
# 99 Massachusetts public evaluations (typical CD giving $1,600-$18,250 for an
# entire review period; six lenders at zero). Multi-state programs are priced
# at ~2.5x the single-state figure because the value is aggregated across
# separate obligations, not stretched within one.
def ask_for(total_originations: int, states_covered: int) -> int:
    if total_originations >= 12000:
        base = 15000
    elif total_originations >= 5000:
        base = 10000
    elif total_originations >= 2000:
        base = 7500
    elif total_originations >= 500:
        base = 5000
    else:
        base = 2500
    if states_covered >= 3:
        return int(base * 2.5)
    if states_covered == 2:
        return int(base * 1.8)
    return base


def load_lenders():
    p = TOOL_ROOT / "inputs/lenders.json"
    return json.loads(p.read_text())


def build_values(lender, org, today=None):
    states = [s for s in lender["originations"] if lender["originations"][s] > 0]
    for s in states:
        if s not in STATE_NEED:
            raise UnsupportedLenderStateError(
                f"{s} has no fact base wired for the lender artifact. "
                f"Run tools/snap-gap-states/build_state.py for {s}, then add it to STATE_NEED."
            )
    states.sort(key=lambda s: -lender["originations"][s])
    total = sum(lender["originations"][s] for s in states)
    ask = lender.get("ask_usd") or ask_for(total, len(states))

    rows, need_hh, need_elig = "", 0, 0
    for s in states:
        m = STATE_NEED[s]
        need_hh += m["unenrolled_hh"]
        need_elig += m["eligible_hh"]
        rows += (f"<tr><td>{m['name']}</td>"
                 f"<td>{lender['originations'][s]:,}</td>"
                 f"<td>{m['unenrolled_hh']:,}</td>"
                 f"<td class='auth'>{m['authority']}</td></tr>")

    if len(states) == 1:
        scope = f"{STATE_NEED[states[0]]['name']}"
        scope_line = f"your {scope} community investment obligation"
    else:
        names = [STATE_NEED[s]["name"] for s in states]
        scope = ", ".join(names[:-1]) + " and " + names[-1]
        scope_line = f"your community investment obligations in {scope} — one program, {len(states)} jurisdictions"

    # Massachusetts examination position, only when we actually read it
    ma = lender.get("ma_exam")
    if ma:
        bits = [f"last examined <strong>{ma['date']}</strong>",
                f"overall <strong>{ma['overall']}</strong>"]
        if ma.get("service_test"):
            bits.append(f"Service Test <strong>{ma['service_test']}</strong>")
        ma_line = ("<div class=\"exam\"><span class=\"lbl\">Your Massachusetts record</span>"
                   + " &middot; ".join(bits)
                   + (f" &middot; {ma['note']}" if ma.get("note") else "") + "</div>")
    else:
        ma_line = ""

    return {
        "org_name": org["org_name"],
        "program_name": org["program_name"],
        "lender_name": lender["name"],
        "prepared_date": (today or datetime.date.today()).strftime("%B %-d, %Y"),
        "scope": scope,
        "scope_line": scope_line,
        "n_states": str(len(states)),
        "headline_unenrolled": f"{need_hh:,}",
        "eligible_total": f"{need_elig:,}",
        "total_originations": f"{total:,}",
        "state_rows": rows,
        "ma_exam_line": ma_line,
        "ask": f"${ask:,}",
        "contact_name": org["contact_name"],
        "contact_title": org["contact_title"],
        "contact_email": org["contact_email"],
        "sources": " &middot; ".join(STATE_NEED[s]["source"] for s in states),
    }


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--lender", required=True)
    ap.add_argument("--send", action="store_true",
                    help="refuses unless coverage is confirmed against the state licensee register")
    args = ap.parse_args(argv)

    lenders = load_lenders()
    _, _, org = generate.load_inputs()
    if args.lender not in lenders:
        raise SystemExit(f"unknown lender: {args.lender}. Known: {', '.join(sorted(lenders))}")
    lender = lenders[args.lender]

    if args.send and not lender.get("coverage_verified"):
        raise UnverifiedLenderError(
            f"{lender['name']}: coverage_verified is false. HMDA proves volume, not coverage — "
            f"confirm the lender appears on each state's licensee register under the covered "
            f"category, then set coverage_verified true. {lender.get('verify_note','')}"
        )

    values = build_values(lender, org)
    html = generate.render((TOOL_ROOT / "templates/lender.html").read_text(), values)
    out = TOOL_ROOT / "out"
    out.mkdir(exist_ok=True)
    hp = out / f"lender-{args.lender}.html"
    hp.write_text(html)
    pp = out / f"lender-{args.lender}.pdf"
    generate.html_to_pdf(hp, pp)

    print(f"{lender['name']}")
    print(f"  states: {values['n_states']}  originations: {values['total_originations']}")
    print(f"  statewide unenrolled households: {values['headline_unenrolled']}")
    print(f"  ask: {values['ask']}")
    print(f"  -> {pp}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
