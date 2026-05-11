"""Deterministic SNAP eligibility rules engine.

No LLM calls in this package. Every output here is auditable, replayable,
and effective-dated. If you find yourself reaching for an LLM inside
rules/, you're in the wrong package — that work belongs in pipeline/.
"""

from .interfaces import (
    EligibilityResult,
    EligibilityStatus,
    ExpenseFacts,
    Household,
    HouseholdMember,
    IncomeFacts,
    RequiredVerification,
)

__all__ = [
    "EligibilityResult",
    "EligibilityStatus",
    "ExpenseFacts",
    "Household",
    "HouseholdMember",
    "IncomeFacts",
    "RequiredVerification",
]
