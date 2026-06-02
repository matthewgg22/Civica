"""Prevention-wing output + the integrity guardrail MECHANISM (matrix §6).

"Aim at B*, not max B" is enforced, not asserted:
  (a) prompts are neutral and documentation-only — never "reporting Y could
      raise your benefit";
  (b) the computed benefit is FIREWALLED out — a Clarification carries no amount
      by construction;
  (c) a SymmetricPromptMonitor tracks the benefit-raising:lowering prompt ratio;
  (d) persistent upward skew throttles the engine (wire to the §5 release gate).
"""
from __future__ import annotations

from dataclasses import dataclass

# Neutral, documentation-only prompts. NEVER reference an amount or direction.
# (reason_code, prompt) by field — reason_code ties to a leakage-taxonomy class.
_NEUTRAL_PROMPT: dict[str, tuple[str, str]] = {
    "earned": ("income_variable",
               "Your hours appear to vary and your pay records differ — please share your "
               "last 4 pay stubs or an employer letter so income is averaged correctly."),
    "unearned": ("unearned_unverified",
                 "Please share documentation of any benefits or other non-wage income "
                 "(award letter or statement)."),
    "housing": ("shelter_unverified",
                "Please share documentation of your rent/mortgage and utilities "
                "(lease, bill, or statement)."),
}


@dataclass(frozen=True)
class Clarification:
    field: str
    reason_code: str
    prompt_en: str
    # By construction there is NO benefit amount here (integrity firewall §6b).


def build_clarification(field: str) -> Clarification:
    code, prompt = _NEUTRAL_PROMPT.get(field, ("documentation", "Please share documentation for this item."))
    return Clarification(field=field, reason_code=code, prompt_en=prompt)


@dataclass
class SymmetricPromptMonitor:
    """Tracks raise:lower prompt mix; upward skew is the benefit-coaching drift
    signature (§6c) and an integrity/regulatory risk."""
    raising: int = 0
    lowering: int = 0
    min_n: int = 20
    max_skew: float = 0.65

    def record(self, *, benefit_raising: bool) -> None:
        if benefit_raising:
            self.raising += 1
        else:
            self.lowering += 1

    @property
    def skew(self) -> float:
        total = self.raising + self.lowering
        return (self.raising / total) if total else 0.0

    def throttled(self) -> bool:
        """True when the engine should be throttled/flagged (§6d → §5 release gate)."""
        return (self.raising + self.lowering) >= self.min_n and self.skew > self.max_skew
