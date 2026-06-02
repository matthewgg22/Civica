"""Empirical priors — P(field wrong) and P(flip). ⚠ FLAGGED PLACEHOLDERS.

Until the QC-distribution docs (qc_fy2023_profile.md) and the internal gold
standard (matrix §5) land, P(error) is a population-prior placeholder — NOT
validated, and NO rate is published from it. P(flip) is computed structurally
(perturb-and-re-run), so it is not a placeholder, only its input error
distribution is.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Iterable

from ..eligibility_engine import EligibilityEngine, Profile
from .sensitivity import with_field_delta
from .verification import VerificationStatus, p_error_for_verification

# ⚠ PLACEHOLDER P(field is wrong). Replace with QC-derived, segment-conditional
# estimates + uncertainty. Earned income is the top error channel in the QC data.
_P_ERROR_PRIOR: dict[str, Decimal] = {
    "earned": Decimal("0.30"),
    "unearned": Decimal("0.10"),
    "housing": Decimal("0.12"),
}


@dataclass
class InputUncertainty:
    """Per-field plausible error distribution (signed $ samples) + P(wrong).
    Pilot source = caseworker wobble flags; eventually QC-derived."""
    error_samples: dict[str, list[Decimal]] = field(default_factory=dict)
    p_wrong: dict[str, Decimal] = field(default_factory=dict)
    verification: dict[str, VerificationStatus] = field(default_factory=dict)

    def p_error(self, fld: str) -> Decimal:
        if fld in self.p_wrong:                       # explicit override wins
            return self.p_wrong[fld]
        if fld in self.verification:                  # §11 verification status — the strongest predictor
            return p_error_for_verification(self.verification[fld], fld)
        return _P_ERROR_PRIOR.get(fld, Decimal("0.10"))

    def samples(self, fld: str) -> list[Decimal]:
        return self.error_samples.get(fld, [])


def p_error(field: str) -> Decimal:
    """Population-prior P(field is wrong). ⚠ placeholder."""
    return _P_ERROR_PRIOR.get(field, Decimal("0.10"))


def p_flip(
    engine: EligibilityEngine, profile: Profile, field: str, *,
    as_of_date: date, error_samples: Iterable[Decimal],
) -> Decimal:
    """P(this field's error flips eligibility), via perturb-and-re-run — the
    fraction of perturbed samples whose eligibility differs from the base."""
    samples = [Decimal(s) for s in error_samples]
    if not samples:
        return Decimal("0")
    base = engine.determine(profile, as_of_date=as_of_date).eligible
    flips = sum(
        1 for d in samples
        if engine.determine(with_field_delta(profile, field, d), as_of_date=as_of_date).eligible != base
    )
    return Decimal(flips) / Decimal(len(samples))
