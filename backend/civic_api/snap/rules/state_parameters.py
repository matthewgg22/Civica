"""Per-state parameters captured from the 2026-06-01 CA/MA research agents.

State-tier values the federal `FYParameters` doesn't carry. v1 wires the STANDARD
MEDICAL DEDUCTION (a frequently-missed elderly/disabled underpayment source — taxonomy
§15). `se_cost_method` is recorded for the self-employment fork (§20) but the SE cost
computation is NOT yet wired (MA "actual" needs a per-source cost field).

Values: CA standard medical $150 / itemize-above $185 ✓ (CDSS federal waiver
extended through 2029-09-30 per LSNC reg summary 2026-02, confirmed 2026-06-04
issue #428); MA standard medical $155 / itemize-above $190 (106 CMR 364.400(C), ✓).
SE: CA = 40%-flat OR actual (client choice; default 40%); MA = actual only.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class StateParameters:
    state: str
    # Flat elderly/disabled medical deduction when expenses exceed $35; None = federal
    # itemize-only (deduct the excess over $35).
    standard_medical_deduction: Decimal | None
    se_cost_method: str        # "flat_40" | "actual"  (recorded; SE-cost not yet wired)
    se_flat_rate: Decimal      # cost fraction for the flat method


_DEFAULT = StateParameters(
    state="*", standard_medical_deduction=None, se_cost_method="actual", se_flat_rate=Decimal("0.40"),
)
_STATE: dict[str, StateParameters] = {
    "CA": StateParameters("CA", Decimal("150"), "flat_40", Decimal("0.40")),
    "MA": StateParameters("MA", Decimal("155"), "actual", Decimal("0.40")),
}


def state_params_for(state: str | None) -> StateParameters:
    return _STATE.get((state or "").upper(), _DEFAULT)
