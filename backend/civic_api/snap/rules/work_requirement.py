"""§10102 work requirements — derived work_class + the ABAWD time-limit flip.

work_class is a DERIVED classification (never caseworker input): the engine computes it
from age × dependents × disability × hours × waivers, so a wrong ABAWD call cannot enter
as a fact and can be checked against the rulebook (taxonomy §0).

ABAWD = able-bodied adult without dependents, age 18–64 (OBBBA raised the ceiling from 54).
Limited to 3 countable months of benefits in 36 unless meeting 80 hrs/month. A timeout is a
$0 eligibility flip from a NON-financial determinant — modeled by excluding the member under
regime A (work-requirement disqualification), which composes with §16 proration.

DATE-VERSIONED (OBBBA §10102, effective 2025-11-01):
  • ABAWD age ceiling 54 → 64 (so 55–64 became subject on that date — the seam).
  • Exemptions REMOVED for homeless / veterans / former-foster-youth ≤24 (exempt before, subject after).
  • Tribal members GAINED an exemption.

⚠ v1 simplifications: caregiver-of-child-under-14 exemption applies to ALL adults in a
household containing a child <14 (not just the designated caregiver); the general
work-requirement (16–59 registration) is not modeled as a determination consequence; the
3-in-36 clock is READ from abawd_countable_months_used, not tracked over time.
"""
from __future__ import annotations

from datetime import date
from enum import Enum

from .interfaces import ExclusionReason, Household, HouseholdMember

ABAWD_EXEMPTION_REMOVAL_DATE = date(2025, 11, 1)  # OBBBA §10102 effective date
ABAWD_MONTH_LIMIT = 3
ABAWD_HOURS_THRESHOLD = 80


class WorkClass(str, Enum):
    EXEMPT = "exempt"
    ABAWD_SUBJECT = "abawd_subject"


def derive_work_class(member: HouseholdMember, household: Household, as_of_date: date) -> WorkClass:
    removed = as_of_date >= ABAWD_EXEMPTION_REMOVAL_DATE
    if member.age < 18 or member.age >= 65:
        return WorkClass.EXEMPT
    if member.is_disabled or member.is_pregnant or member.is_tribal_member or member.in_abawd_waived_area:
        return WorkClass.EXEMPT
    if any(m.age < 14 for m in household.members):           # caregiver of a child <14 (v1: any adult)
        return WorkClass.EXEMPT
    if not removed and (household.is_homeless or member.is_veteran or member.is_former_foster_youth):
        return WorkClass.EXEMPT                              # OBBBA-removed exemptions, still in force pre-2025-11-01
    ceiling = 64 if removed else 54                          # OBBBA raised the ABAWD age ceiling
    if 18 <= member.age <= ceiling:
        return WorkClass.ABAWD_SUBJECT
    return WorkClass.EXEMPT                                  # 55–64 pre-OBBBA: above old ceiling, under 65 → exempt


def abawd_timed_out(member: HouseholdMember, household: Household, as_of_date: date) -> bool:
    """An ABAWD-subject member past the 3-month limit and under 80 hrs/mo has timed out."""
    if derive_work_class(member, household, as_of_date) != WorkClass.ABAWD_SUBJECT:
        return False
    if member.monthly_work_hours >= ABAWD_HOURS_THRESHOLD:   # meeting the work requirement
        return False
    return member.abawd_countable_months_used >= ABAWD_MONTH_LIMIT


def resolve_work_requirements(hh: Household, as_of_date: date) -> Household:
    """Exclude ABAWD members who have timed out (regime-A disqualification → §16 proration).
    Identity unless a member is ABAWD-subject AND past the 3-month limit AND under 80 hrs."""
    if not any(abawd_timed_out(m, hh, as_of_date) for m in hh.members):
        return hh
    new_members = [
        m.model_copy(update={"eligibility_exclusion": ExclusionReason.WORK_REQUIREMENT})
        if (m.eligibility_exclusion is None and abawd_timed_out(m, hh, as_of_date)) else m
        for m in hh.members
    ]
    return hh.model_copy(update={"members": new_members})
