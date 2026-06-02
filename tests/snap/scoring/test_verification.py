"""§11 verification-status axis tests — the integrity engine's strongest predictor."""
from __future__ import annotations

from decimal import Decimal

from backend.civic_api.snap.scoring.priors import InputUncertainty
from backend.civic_api.snap.scoring.verification import (
    EvidenceClass, VerificationStatus, evidence_class_of, from_answer_source,
    p_error_for_verification,
)


def test_p_error_ordering_postponed_and_refused_highest():
    pe = lambda s: p_error_for_verification(s, "earned")
    assert pe(VerificationStatus.DOCUMENTED) < pe(VerificationStatus.INTERFACE_MATCHED)
    assert pe(VerificationStatus.INTERFACE_MATCHED) < pe(VerificationStatus.SELF_ATTESTED)
    assert pe(VerificationStatus.SELF_ATTESTED) < pe(VerificationStatus.POSTPONED)
    assert pe(VerificationStatus.POSTPONED) <= pe(VerificationStatus.REFUSED)
    # postponed verification = canonical overpayment vector → far above documented
    assert pe(VerificationStatus.POSTPONED) > pe(VerificationStatus.DOCUMENTED) * 10


def test_income_is_the_wobbliest_field():
    s = VerificationStatus.SELF_ATTESTED
    assert p_error_for_verification(s, "earned") > p_error_for_verification(s, "unearned")
    assert p_error_for_verification(s, "earned") > p_error_for_verification(s, "housing")


def test_evidence_class_mapping():
    assert evidence_class_of(VerificationStatus.DOCUMENTED) == EvidenceClass.DOCUMENTARY
    assert evidence_class_of(VerificationStatus.INTERFACE_MATCHED) == EvidenceClass.INTERFACE_MATCH
    assert evidence_class_of(VerificationStatus.SELF_ATTESTED) == EvidenceClass.ATTESTATION
    assert evidence_class_of(VerificationStatus.POSTPONED) == EvidenceClass.ATTESTATION


def test_answer_source_bridge():
    assert from_answer_source("applicant_input") == VerificationStatus.SELF_ATTESTED
    assert from_answer_source("ocr_extraction") == VerificationStatus.DOCUMENTED
    assert from_answer_source("navigator_entry") == VerificationStatus.DOCUMENTED
    assert from_answer_source("prefilled") == VerificationStatus.INTERFACE_MATCHED
    assert from_answer_source(None) == VerificationStatus.SELF_ATTESTED


def test_uncertainty_uses_verification_with_explicit_override():
    u = InputUncertainty(verification={"earned": VerificationStatus.POSTPONED})
    assert u.p_error("earned") == p_error_for_verification(VerificationStatus.POSTPONED, "earned")
    # an explicit p_wrong still wins over the verification-derived value
    u2 = InputUncertainty(p_wrong={"earned": Decimal("0.9")},
                          verification={"earned": VerificationStatus.DOCUMENTED})
    assert u2.p_error("earned") == Decimal("0.9")
    # a documented fact scores far lower than a postponed one (same field)
    doc = InputUncertainty(verification={"earned": VerificationStatus.DOCUMENTED})
    post = InputUncertainty(verification={"earned": VerificationStatus.POSTPONED})
    assert doc.p_error("earned") < post.p_error("earned")
