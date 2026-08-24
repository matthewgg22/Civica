"""The end-of-quarter report — what a funded bank actually receives.

This is the deliverable everything else in the pitch is selling: the document
that goes into the bank's community reinvestment file alongside the
qualification memo (src/memo.py). Together they are the bank's complete exam
evidence for the grant.

Design rules carried from the reviews:
  * Layer 1 (observed in-product) is reported as counts and carries the CRA
    documentation on its own; Layer 2 (consented follow-up panel) is reported
    with opt-in and response rates disclosed and never silently extrapolated.
  * Measured values are compared against the conservative/mid-range scenarios
    presented at proposal — INCLUDING when measurement lands low. The report
    saying so plainly is the product.
  * Need figures remain performance-context input, never a credit claim.

Until a funded pilot exists there is no real measured data, so `--sample`
renders the deliverable with ILLUSTRATIVE measured values, watermarked, so a
prospect can see exactly what arrives. Real runs will read the same shape from
the service database.

Usage:
  python3 -m src.quarterly --bank ocean_bank --amount 25000 --period "Q1 2027" --sample
"""
from __future__ import annotations

import argparse
import datetime
import sys
from pathlib import Path

TOOL_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOL_ROOT))
from src import generate, memo, report, score, states  # noqa: E402

# Illustrative measured mid-funnel rates for the SAMPLE deliverable. Chosen
# deliberately BELOW the mid-range proposal assumptions (0.30 / 0.25) so the
# sample demonstrates the reporting integrity we promise: the quarter where the
# number misses is the quarter the report has to say so.
ILLUSTRATIVE_MEASURED = {
    "session_to_check": 0.22,     # proposal mid: 0.30
    "check_to_started": 0.21,     # proposal mid: 0.25
    "panel_opt_in": 0.38,
    "panel_response": 0.42,
    "panel_reported_submitted": 0.61,
    "panel_reported_approved": 0.44,
    "approval_rate": 0.55,
}

# NBER WP 34434 (preliminary draft, Nov 2025) treatment-on-the-treated effects,
# Los Angeles arm. These are effects on the MARGINAL household -- one whose
# enrollment actually changed because the interview requirement got easier.
# Applying them to every approved household therefore yields an UPPER BOUND,
# and the report says so in those words. We do not observe credit outcomes.
WP34434 = {
    "debt_yr3_usd": 2436,          # credit card balance, year 3 (-51% off $4,778)
    "delinquency_pp": 0.101,       # likelihood of any delinquent account, off 41%
    "score_points": 17,            # credit score, off a 634 mean
    "borrower_savings_usd": 100,   # authors' own translation via Brevoort et al. (2020)
}

# Program budget split — identical at every bank (the replicability claim).
SPLIT = [("Outreach in your assessment area", 0.60),
         ("Measurement & reporting", 0.15),
         ("Creative, ad operations & Spanish localization", 0.10),
         ("Indirect costs — federal de minimis rate, 2 CFR 200.414(f)", 0.15)]


def fmt(n, dec=0):
    return f"{n:,.{dec}f}"


class PoolShareError(Exception):
    """A pooled report whose share cannot be stated is not publishable."""


def pool_context(args):
    """Pro rata attribution for a county program funded by several banks.

    12 CFR s.345.22(d) states the agencies' approach to activity shared across
    institutions: it "may be allocated among participants or investors, as they
    choose", but no participant "may claim a loan origination or loan purchase
    if another participant or investor claims the same", nor claim more than
    "its percentage share (based on the level of its participation or
    investment)".

    That paragraph governs community development LOANS under the lending test.
    A grant is a qualified investment, not a loan, so this is the closest
    analogue rather than a provision on point -- the anti-double-counting
    principle and the percentage-share cap are what we adopt, and the report
    says so in those terms rather than implying the paragraph controls grants.

    Everything a pooled report claims is scaled by the funder's share, so two
    banks in the same county can never be handed the same household twice.
    """
    total = getattr(args, "pool_total", None)
    if not total:
        return None
    if total < args.amount:
        raise PoolShareError(
            f"pool total ${total:,.0f} is less than this bank's ${args.amount:,.0f}")
    share = args.amount / total
    if not (0 < share <= 1):
        raise PoolShareError(f"share out of range: {share}")
    return {"share": share, "total": total,
            "cofunders": max(0, (getattr(args, "pool_funders", None) or 0) - 1)}


