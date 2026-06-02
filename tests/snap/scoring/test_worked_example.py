"""End-to-end worked example near the shelter cap (civica_accurate_number_model §4).

The point: an earned-income error pushes the household ACROSS the shelter cap, so
the linear coefficient (read at the capped estimate point, ∂B/∂E = −0.24)
UNDERESTIMATES the true error vs perturb-and-re-run (which crosses into R-I,
slope −0.36). This is why perturb-and-re-run is the primary sensitivity.

FY2025 params (the only loaded year). HH3, BBCE (CA), non-elderly. H = $1,360.
  estimate E=$1,800 → A=1236, S=clamp(1360−618)=712 (CAPPED), N=524, B̂=768−157=611
  truth    E=$2,100 → A=1476, S=1360−738=622 (R-I),     N=854, B*=768−256=512
  realized error |B̂−B*| = $99 ;  linear predicts 0.24×300 = $72  (underestimate)
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from backend.civic_api.snap.eligibility_engine import EligibilityEngine, Region
from backend.civic_api.snap.rules.interfaces import (
    AssetFacts, CitizenshipStatus, ExpenseFacts, Household, HouseholdMember,
    IncomeFacts, IncomeSource,
)
from backend.civic_api.snap.scoring.clarification import build_clarification
from backend.civic_api.snap.scoring.priors import InputUncertainty
from backend.civic_api.snap.scoring.sensitivity import analytic_coefficient, perturb_and_rerun
from backend.civic_api.snap.scoring.spine import rank_clarifications

AS_OF = date(2025, 3, 15)


def _hh(earned):
    return Household(
        state="CA",
        members=[HouseholdMember(member_id="m1", age=40, is_applicant=True, citizenship=CitizenshipStatus.US_CITIZEN),
                 HouseholdMember(member_id="m2", age=10), HouseholdMember(member_id="m3", age=8)],
        income=IncomeFacts(sources=[IncomeSource(member_id="m1", source_type="wages", monthly_gross=Decimal(str(earned)), is_earned=True)]),
        expenses=ExpenseFacts(rent_or_mortgage=Decimal("1360")),
        assets=AssetFacts(),
    )


def test_linear_underestimates_across_the_cap():
    engine = EligibilityEngine()
    est = engine.determine(_hh(1800), as_of_date=AS_OF)
    truth = engine.determine(_hh(2100), as_of_date=AS_OF)

    # estimate sits capped; truth crosses below the cap into the interior.
    assert est.region == Region.CAPPED
    assert truth.region == Region.INTERIOR_UNCAPPED

    perturb_dollars = abs(est.B_star - truth.B_star)                      # actual finite-difference
    analytic_dollars = abs(analytic_coefficient("earned", Region.CAPPED)) * Decimal("300")  # 0.24×300

    assert analytic_dollars == Decimal("72.00")
    assert perturb_dollars > analytic_dollars                            # the kink the linear can't see
    assert perturb_dollars == Decimal("99")                              # 611 − 512

    # perturb-and-re-run over the single true δ reproduces the realized error and flags the crossing.
    sens = perturb_and_rerun(engine, _hh(1800), "earned", as_of_date=AS_OF,
                             error_samples=[Decimal("300")], tau=Decimal("58"))
    assert sens.dollars_at_risk == Decimal("99")
    assert sens.crossed_region is True


def test_clarification_ranks_earned_top_and_is_amount_firewalled():
    engine = EligibilityEngine()
    # Earned income wobbles (stubs disagree); housing is on a verified lease (no wobble).
    unc = InputUncertainty(
        error_samples={"earned": [Decimal("300"), Decimal("-150"), Decimal("150")], "housing": [], "unearned": []},
        p_wrong={"earned": Decimal("0.6"), "housing": Decimal("0.1"), "unearned": Decimal("0.0")},
    )
    ranked = rank_clarifications(engine, _hh(1800), as_of_date=AS_OF, uncertainty=unc)
    assert ranked[0].label == "earned"                       # top clarification
    housing = next(u for u in ranked if u.label == "housing")
    assert housing.dollars_at_risk == Decimal("0")           # R-II: ∂B/∂H = 0 → don't ask about utilities

    # Integrity firewall: the surfaced clarification carries no benefit amount/direction.
    clar = build_clarification("earned")
    assert clar.reason_code == "income_variable"
    assert "$" not in clar.prompt_en and "benefit" not in clar.prompt_en.lower()
    assert "99" not in clar.prompt_en
