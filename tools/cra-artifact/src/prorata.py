"""What one bank's money buys, stated pro rata, on a schedule, ending in a report.

The pitch had the platform, the enrollment gap and the research, but never joined
them: it never said "for YOUR $25,000, here is your share of the outcome, here is
when it happens, and here is the document you get at the end." That is the whole
point of a pro-rata campaign and it was missing.

Effect sizes are treatment-on-the-treated estimates from Homonoff, Lee & Meckel,
NBER WP 34434 (preliminary, Nov 2025), measured on SNAP applicants in Los Angeles
and San Francisco. They are research on SNAP ACCESS generally, not a measurement
of this program, and every figure derived from them is labelled projected.
"""
from __future__ import annotations

# Homonoff, Lee & Meckel (NBER WP 34434), treatment-on-the-treated, year three.
DEBT_REDUCTION_USD = 2436          # less credit-card debt per household
DELINQUENCY_PP = 10.1              # percentage points less likely to hold a delinquency
CREDIT_SCORE_PTS = 17              # points, from a 634 average
CREDIT_SCORE_BASELINE = 634

# The research's own precision ordering: the authors note the credit-score effect
# is the least precisely estimated of the three. Say so wherever it is used.
LEAST_PRECISE = "credit score"


def campaign_share(ask_usd: float, campaign_total_usd: float) -> float:
    if not campaign_total_usd:
        return 1.0
    return min(1.0, ask_usd / campaign_total_usd)


def household_outcomes(approved_households: int) -> dict:
    """Projected household-level effects for a given number of approvals."""
    h = max(0, int(approved_households))
    return {
        "households": h,
        "debt_reduced_usd": h * DEBT_REDUCTION_USD,
        "delinquencies_avoided": round(h * DELINQUENCY_PP / 100),
        "score_points": CREDIT_SCORE_PTS,
    }


def fmt_usd(v) -> str:
    return f"${v:,.0f}"


def prorata_block(ask_usd, low_approved, mid_approved, aa_label) -> str:
    lo = household_outcomes(low_approved)
    mid = household_outcomes(mid_approved)
    return f"""
  <h3>What your ${ask_usd:,.0f} buys, stated pro rata</h3>
  <div class="body-block">
    Your grant funds a defined share of one quarter's outreach in {aa_label}. The households
    below are the ones your share is projected to move through to an approved SNAP application.
    Independent research on SNAP access — not on this program — then attaches the following
    effects to each approved household by year three.
  </div>
  <table class="report prorata">
    <thead><tr><th>Projected from your grant alone</th><th>Conservative</th><th>Mid-range</th></tr></thead>
    <tbody>
      <tr><td>Households approved for SNAP</td>
          <td>{lo['households']:,}</td><td>{mid['households']:,}</td></tr>
      <tr><td>Credit-card debt reduced, year three <span class="fine">({fmt_usd(DEBT_REDUCTION_USD)}/household)</span></td>
          <td>{fmt_usd(lo['debt_reduced_usd'])}</td><td>{fmt_usd(mid['debt_reduced_usd'])}</td></tr>
      <tr><td>Households no longer holding a delinquent account <span class="fine">({DELINQUENCY_PP} pp)</span></td>
          <td>{lo['delinquencies_avoided']:,}</td><td>{mid['delinquencies_avoided']:,}</td></tr>
      <tr><td>Average credit-score movement <span class="fine">from a {CREDIT_SCORE_BASELINE} base</span></td>
          <td>+{CREDIT_SCORE_PTS} pts</td><td>+{CREDIT_SCORE_PTS} pts</td></tr>
    </tbody>
  </table>
  <div class="rsrc">These are <strong>projections, not measurements</strong>, and they carry the
  study's own limits: effects are treatment-on-the-treated among roughly 65,000 Los Angeles and
  40,000 San Francisco SNAP applicants, the authors label the estimates preliminary and subject
  to revision, and they note the <strong>{LEAST_PRECISE}</strong> effect is the least precisely
  estimated of the three — the debt and delinquency effects are stronger. Approval counts come
  from the assumption set on page 4. We report measured figures quarterly and never restate a
  projection as a result.</div>
"""


def timetable_block(ask_fmt: str) -> str:
    return """
  <h3>What happens, and when</h3>
  <table class="report timetable">
    <thead><tr><th>When</th><th>What happens</th><th>What you receive</th></tr></thead>
    <tbody>
      <tr><td>Week 0</td><td>Grant agreement signed; assessment-area geography and creative confirmed with your CRA team</td>
          <td>Countersigned agreement and a CRA qualification memorandum for your public file</td></tr>
      <tr><td>Weeks 1–2</td><td>Campaign builds and launches; tracking verified end to end before spend begins</td>
          <td>Launch confirmation with the exact geography being served</td></tr>
      <tr><td>Weeks 3–12</td><td>Outreach runs; residents reach a free eligibility check and application support</td>
          <td>A mid-quarter delivery note at week 6</td></tr>
      <tr><td>Week 13</td><td>Quarter closes and figures are reconciled</td>
          <td><strong>Quarterly report</strong> — the format sampled on page 3, with measured
          delivery, applications and approvals in your assessment area</td></tr>
      <tr><td>Campaign close</td><td>Pro-rata reconciliation across all participating funders</td>
          <td><strong>Final campaign report</strong> — your share of total spend, the outcomes
          attributable to it, dollar-traceability from grant to result, and a plain statement of
          what was projected versus what was measured</td></tr>
    </tbody>
  </table>
  <div class="rsrc">Every figure in both reports is a measurement or is labelled as an estimate.
  Where a number moved against us, the report says so — a report your examiner can trust is
  worth more to both of us than a favourable one.</div>
"""
