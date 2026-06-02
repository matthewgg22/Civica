"""§16 proration — the countable-household transform for excluded/ineligible members.

An excluded member is not simply dropped: per 7 CFR 273.11 a share of their income
still flows to the eligible unit, while their needs leave household size. Instead of
threading this through every test method, we transform the `Household` ONCE into the
countable view and run the unchanged determination on it. That way federal AND state
rules — and the scoring spine's perturb-and-re-run — all price proration, including
the **region transition** §16 warns about (proration can move R_capped → R_interior),
for free.

Regimes (taxonomy §16):
  A (full count): IPV · work-requirement · SSN-noncompliance · fleeing-felon · drug-felony
     → income counts in full (the 20% earned deduction still applies); billed
     deductions retained (7 CFR 273.11(c)(2)).
  B (prorated):   ineligible-noncitizen · SSN-refuser
     → income × f and billed shelter/dependent-care × f, f = n_eligible / n_total
     (7 CFR 273.11(c)(1)).
  Both: the member's needs are excluded from household size.

IDENTITY when there are no exclusions (f = 1, eligible = all) — ordinary determinations
are byte-identical.

⚠ v1 simplifications to validate against primary source:
  • regime-A deduction treatment — taxonomy §16 says "remaining share counts"; we follow
    273.11(c)(2) "retained in entirety" (deductions NOT prorated for regime A).
  • medical / child-support / SUA-tier deductions and assets are NOT prorated yet.
"""
from __future__ import annotations

from decimal import Decimal

from .interfaces import ExclusionReason, Household, IncomeFacts, IncomeSource

_REGIME_A = {
    ExclusionReason.IPV, ExclusionReason.WORK_REQUIREMENT, ExclusionReason.SSN_NONCOMPLIANCE,
    ExclusionReason.FLEEING_FELON, ExclusionReason.DRUG_FELONY,
}
_REGIME_B = {ExclusionReason.INELIGIBLE_NONCITIZEN, ExclusionReason.SSN_REFUSER}


def eligible_members(hh: Household) -> list:
    return [m for m in hh.members if m.eligibility_exclusion is None]


def has_exclusions(hh: Household) -> bool:
    return any(m.eligibility_exclusion is not None for m in hh.members)


def countable_household(hh: Household) -> Household:
    """Collapse a household with excluded members to its countable view. Identity if none."""
    if not has_exclusions(hh):
        return hh

    elig = eligible_members(hh)
    if not elig:
        # No eligible members → empty unit; determine_eligibility returns ineligible.
        return hh.model_copy(deep=True, update={"members": []})

    n_total = len(hh.members)
    n_b = sum(1 for m in hh.members if m.eligibility_exclusion in _REGIME_B)
    f_income_b = Decimal(len(elig)) / Decimal(n_total)        # regime-B income weight
    f_ded = Decimal(n_total - n_b) / Decimal(n_total)         # billed-deduction proration (removes regime-B share)
    excl = {m.member_id: m.eligibility_exclusion for m in hh.members}
    anchor = elig[0].member_id

    # Eligible members' own income, unchanged.
    sources = [s.model_copy(deep=True) for s in hh.income.sources if excl.get(s.member_id) is None]

    # Counted income from excluded members, by regime, split earned/unearned, attached to anchor.
    add_earned = Decimal("0")
    add_unearned = Decimal("0")
    for s in hh.income.sources:
        reason = excl.get(s.member_id)
        if reason is None:
            continue
        weight = Decimal("1") if reason in _REGIME_A else f_income_b
        amount = s.monthly_gross * weight
        if s.is_earned:
            add_earned += amount
        else:
            add_unearned += amount
    if add_earned > 0:
        sources.append(IncomeSource(member_id=anchor, source_type="prorated_excluded_earned",
                                    monthly_gross=add_earned, is_earned=True))
    if add_unearned > 0:
        sources.append(IncomeSource(member_id=anchor, source_type="prorated_excluded_unearned",
                                    monthly_gross=add_unearned, is_earned=False))

    exp = hh.expenses.model_copy(deep=True)
    if f_ded != Decimal("1"):
        exp.rent_or_mortgage = exp.rent_or_mortgage * f_ded
        exp.property_taxes = exp.property_taxes * f_ded
        exp.homeowners_insurance = exp.homeowners_insurance * f_ded
        exp.utilities_actual = exp.utilities_actual * f_ded
        exp.dependent_care = exp.dependent_care * f_ded
        # ⚠ medical / child_support / sua_tier not prorated (v1)

    return hh.model_copy(deep=True, update={
        "members": [m.model_copy(deep=True) for m in elig],
        "income": IncomeFacts(sources=sources),
        "expenses": exp,
    })
