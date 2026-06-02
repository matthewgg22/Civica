"""Scoring-spine unit tests: flip scoring, work-requirement class, lanes, tier, integrity monitor."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from backend.civic_api.snap.eligibility_engine import EligibilityEngine, Region
from backend.civic_api.snap.rules.interfaces import (
    AssetFacts, CitizenshipStatus, ExpenseFacts, Household, HouseholdMember,
    IncomeFacts, IncomeSource,
)
from backend.civic_api.snap.scoring.clarification import SymmetricPromptMonitor
from backend.civic_api.snap.scoring.priors import p_flip
from backend.civic_api.snap.scoring.spine import (
    Lane, Origin, ScoringUnit, assign_lanes, score_work_requirement,
)
from backend.civic_api.snap.scoring.tier import tier_weight

AS_OF = date(2025, 3, 15)


def _fed_hh(earned):
    return Household(
        state="TX",
        members=[HouseholdMember(member_id="m1", age=40, is_applicant=True, citizenship=CitizenshipStatus.US_CITIZEN)],
        income=IncomeFacts(sources=[IncomeSource(member_id="m1", source_type="wages", monthly_gross=Decimal(str(earned)), is_earned=True)]),
        expenses=ExpenseFacts(), assets=AssetFacts(),
    )


def test_p_flip_detects_gross_gate_crossing():
    engine = EligibilityEngine()
    # HH1 federal gross gate ≈ $1,632 (130% FPL). Estimate $1,600 (eligible).
    # Samples that push over the gate flip eligibility.
    pf = p_flip(engine, _fed_hh(1600), "earned", as_of_date=AS_OF,
                error_samples=[Decimal("100"), Decimal("-50"), Decimal("200")])
    assert pf > Decimal("0")           # +100 and +200 cross $1,632 → flip; −50 does not
    assert pf == Decimal("2") / Decimal("3")


def test_work_requirement_scored_as_flip():
    engine = EligibilityEngine()
    det = engine.determine(_fed_hh(800), as_of_date=AS_OF)   # eligible, some B*
    assert det.B_star is not None and det.B_star > 0
    unit = score_work_requirement(det, p_status_error=Decimal("0.25"), state_per=None)
    assert unit.region == Region.BOUNDARY_FLIP
    assert unit.value == Decimal("0.25") * det.B_star * Decimal("1")   # tier mid = 1


def test_tier_weight_near_edge_vs_mid():
    assert tier_weight(Decimal("8.0")) == Decimal("3")    # at a §10105 tier step
    assert tier_weight(Decimal("7.0")) == Decimal("1")    # mid-tier
    assert tier_weight(None) == Decimal("1")              # unknown → neutral
    assert tier_weight(Decimal("13.32")) == Decimal("3")  # the exemption cliff is "live"
    assert tier_weight(Decimal("15.0")) == Decimal("0")   # already exempt → no marginal liability


def _unit(value):
    return ScoringUnit("case", "c", Region.INTERIOR_UNCAPPED, Decimal("0.3"),
                       Decimal(str(value)), Decimal("1"), Decimal(str(value)))


def test_assign_lanes_three_lanes():
    units = [_unit(10), _unit(200), _unit(40), _unit(5)]
    laned = assign_lanes(units, capacity=2, hold_threshold=Decimal("150"))
    by_value = {u.value: u.lane for u in laned}
    assert by_value[Decimal("200")] == Lane.AUTO_HOLD       # ≥ hold_threshold
    assert by_value[Decimal("40")] == Lane.HUMAN_REVIEW     # within top-k capacity
    assert by_value[Decimal("5")] == Lane.AUTO_CLEAR        # beyond capacity


def test_symmetric_prompt_monitor_throttle():
    mon = SymmetricPromptMonitor(max_skew=0.65, min_n=20)
    for _ in range(18):
        mon.record(benefit_raising=True)
    for _ in range(4):
        mon.record(benefit_raising=False)
    assert mon.skew > 0.65 and (mon.raising + mon.lowering) >= 20
    assert mon.throttled() is True
