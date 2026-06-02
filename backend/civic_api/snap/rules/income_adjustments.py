"""§20 income adjustments — minor-student earnings exclusion.

Wages of a household member UNDER 18 who is an elementary/secondary student are
EXCLUDED from income entirely (7 CFR 273.9(c)(7)) — a common over-count that shrinks
the benefit. The member still counts in household size; only their earned income is
dropped. Identity if no such member has earned income.

⚠ v1: keys off `age < 18` AND an enrolled `student_status`. The student_status enum was
designed for the higher-ed student rule (273.5); for a K-12 minor it is used here as the
"is a student" signal — set it for minors in intake, or extend the model with an explicit
elementary/secondary flag.
"""
from __future__ import annotations

from .interfaces import Household, IncomeFacts, StudentStatus

_ENROLLED = {StudentStatus.ENROLLED_HALF_TIME_OR_MORE, StudentStatus.ENROLLED_LESS_THAN_HALF_TIME}


def exclude_minor_student_earnings(hh: Household) -> Household:
    minor_students = {
        m.member_id for m in hh.members if m.age < 18 and m.student_status in _ENROLLED
    }
    if not minor_students:
        return hh
    kept = [s for s in hh.income.sources if not (s.is_earned and s.member_id in minor_students)]
    if len(kept) == len(hh.income.sources):
        return hh
    return hh.model_copy(update={"income": IncomeFacts(sources=kept)})
