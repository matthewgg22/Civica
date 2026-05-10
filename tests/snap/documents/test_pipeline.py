"""Document-pipeline integration tests with mocked vision LLM."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from backend.civic_api.snap.documents.pipeline import process_document
from backend.civic_api.snap.documents.schemas import (
    DocumentClassification,
    DocumentClassificationConfidence,
    DocumentType,
    Paystub,
)
from tests.snap.pipeline.conftest import ScriptedLLMClient


def _classification(
    *,
    document_type: DocumentType = DocumentType.PAYSTUB,
    confidence: float = 0.95,
    band: DocumentClassificationConfidence = DocumentClassificationConfidence.HIGH,
) -> DocumentClassification:
    return DocumentClassification(
        document_type=document_type,
        confidence=confidence,
        confidence_band=band,
        rationale="Visible employer header and 'Net Pay' line.",
    )


def test_paystub_happy_path(make_paystub):
    client = ScriptedLLMClient()
    client.push(_classification())
    client.push(make_paystub())

    result, telemetry = process_document(
        client=client,
        image_bytes=b"\xFF\xD8\xFF\xE0fake-jpeg-bytes",
    )

    assert result.classification.document_type == DocumentType.PAYSTUB
    assert result.extracted_paystub is not None
    assert result.extracted_paystub.employer_name == "Acme Retail"
    assert result.extraction_confidence > 0.8
    assert telemetry.classifier is not None
    assert telemetry.extractor is not None


def test_low_confidence_classification_skips_extractor(make_paystub):
    client = ScriptedLLMClient()
    client.push(
        _classification(
            confidence=0.4,
            band=DocumentClassificationConfidence.LOW,
        )
    )
    # Note: no paystub pushed — if extractor runs, the assertion in
    # ScriptedLLMClient fires and the test fails.

    result, telemetry = process_document(
        client=client,
        image_bytes=b"\xFF\xD8\xFF\xE0",
    )

    assert result.extracted_paystub is None
    assert telemetry.extractor is None


def test_non_paystub_classification_skips_paystub_extractor():
    client = ScriptedLLMClient()
    client.push(_classification(document_type=DocumentType.PHOTO_ID, confidence=0.93))
    # No paystub extractor expected.

    result, _ = process_document(
        client=client,
        image_bytes=b"\xFF\xD8\xFF\xE0",
    )

    assert result.classification.document_type == DocumentType.PHOTO_ID
    assert result.extracted_paystub is None
    # Pipeline does NOT yet have ID extractor — Phase E+1 work. The
    # confidence comes from the classifier passthrough.
    assert result.extraction_confidence == 0.93


def test_blocker_in_validation_clears_extracted_paystub(make_paystub):
    client = ScriptedLLMClient()
    client.push(_classification())
    # Net > gross triggers a blocker.
    client.push(
        make_paystub(
            gross_pay_period=Decimal("1000"),
            net_pay_period=Decimal("1500"),
            deductions=[],
        )
    )

    result, _ = process_document(
        client=client,
        image_bytes=b"\xFF\xD8\xFF\xE0",
    )

    assert result.extracted_paystub is None
    assert any(f.severity == "blocker" for f in result.validation_flags)
    assert result.extraction_confidence == 0.0


def test_prior_paystubs_drive_duplicate_detection(make_paystub):
    client = ScriptedLLMClient()
    client.push(_classification())
    client.push(make_paystub())  # same period as the prior

    result, _ = process_document(
        client=client,
        image_bytes=b"\xFF\xD8\xFF\xE0",
        prior_paystubs=[make_paystub()],  # same employer + period
    )

    codes = {f.code for f in result.validation_flags}
    assert "duplicate_pay_period" in codes
