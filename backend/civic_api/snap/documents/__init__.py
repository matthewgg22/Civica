"""SNAP document understanding pipeline.

Pipeline per uploaded document:
  1. Classifier — vision LLM call categorizing the image (paystub, photo
     ID, lease, utility bill, other, unknown).
  2. Type-specific extractor — vision LLM call returning a Pydantic
     model with that document's structured fields.
  3. Validator — pure-Python invariants (gross - deductions = net,
     monotonic period dates, hours * rate ~= gross, YTD increasing).
  4. User confirmation — iOS surfaces the extracted fields; user
     confirms or corrects. Confirmed values flow into the rules engine.

Phase E scope: paystub end-to-end + classifier with all document types
known to the rules engine. Other extractors (ID, lease, utility bill)
are stubbed for Phase E+1.
"""

from .schemas import (
    DocumentClassification,
    DocumentClassificationConfidence,
    DocumentType,
    ExtractionResult,
    Paystub,
    PaystubDeduction,
)

__all__ = [
    "DocumentClassification",
    "DocumentClassificationConfidence",
    "DocumentType",
    "ExtractionResult",
    "Paystub",
    "PaystubDeduction",
]
