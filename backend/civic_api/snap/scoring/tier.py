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

# §10105 cost-share steps: states pay 0/5/10/15% of benefit cost at PER <6 / 6–8 / 8–10 / ≥10%
# (✓ CRS R48552). Cost-share STARTS FY2028. A state whose PER×1.5 ≥ 20% (i.e. PER ≥ ~13.33%)
# has its cost-share START DELAYED to FY2029/FY2030 — this is a timing DELAY, NOT a permanent
# exemption (corrects an earlier "exempt above 13.32%" reading). So a very-high-PER state has
# ~0 NEAR-TERM marginal liability (delayed), but will owe 15% later.
_TIER_EDGES = (Decimal("6"), Decimal("8"), Decimal("10"))
_DELAY_PER = Decimal("13.333")  # PER × 1.5 ≥ 20% → cost-share start delayed (not exempt)
_EPSILON = Decimal("0.5")  # within ±0.5 pp of an edge/delay-cliff = "live"


def tier_weight(
    published_per_pct: Decimal | None, *,
    near_edge: Decimal = Decimal("3"), mid: Decimal = Decimal("1"), delayed: Decimal = Decimal("0"),
) -> Decimal:
    """Local liability slope ∂Liability/∂PER. High within ε of a 5/10/15% tier step or the
    delay cliff; ~0 once the state's cost-share is delayed (no NEAR-TERM marginal liability);
    baseline mid-tier. `mid` when PER is unknown (neutral)."""
    if published_per_pct is None:
        return mid
    if published_per_pct > _DELAY_PER + _EPSILON:
        return delayed  # cost-share start delayed (FY2029/30) → ~0 near-term marginal liability
    if any(abs(published_per_pct - e) <= _EPSILON for e in (*_TIER_EDGES, _DELAY_PER)):
        return near_edge
    return mid
