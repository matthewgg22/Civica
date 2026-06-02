"""§10105 tier weight — the local liability slope ∂Liability/∂PER.

State cost-share liability is ~flat mid-tier and JUMPS at a tier edge, so a case's
marginal dollars-at-risk *to the state* is large only when the state's published
PER sits within ε of a §10105 tier boundary. This makes the router prioritize the
dollars Civica actually monetizes.

⚠ PLACEHOLDER tier edges + epsilon — exact §10105 boundaries pending
obbba_adjusted_10105.md. Do not treat the weights as calibrated.
"""
from __future__ import annotations

from decimal import Decimal

# §10105 cost-share steps: states pay 0/5/10/15% of benefit cost at PER <6/>6/>8/>10%
# (civica_special_category_taxonomy §21). The structure is NON-MONOTONE: a state with
# PER above ~13.32% is EXEMPT from cost-share (FY2029/30) — liability drops back to 0.
_TIER_EDGES = (Decimal("6"), Decimal("8"), Decimal("10"))
_EXEMPT_PER = Decimal("13.32")  # ⚠ confirm exact decimal vs PL 119-21 §10105 — above this: cost-share-exempt
_EPSILON = Decimal("0.5")  # within ±0.5 pp of an edge/cliff = "live"


def tier_weight(
    published_per_pct: Decimal | None, *,
    near_edge: Decimal = Decimal("3"), mid: Decimal = Decimal("1"), exempt: Decimal = Decimal("0"),
) -> Decimal:
    """Local liability slope ∂Liability/∂PER. High within ε of a tier step OR the
    exemption cliff; ~0 once the state is already exempt (no marginal liability);
    baseline mid-tier. `mid` when PER is unknown (neutral)."""
    if published_per_pct is None:
        return mid
    if published_per_pct > _EXEMPT_PER + _EPSILON:
        return exempt  # already exempt → no cost-share → no marginal liability
    if any(abs(published_per_pct - e) <= _EPSILON for e in (*_TIER_EDGES, _EXEMPT_PER)):
        return near_edge
    return mid