def _pool_block(pool, budget):
    """The disclosure that makes a pooled report defensible. Empty when solo."""
    if not pool:
        return ""
    co = pool["cofunders"]
    co_txt = (f' co-funded with {co} other institution' + ("s" if co != 1 else "")) if co else ""
    return (
        '<div class="banner"><strong>This is a pooled county program, and every figure in this '
        f'report is your share of it.</strong> Your ${budget:,.0f} is <strong>{pool["share"]:.0%}</strong> '
        f'of a ${pool["total"]:,.0f} program{co_txt}. Delivery, service and outcome figures below have '
        'all been scaled by that percentage before they were printed. No other participant is shown '
        'the same households, and no participant is shown more than its percentage share. Allocation '
        'is strictly by contribution. We follow the approach the agencies set out for community '
        'development activity shared across institutions at 12 CFR &sect;&nbsp;345.22(d) &mdash; such '
        'activity &ldquo;may be allocated among participants or investors, as they choose,&rdquo; but '
        'no participant may claim what another claims, or claim more than &ldquo;its percentage '
        'share.&rdquo; That paragraph addresses community development <em>loans</em> under the lending '
        'test; a grant is a qualified investment rather than a loan, so we adopt its '
        'anti-double-counting principle and percentage-share cap rather than asserting it governs '
        'grants.</div>')


