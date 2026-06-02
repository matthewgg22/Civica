"""Sensitivity = how much a benefit moves when an input is wrong.

PRIMARY: perturb-and-re-run. Take the profile, shift one field by its plausible
error, re-run the ONE EligibilityEngine, read the actual ΔB. This is the single
source of truth for sensitivity — it sees the clamp kinks and the eligibility
cliffs that the analytic coefficients miss (the relevant input errors, $120–$190+,
are large enough to cross a kink — civica_accurate_number_model §3/§4).

It is also τ-aware and flip-aware in one loop:
  • a perturbed sample that FLIPS eligibility contributes its full |ΔB| (τ = 0);
  • an interior sample contributes |ΔB| only if |ΔB| > τ (sub-tolerance wobble
    is excluded from the PER).

SECONDARY: the analytic 4-region coefficient table (§3). Used ONLY as a fast
pre-filter to skip households provably far from every boundary — never as the
score near a kink.
"""
from __future__ import annotations

import copy
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Iterable

from ..eligibility_engine import EligibilityEngine, Profile, Region
from ..rules.interfaces import IncomeSource

# Analytic ∂B/∂field by region (civica_accurate_number_model §3, v0.2). Signed.
# R-IV (flip) has no slope — score it as P(flip)×B* in the spine, not here.
# ⚠ Coefficients are FY-general derivatives; they are the PRE-FILTER, not the score.
_COEFFS: dict[str, dict[Region, Decimal]] = {
    "unearned": {Region.INTERIOR_UNCAPPED: Decimal("-0.45"), Region.CAPPED: Decimal("-0.30"), Region.SHELTER_ZERO: Decimal("-0.30")},
    "earned":   {Region.INTERIOR_UNCAPPED: Decimal("-0.36"), Region.CAPPED: Decimal("-0.24"), Region.SHELTER_ZERO: Decimal("-0.24")},
    "housing":  {Region.INTERIOR_UNCAPPED: Decimal("0.30"),  Region.CAPPED: Decimal("0.00"),  Region.SHELTER_ZERO: Decimal("0.00")},
}

FIELDS = tuple(_COEFFS.keys())


def analytic_coefficient(field: str, region: Region) -> Decimal | None:
    """The §3 pre-filter slope, or None if the field/region has no usable slope."""
    return _COEFFS.get(field, {}).get(region)


def with_field_delta(profile: Profile, field: str, delta: Decimal) -> Profile:
    """Return a copy of the profile with `field` shifted by `delta` (clamped ≥ 0)."""
    hh = profile.model_copy(deep=True)
    if field == "housing":
        hh.expenses.rent_or_mortgage = max(Decimal("0"), hh.expenses.rent_or_mortgage + delta)
        return hh
    is_earned = field == "earned"
    matching = [s for s in hh.income.sources if s.is_earned == is_earned]
    if matching:
        matching[0].monthly_gross = max(Decimal("0"), matching[0].monthly_gross + delta)
    elif delta > 0:
        hh.income.sources.append(IncomeSource(
            member_id=hh.members[0].member_id,
            source_type="wages" if is_earned else "other",
            monthly_gross=delta, is_earned=is_earned,
        ))
    return hh


@dataclass(frozen=True)
class SensitivityResult:
    field: str
    base_region: Region
    base_benefit: Decimal
    dollars_at_risk: Decimal     # τ-aware E[|ΔB|] over the error distribution
    flip_fraction: Decimal       # share of samples that flipped eligibility
    crossed_region: bool         # any sample changed region (the kink is live)
    n_samples: int


def perturb_and_rerun(
    engine: EligibilityEngine,
    profile: Profile,
    field: str,
    *,
    as_of_date: date,
    error_samples: Iterable[Decimal],
    tau: Decimal,
) -> SensitivityResult:
    samples = [Decimal(s) for s in error_samples]
    base = engine.determine(profile, as_of_date=as_of_date)
    base_b = base.B_star if base.B_star is not None else Decimal("0")

    contribs: list[Decimal] = []
    flips = 0
    crossed = False
    for d in samples:
        det = engine.determine(with_field_delta(profile, field, d), as_of_date=as_of_date)
        pb = det.B_star if det.B_star is not None else Decimal("0")
        abs_delta = abs(pb - base_b)
        flipped = det.eligible != base.eligible
        if det.region != base.region:
            crossed = True
        if flipped:
            flips += 1
            contribs.append(abs_delta)                       # flip → τ = 0, full
        else:
            contribs.append(abs_delta if abs_delta > tau else Decimal("0"))  # interior → τ-discount
    n = len(contribs) or 1
    return SensitivityResult(
        field=field,
        base_region=base.region,
        base_benefit=base_b,
        dollars_at_risk=(sum(contribs, Decimal("0")) / n),
        flip_fraction=(Decimal(flips) / n),
        crossed_region=crossed,
        n_samples=len(samples),
    )
