"""§11 verification-status axis — the integrity engine's strongest single predictor.

Per-fact evidence state (FNS/QC vocabulary) and its P(error) prior. Postponed
verification is the canonical OVERPAYMENT vector; self-attested income is the
canonical agency↔client tilt; documentary / interface-matched facts are low-risk.

⚠ Flags:
  • These P(error) priors are PLACEHOLDERS (population-level, not gold-standard
    validated) — like all p_error priors, no published rate rides on them.
  • The full verification STATE (postponed / pending-SAVE / refused) is a §14
    intake-detection gap: today only the answer-source ORIGIN is captured, so
    from_answer_source() is a best-effort SEED. Capturing true verification state
    is the highest-value intake addition for the integrity engine (§22).
"""
from __future__ import annotations

from decimal import Decimal
from enum import Enum


class EvidenceClass(str, Enum):
    DOCUMENTARY = "documentary"
    INTERFACE_MATCH = "interface_match"
    ATTESTATION = "attestation"


class VerificationStatus(str, Enum):
    DOCUMENTED = "documented"
    INTERFACE_MATCHED = "interface_matched"
    SELF_ATTESTED = "self_attested"
    POSTPONED = "postponed"          # expedited: verify-later — canonical overpayment vector
    PENDING_SAVE = "pending_save"    # immigration verification not yet returned
    REFUSED = "refused"


_EVIDENCE_CLASS = {
    VerificationStatus.DOCUMENTED: EvidenceClass.DOCUMENTARY,
    VerificationStatus.INTERFACE_MATCHED: EvidenceClass.INTERFACE_MATCH,
    VerificationStatus.SELF_ATTESTED: EvidenceClass.ATTESTATION,
    VerificationStatus.POSTPONED: EvidenceClass.ATTESTATION,
    VerificationStatus.PENDING_SAVE: EvidenceClass.INTERFACE_MATCH,
    VerificationStatus.REFUSED: EvidenceClass.ATTESTATION,
}

# ⚠ PLACEHOLDER P(error) priors keyed on verification status (the strongest predictor).
_P_ERROR = {
    VerificationStatus.DOCUMENTED: Decimal("0.03"),
    VerificationStatus.INTERFACE_MATCHED: Decimal("0.05"),
    VerificationStatus.SELF_ATTESTED: Decimal("0.30"),
    VerificationStatus.PENDING_SAVE: Decimal("0.35"),
    VerificationStatus.POSTPONED: Decimal("0.45"),   # postponed verification → elevated overpayment
    VerificationStatus.REFUSED: Decimal("0.50"),
}

# Relative error-proneness by field (§8 — income is the wobbliest channel).
_FIELD_FACTOR = {"earned": Decimal("1.0"), "unearned": Decimal("0.7"), "housing": Decimal("0.8")}


def evidence_class_of(status: VerificationStatus) -> EvidenceClass:
    return _EVIDENCE_CLASS[status]


def p_error_for_verification(status: VerificationStatus, field: str | None = None) -> Decimal:
    """P(field is wrong) driven by verification status (primary) × field factor."""
    base = _P_ERROR[status]
    factor = _FIELD_FACTOR.get(field, Decimal("0.6")) if field else Decimal("1")
    val = base * factor
    return val if val < Decimal("1") else Decimal("1")


# Bridge: the adapter's `answer_source` origin → a best-effort verification status.
_FROM_ANSWER_SOURCE = {
    "applicant_input": VerificationStatus.SELF_ATTESTED,
    "ocr_extraction": VerificationStatus.DOCUMENTED,   # document-backed (extraction confidence is a separate signal)
    "navigator_entry": VerificationStatus.DOCUMENTED,  # staff-confirmed
    "prefilled": VerificationStatus.INTERFACE_MATCHED,
}


def from_answer_source(source: str | None) -> VerificationStatus:
    return _FROM_ANSWER_SOURCE.get(source or "", VerificationStatus.SELF_ATTESTED)
