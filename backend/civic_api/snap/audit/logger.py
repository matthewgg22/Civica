"""Append-only audit log for SNAP PII access.

Every write to or read of a PII-containing column from a SNAP session
must produce one row in snap_audit_log. The schema migration installs a
Postgres trigger that blocks UPDATE and DELETE on this table — so even
a compromised application credential cannot rewrite history.

What gets logged:
  - The session_id touched.
  - Who touched it (anonymous_session_id for pre-auth flows; user_id
    after magic-link recovery; partner_user_id for institutional staff).
  - The action category (read, write, decrypt, generate_pdf, etc.).
  - The reason (which endpoint or job triggered it).
  - Timestamp and request id for correlation with HTTP logs.

What does NOT get logged: the PII itself. The audit log proves access
happened; the encrypted column proves what was stored.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Protocol
from uuid import uuid4

from pydantic import BaseModel, ConfigDict

logger = logging.getLogger(__name__)


class AuditAction(str, Enum):
    SESSION_CREATED = "session_created"
    SESSION_RECOVERED = "session_recovered"
    CONVERSATION_TURN_WRITTEN = "conversation_turn_written"
    EXTRACTED_STATE_WRITTEN = "extracted_state_written"
    DOCUMENT_UPLOADED = "document_uploaded"
    DOCUMENT_DECRYPTED = "document_decrypted"
    DOCUMENT_EXTRACTED = "document_extracted"
    DOCUMENT_CONFIRMED = "document_confirmed"
    ELIGIBILITY_DETERMINED = "eligibility_determined"
    ELIGIBILITY_RESULT_READ = "eligibility_result_read"
    PDF_GENERATED = "pdf_generated"
    PII_FIELD_DECRYPTED = "pii_field_decrypted"


class AuditEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    audit_id: str
    session_id: str
    action: AuditAction
    actor_kind: str
    actor_id: str | None
    reason: str
    request_id: str | None = None
    column_or_resource: str | None = None
    occurred_at: datetime


class AuditSink(Protocol):
    """The repository implements this. Production sink writes to
    snap_audit_log with INSERT-only privileges; in-memory sink is for
    tests."""

    def append(self, entry: AuditEntry) -> None: ...


class AuditLogger:
    def __init__(self, sink: AuditSink) -> None:
        self._sink = sink

    def log(
        self,
        *,
        session_id: str,
        action: AuditAction,
        actor_kind: str,
        actor_id: str | None,
        reason: str,
        request_id: str | None = None,
        column_or_resource: str | None = None,
    ) -> AuditEntry:
        entry = AuditEntry(
            audit_id=str(uuid4()),
            session_id=session_id,
            action=action,
            actor_kind=actor_kind,
            actor_id=actor_id,
            reason=reason,
            request_id=request_id,
            column_or_resource=column_or_resource,
            occurred_at=datetime.now(timezone.utc),
        )
        try:
            self._sink.append(entry)
        except Exception:  # noqa: BLE001
            # An audit-log write failure must NEVER swallow the underlying
            # business operation — the user still needs their answer — but
            # it must be loud. The deployment monitor pages on this log line.
            logger.exception(
                "AUDIT_SINK_FAILURE session_id=%s action=%s",
                session_id,
                action.value,
            )
            raise
        return entry


class InMemoryAuditSink:
    """Test fixture. Production code must never instantiate this directly."""

    def __init__(self) -> None:
        self.entries: list[AuditEntry] = []

    def append(self, entry: AuditEntry) -> None:
        self.entries.append(entry)
