"""Document classifier — vision LLM categorizes an uploaded image.

Why a separate classifier stage instead of "ask the extractor what it
sees": classification is much cheaper than extraction, fits within
Haiku's accuracy bar, and lets us route to the right extractor without
running every extractor against every image. A user uploading a lease
shouldn't trigger paystub extraction.

Returned confidence_band drives downstream behavior:
  - HIGH: proceed automatically into the type-specific extractor.
  - MEDIUM: proceed but tag the document for explicit user confirmation
    of the type before showing extracted fields.
  - LOW: don't extract; surface "we couldn't tell what that is —
    please retake the photo or pick a category."
"""
from __future__ import annotations

from ..llm.client import LLMCallTelemetry, LLMClient
from ._vision import build_vision_message
from .schemas import (
    DocumentClassification,
    DocumentClassificationConfidence,
)

DEFAULT_CLASSIFIER_MODEL = "claude-sonnet-4-6"


CLASSIFIER_PROMPT = """Task: Classify the uploaded document image into one of the SNAP-relevant types.

Allowed types (use these EXACT strings):
  - paystub: an employer-issued earnings statement showing pay period, gross/net wages, and deductions.
  - photo_id: a government-issued identification card (driver's license, state ID, passport).
  - lease: a residential lease, rental agreement, or mortgage statement showing monthly housing cost.
  - utility_bill: a recent bill for electricity, gas, water, internet, or other utility.
  - other: a clearly-recognizable document that doesn't fit the categories above (e.g. medical bill, court order).
  - unknown: the image is unreadable, blank, blurry, partially obscured, or the type cannot be reliably determined.

Return a DocumentClassification with:
  - document_type: one of the strings above.
  - confidence: 0.0-1.0. Use 0.95+ when the document type is unambiguously legible. Use 0.6-0.85 when type is clear but quality is mediocre. Use < 0.6 only if the image is genuinely ambiguous or unreadable.
  - confidence_band: 'high' if confidence >= 0.85, 'medium' if 0.60-0.85, 'low' if < 0.60.
  - rationale: one sentence describing what visual cues drove the decision (e.g. 'Visible employer logo, "Pay Period" header, and a "Net Pay" line at the bottom').

Hard constraints:
  1. Never invent a document type outside the allowed list.
  2. If the image shows multiple stacked documents, classify the most prominent one and note in rationale.
  3. If the image is rotated 90/180/270, still classify based on visible content.
  4. confidence and confidence_band must be internally consistent. The orchestrator double-checks this.
  5. rationale must reference visible content, not generic statements like "looks like a paystub."""


def run_classifier(
    *,
    client: LLMClient,
    image_bytes: bytes,
    media_type: str = "image/jpeg",
    language: str = "en",
    model: str = DEFAULT_CLASSIFIER_MODEL,
) -> tuple[DocumentClassification, LLMCallTelemetry]:
    messages = build_vision_message(
        image_bytes=image_bytes,
        media_type=media_type,
        instruction="Classify this document.",
    )
    classification, telemetry = client.call_with_schema(
        model=model,
        schema=DocumentClassification,
        system=CLASSIFIER_PROMPT,
        messages=messages,
        language=language,
        max_tokens=256,
    )
    classification = _ensure_band_consistency(classification)
    return classification, telemetry


def _ensure_band_consistency(c: DocumentClassification) -> DocumentClassification:
    """Re-derive the band from the numeric confidence so the LLM can't
    return mismatched values. Cheap correctness gate."""
    expected_band = (
        DocumentClassificationConfidence.HIGH
        if c.confidence >= 0.85
        else DocumentClassificationConfidence.MEDIUM
        if c.confidence >= 0.60
        else DocumentClassificationConfidence.LOW
    )
    if c.confidence_band == expected_band:
        return c
    return c.model_copy(update={"confidence_band": expected_band})
