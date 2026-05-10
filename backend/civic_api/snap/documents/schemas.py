"""Pydantic schemas for the SNAP document-understanding pipeline.

Wire boundaries:
  - DocumentClassification: returned by the classifier LLM call. iOS
    receives this on the GET /snap/documents/{id} status check so the
    confirmation UI knows which type-specific layout to render.
  - Paystub: returned by the paystub extractor LLM call. Persisted
    encrypted in snap_documents.extracted_payload_ciphertext.
  - ExtractionResult: pipeline-level wrapper with classifier + extractor
    + validator outcomes plus the in-flight processing status.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class DocumentType(str, Enum):
    UNKNOWN = "unknown"
    PAYSTUB = "paystub"
    PHOTO_ID = "photo_id"
    LEASE = "lease"
    UTILITY_BILL = "utility_bill"
    OTHER = "other"


class DocumentClassificationConfidence(str, Enum):
    HIGH = "high"     # >= 0.85 — proceed with extractor automatically
    MEDIUM = "medium" # 0.60-0.85 — proceed but flag for confirmation
    LOW = "low"       # < 0.60 — surface to user; ask for re-photo


class DocumentClassification(BaseModel):
    """Output of the classifier LLM call."""

    model_config = ConfigDict(extra="forbid")

    document_type: DocumentType
    confidence: float = Field(ge=0.0, le=1.0)
    confidence_band: DocumentClassificationConfidence
    rationale: str = Field(
        min_length=1,
        description=(
            "Plain-language one-sentence explanation of why this type was "
            "picked. Surfaced in audit logs and the staff-review interface; "
            "not shown to end users directly."
        ),
    )


# ---------------------------------------------------------------------------
# Paystub
# ---------------------------------------------------------------------------


class PaystubDeductionCategory(str, Enum):
    """Stable categories for itemized deductions. The LLM extractor maps
    employer-specific labels (e.g. 'FED INCM TAX', 'FIT', 'FEDERAL TAX')
    to these canonical values."""

    FEDERAL_INCOME_TAX = "federal_income_tax"
    STATE_INCOME_TAX = "state_income_tax"
    LOCAL_INCOME_TAX = "local_income_tax"
    SOCIAL_SECURITY = "social_security"
    MEDICARE = "medicare"
    HEALTH_INSURANCE = "health_insurance"
    DENTAL_INSURANCE = "dental_insurance"
    VISION_INSURANCE = "vision_insurance"
    RETIREMENT_401K = "retirement_401k"
    RETIREMENT_IRA = "retirement_ira"
    HSA = "hsa"
    FSA = "fsa"
    UNION_DUES = "union_dues"
    GARNISHMENT = "garnishment"
    OTHER = "other"


class PaystubDeduction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: PaystubDeductionCategory
    label_as_printed: str = Field(
        max_length=64,
        description="Verbatim text from the paystub. Useful for audit and for state forms that require employer terminology.",
    )
    amount: Decimal = Field(ge=0)


class Paystub(BaseModel):
    """Structured paystub data extracted from a single uploaded image.

    Used by the rules engine via the conversation pipeline (the user
    confirms an extracted paystub, which then populates IncomeFacts in
    the running session state).
    """

    model_config = ConfigDict(extra="forbid")

    employer_name: str = Field(min_length=1, max_length=200)
    employer_address: str | None = Field(default=None, max_length=400)
    pay_period_start: date
    pay_period_end: date
    pay_date: date | None = None

    # Hours and rate are optional because not every paystub shows them
    # (salaried roles often omit hours; gig-platform 1099s lack them).
    hours_worked_in_period: Decimal | None = Field(default=None, ge=0)
    hourly_rate: Decimal | None = Field(default=None, ge=0)
    is_salaried: bool = False

    gross_pay_period: Decimal = Field(ge=0)
    net_pay_period: Decimal = Field(ge=0)
    deductions: list[PaystubDeduction] = Field(default_factory=list)

    # Year-to-date figures, where shown. Used by the validator to
    # detect duplicates across uploads (YTD must be monotonically
    # non-decreasing across the same employer's paystubs).
    gross_pay_ytd: Decimal | None = Field(default=None, ge=0)
    net_pay_ytd: Decimal | None = Field(default=None, ge=0)

    # Per-pay-period frequency the employer uses. Drives monthly
    # conversion in the rules engine input layer.
    pay_frequency_label_as_printed: str | None = Field(
        default=None,
        max_length=32,
        description="e.g. 'Bi-Weekly', 'WEEKLY', 'Semi-Monthly'. The conversion to monthly happens at the rules-engine boundary.",
    )

    @property
    def total_deductions(self) -> Decimal:
        return sum((d.amount for d in self.deductions), Decimal("0"))


# ---------------------------------------------------------------------------
# Extraction result wrapper
# ---------------------------------------------------------------------------


class ValidationFlag(BaseModel):
    """Single non-fatal warning from the validator.

    The validator returns a list of these so the iOS confirmation UI can
    show "we noticed X is unusual" without blocking the user. The field
    layer surfaces these as inline warnings, never as red errors.
    """

    model_config = ConfigDict(extra="forbid")

    code: str = Field(
        description="Stable machine identifier, e.g. 'gross_minus_deductions_does_not_match_net'.",
    )
    message_en: str
    message_es: str
    severity: str = Field(
        default="warning",
        description="One of 'info', 'warning', 'blocker'. Blockers stop ingestion; warnings flag for user review.",
    )


class ExtractionResult(BaseModel):
    """Pipeline-level result for one document.

    Persisted into snap_documents (extracted_payload_ciphertext) and
    surfaced to iOS for the confirmation step.
    """

    model_config = ConfigDict(extra="forbid")

    classification: DocumentClassification
    extracted_paystub: Paystub | None = None
    extracted_other: dict | None = Field(
        default=None,
        description="Type-specific payload for non-paystub documents. Phase E ships paystub-only; other extractors populate this in Phase E+1.",
    )
    validation_flags: list[ValidationFlag] = Field(default_factory=list)
    extraction_confidence: float = Field(ge=0.0, le=1.0)
