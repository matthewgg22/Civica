"""Persistence-shape Pydantic schemas for SNAP sessions, turns, and documents.

These models are the boundary between FastAPI handlers, the repository
layer, and the iOS client. They are *also* the source of truth that the
Swift Codable models in WeVote Information Page/Features/SNAP/Generated/
are codegenned from.

The rules engine has its own input/output schemas in rules/interfaces.py
that this module *does not* re-export. The two surfaces are intentionally
separate: persistence shapes evolve more slowly than rule semantics.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SessionStatus(str, Enum):
    ACTIVE = "active"
    ABANDONED = "abandoned"
    COMPLETED = "completed"


class ConversationRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class DocumentType(str, Enum):
    UNKNOWN = "unknown"
    PAYSTUB = "paystub"
    PHOTO_ID = "photo_id"
    LEASE = "lease"
    UTILITY_BILL = "utility_bill"
    OTHER = "other"


class DocumentProcessingStatus(str, Enum):
    UPLOADED = "uploaded"
    CLASSIFYING = "classifying"
    EXTRACTING = "extracting"
    AWAITING_CONFIRMATION = "awaiting_confirmation"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class SnapSession(BaseModel):
    """Top-level row in snap_sessions. Anonymous at first; the `user_id`
    column is populated only after magic-link recovery (Phase D)."""

    model_config = ConfigDict(extra="forbid")

    session_id: str
    user_id: str | None = None
    state: str = Field(min_length=2, max_length=2, description="USPS state code")
    language: str = Field(default="en", pattern=r"^[a-z]{2}(-[A-Z]{2})?$")
    status: SessionStatus = SessionStatus.ACTIVE
    created_at: datetime
    updated_at: datetime
    partner_id: str | None = Field(
        default=None,
        description="Institutional partner that referred this user (food bank, campus, CBO). Null for direct downloads.",
    )


class ConversationTurn(BaseModel):
    """One turn in the eligibility-screener dialogue. Stored separately
    from extracted state so the conversation can be replayed."""

    model_config = ConfigDict(extra="forbid")

    turn_id: str
    session_id: str
    turn_index: int = Field(ge=0)
    role: ConversationRole
    content: str
    pipeline_stage: str | None = Field(
        default=None,
        description="One of 'interpreter', 'ask_selector', 'script_writer'. Null for user turns.",
    )
    model_used: str | None = None
    cost_usd: str | None = Field(
        default=None,
        description="Stringified Decimal. Decimal isn't JSON-native; we string it on the wire.",
    )
    latency_ms: int | None = None
    created_at: datetime


class ExtractedSessionState(BaseModel):
    """The structured-update side. Each row records the entities extracted
    from the most recent user turn so the rules engine can consume them.

    The actual stored shape is JSON; field-level validation happens via
    the Household schema in rules/interfaces.py."""

    model_config = ConfigDict(extra="forbid")

    state_id: str
    session_id: str
    snapshot: dict[str, Any] = Field(
        description="Pydantic-serialized Household snapshot at this point in the conversation.",
    )
    confidence: float = Field(ge=0.0, le=1.0)
    flags: list[str] = Field(default_factory=list)
    derived_from_turn_id: str
    created_at: datetime


class SnapDocument(BaseModel):
    """A document the user uploaded. The encrypted blob lives in
    Supabase Storage; this row tracks the metadata, classification, and
    extraction state."""

    model_config = ConfigDict(extra="forbid")

    document_id: str
    session_id: str
    storage_path: str = Field(description="Path inside the encrypted Supabase Storage bucket.")
    document_type: DocumentType = DocumentType.UNKNOWN
    classification_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    extracted_payload: dict[str, Any] | None = Field(
        default=None,
        description="Type-specific extracted data (e.g. Paystub fields). Encrypted at the column level.",
    )
    extraction_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    validator_errors: list[str] = Field(default_factory=list)
    user_confirmed: bool = False
    user_corrections: dict[str, Any] | None = None
    processing_status: DocumentProcessingStatus = DocumentProcessingStatus.UPLOADED
    on_device_quality_passed: bool = True
    created_at: datetime
    updated_at: datetime


class StoredEligibilityResult(BaseModel):
    """Persisted snapshot of a rules-engine determination. Re-running the
    rules engine with the same inputs and the same effective_date must
    reproduce this result bit-for-bit."""

    model_config = ConfigDict(extra="forbid")

    result_id: str
    session_id: str
    rules_version: str
    household_snapshot: dict[str, Any]
    result: dict[str, Any] = Field(description="EligibilityResult.model_dump()")
    created_at: datetime
