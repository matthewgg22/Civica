"""Ask sizing.

Before this module every ask was a case-by-case judgement anchored loosely on
"3-4.6x the bank's average donation in the target assessment area". That worked
while the roster was small, but it is not reproducible and it mispriced the two
ends: a bank whose whole annual programme is $24,000 was being asked for the
same $10,000 as a bank giving $133,000 a year.

The rule here is deliberately boring and states its own limits:

    annual = aa_giving_usd / review_period_years   (the budget constraint)
    raw    = annual * SHARE * gap_multiplier
    ask    = round to $2,500, clamped to [FLOOR, CEILING]

SHARE is 15% -- a single grant is a *share* of a bank's assessment-area
donation budget, never the whole thing, and 15% is large enough to matter to
them and small enough to survive a grants committee that has never funded us.

The floor is the load-bearing part. Below MIN_VIABLE_GRANT a grant cannot fund
a campaign that reaches an assessment area at all, so a bank whose 15% share
lands under it is NOT a smaller ask -- it is a *pool candidate*, and the
function says so rather than quietly rounding up. That is what makes county
pooling structural rather than a fallback.

The ceiling is the earmarked-tier price point. Asking above it is not
constrained by the bank's budget but by ours: we have no service record, so the
lever for a bank that could clearly give more is TERM and a year-two step-up,
not a bigger first cheque.
"""

SHARE = 0.15
MIN_VIABLE_GRANT = 10_000
CEILING = 25_000
STEP = 2_500

# Our activity feeds the Investment Test (a grant is a qualified investment
# under 12 CFR __.12(t)) and the Service Test. Lending is NOT ours to move, so
# a lending-only gap earns no multiplier.
GAP_WEIGHT = {
    "": 0.0,
    "outstanding": 0.0,
    "high satisfactory": 0.0,
    "low satisfactory": 1.0,
    "needs to improve": 1.3,
    "substantial noncompliance": 1.5,
}


class NoDocumentedGapError(ValueError):
    """Raised when neither test our activity feeds carries a gap."""


def gap_multiplier(investment: str, service: str) -> float:
    """Severity of the documented gap, across the two tests we can move.

    Both tests gapped is worse than one, but not additively -- an examiner
    reads them together, so the second gap is worth a quarter, not a whole.
    """
    inv = GAP_WEIGHT.get((investment or "").strip().lower(), 0.0)
    svc = GAP_WEIGHT.get((service or "").strip().lower(), 0.0)
    if not inv and not svc:
        raise NoDocumentedGapError(
            f"no gap on either test we feed (investment={investment!r}, service={service!r})")
    worse, other = max(inv, svc), min(inv, svc)
    return worse + (0.25 * other)


def size_ask(aa_giving_usd, review_period_years, investment, service):
    """Return (ask_usd, verdict, detail).

    verdict is "earmark" or "pool". A pool verdict returns the computed share
    as ask_usd so the caller can still total a county's pooled capacity.
    """
    if not aa_giving_usd or aa_giving_usd <= 0:
        raise ValueError("aa_giving_usd must be a positive number read from the PE")
    years = review_period_years or 3.0
    if years <= 0:
        raise ValueError("review_period_years must be positive")

    annual = aa_giving_usd / years
    mult = gap_multiplier(investment, service)
    raw = annual * SHARE * mult
    rounded = int(round(raw / STEP) * STEP)

    detail = {
        "aa_giving_usd": aa_giving_usd,
        "review_period_years": years,
        "annual_aa_giving_usd": round(annual),
        "share": SHARE,
        "gap_multiplier": round(mult, 2),
        "raw_usd": round(raw),
    }
    if rounded < MIN_VIABLE_GRANT:
        return rounded, "pool", detail
    return min(rounded, CEILING), "earmark", detail
