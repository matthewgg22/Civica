"""Which pitch a bank gets, and why.

The targeting screen used to be gap-only, which was half wrong (see
docs/strategy/targeting-thesis-challenge-2026-08-25.md). Rating and giving are
independent axes:

    capacity  -- disclosed per-AA giving -- decides whether they CAN fund us
    gap       -- specifically a SERVICE gap -- decides whether they have a
                 reason to act now

An INVESTMENT gap is deliberately NOT a targeting signal here. A bank can
satisfy the Investment Test with LIHTC funds, municipal bonds and SBICs while
writing almost no grants -- Parkway holds $27.1M of investments in its Illinois
AA against $7,000 of grants. So an Investment rating says nothing useful about
grant propensity, and the banks that look worst on it are often the ones least
likely to write a cheque.

Four archetypes fall out of the two axes:

    remediation          service gap + real capacity. Name the examiner's own
                         finding. This was the only pitch we had.
    peer                 clean service rating + real capacity. NO deficiency to
                         name, so remediation framing is wrong and faintly
                         insulting. Lead with what they already fund.
    service_partnership  meets CRA through instruments, not grants, AND has a
                         service finding. The point is that another bond cannot
                         cure a Service Test conclusion.
    pooled               small capacity. One document, several names, no
                         bespoke mining.

Posture rule, same as the memo: we describe what the public evaluation says and
what we do. We never assert that a rating will change.
"""
from __future__ import annotations

WEAK = {"low satisfactory", "needs to improve", "substantial noncompliance"}
HIGH_CAPACITY_USD = 500_000
MID_CAPACITY_USD = 150_000

VALID = {"remediation", "peer", "service_partnership", "pooled"}


class ArchetypeError(Exception):
    """The bank's data cannot support the archetype claimed for it."""


def _norm(v) -> str:
    return (v or "").strip().lower()


def capacity_band(bank) -> str:
    g = bank.get("aa_giving_usd") or 0
    if g >= HIGH_CAPACITY_USD:
        return "high"
    if g >= MID_CAPACITY_USD:
        return "mid"
    return "low"


def has_service_gap(bank) -> bool:
    return _norm(bank.get("svc_rating")) in WEAK


def is_instrument_heavy(bank) -> bool:
    """Big balance-sheet CD, negligible grants.

    Requires BOTH figures from the evaluation. We do not infer it from a rating,
    because that is the exact mistake this module exists to stop.
    """
    inv = bank.get("pe_investment_usd")
    giv = bank.get("aa_giving_usd")
    if not inv or not giv:
        return False
    return inv >= 20 * giv


def resolve(bank) -> str:
    """Pick the archetype. An explicit `pitch_archetype` always wins."""
    explicit = bank.get("pitch_archetype")
    if explicit:
        if explicit not in VALID:
            raise ArchetypeError(
                f"unknown pitch_archetype {explicit!r}; valid: {sorted(VALID)}")
        return explicit

    band = capacity_band(bank)
    gap = has_service_gap(bank)

    # Order matters. An instrument-heavy bank looks LOW capacity on the grant
    # axis precisely because it does not write grants -- Parkway discloses
    # $7,000 of grants against $27.1M of investments. Testing capacity first
    # routes it to `pooled` and asks for $500, which reads the one bank whose
    # balance sheet is enormous as the one that can least afford us. Its
    # capacity is the investment figure; its problem is the service finding.
    if gap and is_instrument_heavy(bank):
        return "service_partnership"
    if band == "low":
        return "pooled"
    if gap:
        return "remediation"
    return "peer"


# --- the block that actually differs on the page ------------------------------

def _money(v) -> str:
    return f"${v:,.0f}"


def _pe_phrase(bank) -> str:
    """"2022-03-25" is a database value, not something you write in a letter."""
    import datetime
    raw = (bank.get("pe_date") or "").strip()
    if not raw:
        return "most recent"
    for fmt in ("%Y-%m-%d", "%B %d, %Y", "%B %Y"):
        try:
            return datetime.datetime.strptime(raw, fmt).strftime("%B %Y")
        except ValueError:
            continue
    return raw


def rationale_block(bank) -> str:
    """The 'why we are writing to you' paragraph on page 2.

    Every archetype cites the bank's OWN public evaluation. None of them asserts
    that a rating follows -- that determination belongs to the bank.
    """
    kind = resolve(bank)
    pe = _pe_phrase(bank)
    giving = bank.get("aa_giving_usd")
    quote = bank.get("pe_need_quote")

    if kind == "peer":
        lead = (
            f"We are writing because your {pe} CRA Performance Evaluation shows "
            f"an institution already funding this category at scale"
            + (f" — {_money(giving)} in qualified grants and donations disclosed "
               f"for this assessment area" if giving else "")
            + ". We are proposing a better-measured instrument for a commitment "
            "you already make: the same community-services purpose, with "
            "quarterly dollar-traceability from grant to outcome that your team "
            "can put straight into the exam file."
        )
    elif kind == "service_partnership":
        lead = (
            f"Your {pe} evaluation records substantial community development "
            "investment alongside a Service Test conclusion. We raise this "
            "plainly: a further investment position does not speak to a service "
            "finding, because the Service Test asks how the institution reaches "
            "low- and moderate-income households, not what it holds. What we "
            "propose is a service partnership — outreach delivered in your "
            "assessment area, with a role for your staff — of which the grant is "
            "one component."
        )
    elif kind == "pooled":
        lead = (
            "We are approaching several institutions that share this assessment "
            "area with a single, small, concrete proposal, so that no one bank "
            "carries the pilot alone. Your share is sized against giving "
            "disclosed in your own evaluation, not against your balance sheet."
        )
    else:  # remediation
        lead = (
            f"We are writing because your {pe} CRA Performance Evaluation "
            "identifies service delivery to low- and moderate-income households "
            "in this assessment area as an area of examiner attention, and that "
            "is precisely the gap this program addresses."
        )

    quote_html = ""
    if quote and kind in ("remediation", "service_partnership"):
        quote_html = (f'<div class="quote" style="margin-top:8px;">From that '
                      f'evaluation: &ldquo;…{quote}.&rdquo;</div>')

    return (f'<div class="body-block"><h3>Why we are writing to you</h3>{lead}'
            f'{quote_html}</div>')


def headline(bank) -> str:
    """Page-2 heading, which should not promise remediation to a clean bank."""
    return {
        "peer": "A better-measured instrument for a commitment you already make",
        "service_partnership": "A service partnership in your assessment area",
        "pooled": "A shared benefits-access pilot in your assessment area",
        "remediation": "A benefits-access pilot in your assessment area",
    }[resolve(bank)]
