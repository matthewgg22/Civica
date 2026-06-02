"""The router — rank units by Value = P(error) × $-at-risk × tier_weight, assign lanes.

ONE spine, both wings:
  • prevention wing → score_field / rank_clarifications  (units = input fields)
  • error-rate wing → score_case                          (units = paid cases)
  • work-requirement (§10102) → score_work_requirement    (a non-financial flip)

$-at-risk comes from perturb-and-re-run (interior + flip + τ unified). Flips are
commensurable with interior amount errors on one dollar scale — which is what
makes BBCE (a gross-threshold flip, Civica's biggest QC signal) *scorable*.
"""
from __future__ import annotations

from dataclasses import dataclass, field as dfield
from datetime import date
from decimal import Decimal
from enum import Enum

from ..eligibility_engine import Determination, EligibilityEngine, Profile, Region
from ..rules.parameters import params_for
from .priors import InputUncertainty
from .sensitivity import FIELDS, perturb_and_rerun
from .tier import tier_weight as default_tier_weight


class Lane(str, Enum):
    AUTO_CLEAR = "auto_clear"
    HUMAN_REVIEW = "human_review"
    AUTO_HOLD = "auto_hold"


class Origin(str, Enum):
    RANDOM = "random"      # the ONLY arm rate math may use (matrix §5)
    TARGETED = "targeted"  # review/clarification queue — never feeds a reported rate


@dataclass
class ScoringUnit:
    unit_kind: str                 # "field" | "case" | "work_requirement"
    label: str
    region: Region
    p_error: Decimal
    dollars_at_risk: Decimal
    tier_weight: Decimal
    value: Decimal
    origin: Origin = Origin.TARGETED
    lane: Lane | None = None
    detail: dict = dfield(default_factory=dict)


def score_field(
    engine: EligibilityEngine, profile: Profile, fld: str, *,
    as_of_date: date, uncertainty: InputUncertainty,
    state_per: Decimal | None = None, origin: Origin = Origin.TARGETED,
) -> ScoringUnit:
    tau = params_for(as_of_date).tolerance_tau
    sens = perturb_and_rerun(
        engine, profile, fld, as_of_date=as_of_date,
        error_samples=uncertainty.samples(fld), tau=tau,
    )
    pe = uncertainty.p_error(fld)
    tw = default_tier_weight(state_per)
    return ScoringUnit(
        unit_kind="field", label=fld, region=sens.base_region,
        p_error=pe, dollars_at_risk=sens.dollars_at_risk, tier_weight=tw,
        value=pe * sens.dollars_at_risk * tw, origin=origin,
        detail={"flip_fraction": str(sens.flip_fraction), "crossed_region": sens.crossed_region},
    )


def score_work_requirement(
    determination: Determination, *, p_status_error: Decimal,
    state_per: Decimal | None = None, origin: Origin = Origin.TARGETED,
) -> ScoringUnit:
    """§10102 work-requirement flip — a $0 eligibility flip from a NON-financial
    determinant the financial regions can't represent. Scored P(status error)×B*
    (τ = 0), commensurable with the rest."""
    b = determination.B_star or Decimal("0")
    tw = default_tier_weight(state_per)
    return ScoringUnit(
        unit_kind="work_requirement", label="abawd_status", region=Region.BOUNDARY_FLIP,
        p_error=p_status_error, dollars_at_risk=b, tier_weight=tw,
        value=p_status_error * b * tw, origin=origin,
        detail={"class": "§10102 work-requirement flip"},
    )


def score_case(
    engine: EligibilityEngine, profile: Profile, *,
    as_of_date: date, uncertainty: InputUncertainty,
    state_per: Decimal | None = None, origin: Origin = Origin.RANDOM,
) -> ScoringUnit:
    """Error-rate wing: a paid CASE's expected error-dollars = the worst field's
    $-at-risk, weighted by P(any field wrong). One case = one unit (matrix §3)."""
    field_units = [
        score_field(engine, profile, f, as_of_date=as_of_date, uncertainty=uncertainty,
                    state_per=state_per, origin=origin)
        for f in FIELDS
    ]
    top = max(field_units, key=lambda u: u.value, default=None)
    if top is None:
        det = engine.determine(profile, as_of_date=as_of_date)
        return ScoringUnit("case", "case", det.region, Decimal("0"), Decimal("0"),
                           default_tier_weight(state_per), Decimal("0"), origin)
    return ScoringUnit(
        unit_kind="case", label="case", region=top.region,
        p_error=top.p_error, dollars_at_risk=top.dollars_at_risk, tier_weight=top.tier_weight,
        value=top.value, origin=origin,
        detail={"driver_field": top.label, "fields": {u.label: str(u.value) for u in field_units}},
    )


def rank_clarifications(
    engine: EligibilityEngine, profile: Profile, *,
    as_of_date: date, uncertainty: InputUncertainty,
    state_per: Decimal | None = None, fields: tuple[str, ...] = FIELDS,
) -> list[ScoringUnit]:
    units = [
        score_field(engine, profile, f, as_of_date=as_of_date, uncertainty=uncertainty, state_per=state_per)
        for f in fields
    ]
    units.sort(key=lambda u: u.value, reverse=True)
    return units


def assign_lanes(
    units: list[ScoringUnit], *, capacity: int, hold_threshold: Decimal | None = None,
) -> list[ScoringUnit]:
    """Recall-favoring, case-level: top-k (= reviewer budget) → human_review;
    value ≥ hold_threshold → auto_hold; the rest → auto_clear."""
    ordered = sorted(units, key=lambda u: u.value, reverse=True)
    for i, u in enumerate(ordered):
        if hold_threshold is not None and u.value >= hold_threshold:
            u.lane = Lane.AUTO_HOLD
        elif i < capacity:
            u.lane = Lane.HUMAN_REVIEW
        else:
            u.lane = Lane.AUTO_CLEAR
    return ordered
