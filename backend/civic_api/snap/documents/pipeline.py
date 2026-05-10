"""Document-pipeline orchestrator.

For each uploaded image:
  1. Run the classifier to get a DocumentType.
  2. If type is paystub, run the paystub extractor.
  3. Run the validator over the extracted Paystub.
  4. Wrap the whole thing in an ExtractionResult and return.

Phase E: paystub-only on the extractor side. Other types
(photo_id, lease, utility_bill) go through the classifier but the
ExtractionResult lands without a type-specific payload — iOS just shows
"We saw a {type}; we'll keep that for the application but won't try
to read it yet."

Run as a FastAPI BackgroundTask, NOT inline. Vision LLM calls take
5-15 seconds; holding an iOS connection open that long times out and
hides errors.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from ..llm.client import LLMCallTelemetry, LLMClient
from .classifier import run_classifier
from .extractors import run_paystub_extractor
from .schemas import (
    DocumentClassification,
    DocumentClassificationConfidence,
    DocumentType,
    ExtractionResult,
    Paystub,
    ValidationFlag,
)
from .validator import (
    has_blocker,
    overall_extraction_confidence,
    validate_paystub,
)

logger = logging.getLogger(__name__)


@dataclass
class DocumentPipelineTelemetry:
    classifier: LLMCallTelemetry | None = None
    extractor: LLMCallTelemetry | None = None

    @property
    def total_cost_usd(self):
        from decimal import Decimal

        total = Decimal("0")
        if self.classifier is not None:
            total += self.classifier.cost_usd
        if self.extractor is not None:
            total += self.extractor.cost_usd
        return total


def process_document(
    *,
    client: LLMClient,
    image_bytes: bytes,
    media_type: str = "image/jpeg",
    prior_paystubs: list[Paystub] | None = None,
    language: str = "en",
) -> tuple[ExtractionResult, DocumentPipelineTelemetry]:
    telemetry = DocumentPipelineTelemetry()

    classification, classifier_tel = run_classifier(
        client=client,
        image_bytes=image_bytes,
        media_type=media_type,
        language=language,
    )
    telemetry.classifier = classifier_tel

    if classification.confidence_band == DocumentClassificationConfidence.LOW:
        # Low confidence: don't attempt extraction. iOS surfaces
        # "we couldn't tell what this is — please retake."
        return _result_classification_only(classification, telemetry), telemetry

    if classification.document_type == DocumentType.PAYSTUB:
        return _process_paystub(
            client=client,
            classification=classification,
            image_bytes=image_bytes,
            media_type=media_type,
            prior_paystubs=prior_paystubs or [],
            telemetry=telemetry,
            language=language,
        )

    # Recognized non-paystub type — Phase E ships paystub-only on the
    # extractor side. We still return the classification so iOS can
    # show "We saw a photo ID, thanks. We'll keep it on file."
    return _result_classification_only(classification, telemetry), telemetry


def _process_paystub(
    *,
    client: LLMClient,
    classification: DocumentClassification,
    image_bytes: bytes,
    media_type: str,
    prior_paystubs: list[Paystub],
    telemetry: DocumentPipelineTelemetry,
    language: str,
) -> tuple[ExtractionResult, DocumentPipelineTelemetry]:
    paystub, extractor_tel = run_paystub_extractor(
        client=client,
        image_bytes=image_bytes,
        media_type=media_type,
        language=language,
    )
    telemetry.extractor = extractor_tel

    flags = validate_paystub(paystub, prior_paystubs=prior_paystubs)
    confidence = overall_extraction_confidence(classification.confidence, flags)

    if has_blocker(flags):
        logger.info(
            "Paystub extraction returned a blocker; not surfacing extracted_paystub. flags=%s",
            [f.code for f in flags],
        )
        return (
            ExtractionResult(
                classification=classification,
                extracted_paystub=None,
                validation_flags=flags,
                extraction_confidence=0.0,
            ),
            telemetry,
        )

    return (
        ExtractionResult(
            classification=classification,
            extracted_paystub=paystub,
            validation_flags=flags,
            extraction_confidence=confidence,
        ),
        telemetry,
    )


def _result_classification_only(
    classification: DocumentClassification,
    telemetry: DocumentPipelineTelemetry,
) -> ExtractionResult:
    return ExtractionResult(
        classification=classification,
        extracted_paystub=None,
        validation_flags=[],
        extraction_confidence=classification.confidence,
    )
