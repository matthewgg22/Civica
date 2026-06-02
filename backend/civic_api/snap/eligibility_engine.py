"""The shared EligibilityEngine — the one calculator both wings call.

`determine(profile, as_of_date) -> Determination` is a pure function: it wraps
the existing deterministic rules classes (federal + state subclasses — the
single source of determination math), resolves rules from the dated parameter
table, and enriches the result with the **4-way region** and the **cited trace**
the scoring spine needs. It re-implements nothing: B* and eligibility come
straight from `determine_eligibility`; region is read off `excess_shelter` + the
shelter cap; the trace is the engine's `test_outcomes` + the citation registry.

Both downstream wings (prevention = pre-determination clarification; error-rate =
post-hoc scoring) call THIS. Neither recomputes the benefit.

Region (the §4.3 4-way classifier), on the realized determination:
  INTERIOR_UNCAPPED  R-I   : eligible, 0 < S < cap  (incl. all elderly/disabled — uncapped)
  CAPPED             R-II  : eligible, S == cap (non-elderly/disabled)
  SHELTER_ZERO       R-III : eligible, S == 0 (shelter < 50% of adjusted income)
  BOUNDARY_FLIP      R-IV  : ineligible (an eligibility flip — $0)
The flip *risk* for an eligible case near a gate (p_flip) is a SCORING-SPINE
concern computed from the gate margins exposed here + input uncertainty — not an
engine classification, so the engine stays deterministic.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from enum import Enum

from .rules.citations import citation_for
from .rules.federal import FederalSNAPRules
from .rules.interfaces import EligibilityResult, EligibilityStatus, Household
from .rules.parameters import params_for
from .rules.states.california import CaliforniaSNAPRules
from .rules.states.massachusetts import MassachusettsSNAPRules

Profile = Household  # the engine input; point values only (uncertainty lives in the spine)

_STATE_RULES: dict[str, type[FederalSNAPRules]] = {
    "CA": CaliforniaSNAPRules,
    "MA": MassachusettsSNAPRules,
}
_ELIGIBLE = {EligibilityStatus.ELIGIBLE, EligibilityStatus.ELIGIBLE_WITH_CONDITIONS}


class Region(str, Enum):
    # Canonical condition-names per civica_special_category_taxonomy §17 — the
    # values are the labels used everywhere (persisted/displayed), which kills the
    # R-III/R-IV numbering drift the taxonomy flags as an integration bug.
    INTERIOR_UNCAPPED = "R_interior"
    CAPPED = "R_capped"
    SHELTER_ZERO = "R_zeroshelter"
    BOUNDARY_FLIP = "R_flip"


@dataclass(frozen=True)
class TraceRow:
    seq: int
    rule_id: str
    citation_id: str | None
    predicate_result: bool
    threshold: Decimal | None
    actual: Decimal | None
    notes: str | None


@dataclass(frozen=True)
class Breakdown:
    """Determination intermediates the spine reads (derived from the engine's own
    itemized output — not recomputed from rules)."""
    adjusted_income: Decimal | None      # A = gross − earned_ded − SD − dep_care − medical − child_support
    excess_shelter: Decimal | None       # S
    raw_excess_shelter: Decimal | None   # H − 0.5A; recoverable only in R-I (= S), else None
    net_income: Decimal | None           # N
    shelter_cap: Decimal                 # from the dated param table
    cap_applied: bool
    elderly_or_disabled: bool
    gross_margin: Decimal | None         # gross threshold − actual  (≥0 ⇒ under the gate)
    net_margin: Decimal | None           # net threshold − actual


@dataclass(frozen=True)
class Determination:
    profile_state: str
    B_star: Decimal | None
    eligible: bool
    status: EligibilityStatus
    region: Region
    breakdown: Breakdown
    trace: list[TraceRow] = field(default_factory=list)
    ineligibility_reason: str | None = None
    ruleset_version: str = ""
    as_of_date: date | None = None
    fy: int | None = None


def _rules_for(state: str, as_of: date) -> FederalSNAPRules:
    return _STATE_RULES.get((state or "").upper(), FederalSNAPRules)(effective_date=as_of)


def _margin(result: EligibilityResult, prefix: str) -> Decimal | None:
    for t in result.test_outcomes:
        if t.test_name.startswith(prefix) and t.threshold is not None and t.actual is not None:
            return t.threshold - t.actual
    return None


def _classify_region(result: EligibilityResult, eligible: bool, cap: Decimal,
                     elderly_disabled: bool) -> Region:
    if not eligible or result.benefit_calculation is None:
        return Region.BOUNDARY_FLIP
    s = result.benefit_calculation.excess_shelter_deduction
    if s == 0:
        return Region.SHELTER_ZERO
    if not elderly_disabled and s == cap:
        return Region.CAPPED
    return Region.INTERIOR_UNCAPPED


def _build_breakdown(result: EligibilityResult, cap: Decimal, elderly_disabled: bool,
                    region: Region) -> Breakdown:
    bc = result.benefit_calculation
    adjusted = excess = raw = net = None
    cap_applied = False
    if bc is not None:
        adjusted = (
            bc.gross_monthly_income - bc.earned_income_deduction - bc.standard_deduction
            - bc.dependent_care_deduction - bc.medical_deduction - bc.child_support_deduction
        )
        excess = bc.excess_shelter_deduction
        net = bc.net_monthly_income
        cap_applied = (not elderly_disabled) and excess == cap
        raw = excess if region == Region.INTERIOR_UNCAPPED else None
    return Breakdown(
        adjusted_income=adjusted, excess_shelter=excess, raw_excess_shelter=raw,
        net_income=net, shelter_cap=cap, cap_applied=cap_applied,
        elderly_or_disabled=elderly_disabled,
        gross_margin=_margin(result, "gross_income"), net_margin=_margin(result, "net_income"),
    )


class EligibilityEngine:
    """Pure, versioned, point-in-time. Both wings depend on this one object."""

    def determine(self, profile: Profile, *, as_of_date: date) -> Determination:
        result = _rules_for(profile.state, as_of_date).determine_eligibility(profile)
        params = params_for(as_of_date)
        eligible = result.status in _ELIGIBLE
        elderly_disabled = profile.has_elderly_or_disabled
        region = _classify_region(result, eligible, params.excess_shelter_cap, elderly_disabled)
        trace = [
            TraceRow(
                seq=i, rule_id=t.test_name, citation_id=citation_for(t.test_name),
                predicate_result=t.passes, threshold=t.threshold, actual=t.actual,
                notes=t.notes or None,
            )
            for i, t in enumerate(result.test_outcomes)
        ]
        return Determination(
            profile_state=profile.state,
            B_star=result.monthly_benefit,
            eligible=eligible,
            status=result.status,
            region=region,
            breakdown=_build_breakdown(result, params.excess_shelter_cap, elderly_disabled, region),
            trace=trace,
            ineligibility_reason=result.ineligibility_reason,
            ruleset_version=result.rules_version,
            as_of_date=as_of_date,
            fy=params.fiscal_year,
        )