def build(bank, org, assumptions, args):
    meta = states.state_meta(bank.get("state", "CA"))
    metrics = score.load_county_metrics(meta["metrics"])
    need = score.bank_need(bank["aa_counties"], metrics, assumptions)
    m = ILLUSTRATIVE_MEASURED
    budget = args.amount
    pool = pool_context(args)
    # The program runs at pooled scale; this bank's file carries its share of
    # it. Compute the funnel on the program total, then cut to the share --
    # the funnel is linear, so this equals computing on the bank's own dollars,
    # but stating it this way keeps the arithmetic identical to the disclosure.
    funnel_budget = pool["total"] if pool else budget

    # Layer 1 — delivery and service (observed)
    a = assumptions
    clicks = (funnel_budget * a["budget_split"]["google"] / a["cpc_usd"]["google"]["mid"]
              + funnel_budget * a["budget_split"]["meta"] / a["cpc_usd"]["meta"]["mid"])
    sessions = clicks * a["rates"]["click_to_session"]["mid"]
    checks = sessions * m["session_to_check"]
    started = checks * m["check_to_started"]
    submitted = started * a["rates"]["started_to_submitted"]
    approved = submitted * m["approval_rate"]
    annual_benefit = approved * a["benefit"]["avg_household_monthly_usd"] * 12

    if pool:
        # Cut every claimed figure to this funder's share -- so two banks in the
        # same county can never be handed the same household twice.
        clicks *= pool["share"]; sessions *= pool["share"]; checks *= pool["share"]
        started *= pool["share"]; submitted *= pool["share"]; approved *= pool["share"]
        annual_benefit *= pool["share"]

    proj = report.funnel(budget, a)  # the low/mid ranges shown at proposal

    # County allocation of delivery, weighted by each county's unmet need
    covered = need["covered_counties"]
    weights = {c: metrics[c]["eligible_pop"] * metrics[c]["non_enroll_rate"] for c in covered}
    tot_w = sum(weights.values())
    county_rows = "".join(
        f"<tr><td>{c} County</td><td>${fmt(budget*weights[c]/tot_w)}</td>"
        f"<td>{fmt(sessions*weights[c]/tot_w)}</td>"
        f"<td>{fmt(checks*weights[c]/tot_w)}</td>"
        f"<td><strong>{fmt(submitted*weights[c]/tot_w)}</strong></td></tr>"
        for c in sorted(covered, key=lambda x: -weights[x]))

    split_rows = "".join(
        f"<tr><td>{label}</td><td>{int(pct*100)}¢</td><td>${fmt(budget*pct)}</td></tr>"
        for label, pct in SPLIT)

    # Layer 2 — consented follow-up panel
    opted = checks * m["panel_opt_in"]
    responded = opted * m["panel_response"]

    phone = org.get("contact_phone") or ""
    return {
        "org_name": org["org_name"], "program_name": org["program_name"],
        "bank_name": bank["name"], "regulator": bank["regulator"],
        "pe_date": bank["pe_date"],
        "period": args.period,
        "report_date": datetime.date.today().strftime("%B %-d, %Y"),
        "amount": f"${fmt(budget)}",
        "counties_line": memo._counties_phrase(covered),
        "program_ref": meta["program_ref"],
        "model_note": meta["model_note"],
        "contact_name": org["contact_name"], "contact_title": org["contact_title"],
        "contact_email": org["contact_email"],
        "contact_phone_line": (f" · {phone}" if phone else ""),
        "sample_mark": ('<div class="specimen"><span>SAMPLE</span></div>'
                        if args.sample else ""),
        "sample_banner": (
            '<div class="banner"><strong>Sample deliverable.</strong> Every figure '
            'below is illustrative, shown so you can see exactly what arrives at the '
            'end of a funded quarter. A real report carries measured values from the '
            'service record.</div>' if args.sample else ""),
        # Layer 1
        "clicks": fmt(clicks), "sessions": fmt(sessions), "checks": fmt(checks),
        "started": fmt(started), "submitted": fmt(submitted),
        "cpc": f"${budget/clicks:.2f}",
        "county_rows": county_rows, "split_rows": split_rows,
        # measured vs proposal
        "s2c_measured": f"{m['session_to_check']*100:.0f}%",
        "s2c_proposed": f"{a['rates']['session_to_check']['low']*100:.0f}–{a['rates']['session_to_check']['mid']*100:.0f}%",
        "c2s_measured": f"{m['check_to_started']*100:.0f}%",
        "c2s_proposed": f"{a['rates']['check_to_app_started']['low']*100:.0f}–{a['rates']['check_to_app_started']['mid']*100:.0f}%",
        "proj_low_sub": fmt(proj["low"]["apps_submitted"]),
        "proj_mid_sub": fmt(proj["mid"]["apps_submitted"]),
        # Layer 2
        "opted": fmt(opted), "opt_in_pct": f"{m['panel_opt_in']*100:.0f}%",
        "responded": fmt(responded), "resp_pct": f"{m['panel_response']*100:.0f}%",
        "panel_submitted_pct": f"{m['panel_reported_submitted']*100:.0f}%",
        "panel_approved_pct": f"{m['panel_reported_approved']*100:.0f}%",
        "approved": fmt(approved),
        "approval_pct": f"{m['approval_rate']*100:.0f}%",
        "annual_benefit": f"${annual_benefit/1e6:.2f}M" if annual_benefit >= 1e6 else f"${fmt(annual_benefit)}",
        "cost_per_submitted": f"${budget/submitted:.0f}",
        "pool_block": _pool_block(pool, budget),
        # Research-implied tier -- NOT measured. See WP34434 above.
        "ri_debt_each": f"${WP34434['debt_yr3_usd']:,}",
        "ri_delinq_each": f"{WP34434['delinquency_pp']*100:.1f} pts",
        "ri_score_each": f"{WP34434['score_points']} pts",
        "ri_households": fmt(approved),
        "ri_debt_total": f"${approved*WP34434['debt_yr3_usd']/1e6:.1f}M"
                         if approved*WP34434['debt_yr3_usd'] >= 1e6
                         else f"${approved*WP34434['debt_yr3_usd']:,.0f}",
        "ri_delinq_households": fmt(approved*WP34434['delinquency_pp']),
        "ri_savings_total": f"${approved*WP34434['borrower_savings_usd']:,.0f}",
        "benefit_per_dollar": f"${annual_benefit/budget:,.0f}",
        "unserved": fmt(need["unenrolled"]),
    }


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--bank", required=True)
    ap.add_argument("--amount", type=float, required=True)
    ap.add_argument("--period", default="Q1 2027")
    ap.add_argument("--sample", action="store_true",
                    help="illustrative measured values, watermarked")
    ap.add_argument("--html-only", action="store_true")
    ap.add_argument("--pool-total", type=float, default=None,
                    help="total of the pooled county program; enables pro rata attribution")
    ap.add_argument("--pool-funders", type=int, default=None,
                    help="number of funding institutions in the pool")
    args = ap.parse_args(argv)

    banks, assumptions, org = generate.load_inputs()
    if args.bank not in banks:
        raise KeyError(f"unknown bank key {args.bank!r}; known: {sorted(banks)}")
    if not args.sample:
        raise SystemExit(
            "no measured data source is wired yet — run with --sample until a "
            "funded pilot's service record exists (never publish invented "
            "numbers as measured).")

    values = build(banks[args.bank], org, assumptions, args)
    html = generate.render((TOOL_ROOT / "templates/quarterly.html").read_text(), values)
    out = TOOL_ROOT / "out"
    out.mkdir(exist_ok=True)
    stem = f"quarterly-{args.bank}-sample"
    (out / f"{stem}.html").write_text(html)
    print(f"HTML: {out / f'{stem}.html'}")
    if args.html_only:
        return 0
    pdf = out / f"{stem}.pdf"
    generate.html_to_pdf(out / f"{stem}.html", pdf)
    print(f"PDF:  {pdf} ({pdf.stat().st_size/1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
