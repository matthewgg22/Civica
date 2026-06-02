"""§10108 (post-OBBBA) noncitizen eligibility resolution + the July-4 point-in-time boundary.

RESOLVED against the FNS "OBBB Implementation — Alien SNAP Eligibility" memo (2025-10-31).
§10108 removes refugees / asylees / withholding-of-removal / parolees / VAWA-self-petitioners,
effective ON ENACTMENT 2025-07-04 — NOT 2025-11-01. Mis-encoding that window produces wrong
determinations for the July–Oct 2025 cohort: exactly the point-in-time bug the framework exists
to prevent.

This resolver maps a member's granular ImmigrationStatus + as_of_date to an outcome and rewrites
the household so the rest of the engine does the work: ineligible members are flagged for
**regime-B exclusion** (→ §16 mixed-status proration), and eligible noncitizens are normalized to
QUALIFIED_NONCITIZEN so they pass the citizenship test. Identity if no member carries a status.

⚠ Validation flags:
  • LPR 5-year-bar logic is simplified (LPR treated eligible — confirm the bar/exception per case).
  • T-visa (trafficking) is CONTESTED: FNS grouped it with the removed humanitarian groups, now
    under litigation (21 states + DC). Taxonomy §7 says encode the operative default
    `ineligible-contested`; §13 says "do not encode." We take §7's operative default (exclude,
    flagged) — flip to pending/human-review if you prefer the conservative read.
"""
from __future__ import annotations

from datetime import date

from .interfaces import CitizenshipStatus, ExclusionReason, Household, ImmigrationStatus

OBBBA_10108_DATE = date(2025, 7, 4)  # §10108 enactment — the noncitizen-removal boundary

_ELIGIBLE_ALWAYS = {
    ImmigrationStatus.US_CITIZEN, ImmigrationStatus.US_NATIONAL, ImmigrationStatus.LPR,
    ImmigrationStatus.CUBAN_HAITIAN, ImmigrationStatus.COFA,
}
_INELIGIBLE_ALWAYS = {
    ImmigrationStatus.UNDOCUMENTED, ImmigrationStatus.DACA, ImmigrationStatus.TEMP_VISA,
    ImmigrationStatus.TPS, ImmigrationStatus.H2A,
}
_REMOVED_BY_10108 = {
    ImmigrationStatus.REFUGEE, ImmigrationStatus.ASYLEE, ImmigrationStatus.WITHHOLDING,
    ImmigrationStatus.PAROLEE, ImmigrationStatus.VAWA_SELF_PETITIONER,
}


def immigration_eligibility(status: ImmigrationStatus, as_of_date: date) -> str:
    """Resolve a status as-of a date → 'eligible' | 'ineligible' | 'contested' | 'pending'."""
    if status in _ELIGIBLE_ALWAYS:
        return "eligible"
    if status in _INELIGIBLE_ALWAYS:
        return "ineligible"
    if status in _REMOVED_BY_10108:
        # The point-in-time flip: eligible before §10108 enactment, removed on/after.
        return "ineligible" if as_of_date >= OBBBA_10108_DATE else "eligible"
    if status == ImmigrationStatus.T_VISA:
        return "contested"
    return "pending"  # UNKNOWN / unresolved


def resolve_immigration(hh: Household, as_of_date: date) -> Household:
    """Rewrite the household per §10108 as-of date. Identity if no member carries a status."""
    if not any(m.immigration_status is not None for m in hh.members):
        return hh
    new_members = []
    for m in hh.members:
        if m.immigration_status is None or m.eligibility_exclusion is not None:
            new_members.append(m)
            continue
        outcome = immigration_eligibility(m.immigration_status, as_of_date)
        if outcome in ("ineligible", "contested"):
            # Excluded → §16 regime-B proration (mixed-status). Contested = operative default.
            new_members.append(m.model_copy(update={"eligibility_exclusion": ExclusionReason.INELIGIBLE_NONCITIZEN}))
        elif outcome == "eligible":
            cit = (CitizenshipStatus.US_CITIZEN
                   if m.immigration_status in (ImmigrationStatus.US_CITIZEN, ImmigrationStatus.US_NATIONAL)
                   else CitizenshipStatus.QUALIFIED_NONCITIZEN)
            new_members.append(m.model_copy(update={"citizenship": cit}))
        else:  # pending → citizenship test surfaces insufficient information
            new_members.append(m.model_copy(update={"citizenship": CitizenshipStatus.UNKNOWN}))
    return hh.model_copy(update={"members": new_members})
