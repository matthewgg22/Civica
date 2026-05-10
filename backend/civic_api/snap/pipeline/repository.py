"""Repository abstraction for SNAP pipeline state.

Two implementations:
  - `InMemorySnapPipelineRepository` for tests and the eval harness.
  - The Supabase-backed implementation lives elsewhere (Phase D wires it
    to FastAPI; for now this module only ships the abstract interface
    + the in-memory variant).

Design rule: every method is sync. Async wrappers exist at the FastAPI
handler boundary, not here. Keeping the repository sync makes the
pipeline testable without an event loop.

Audit boundary: the repository is the lowest layer that touches PII.
Both implementations route every PII operation through an AuditLogger,
which writes to snap_audit_log (Supabase) or an InMemoryAuditSink
(tests). The Phase G audit-coverage CI test inspects this sink to
prove every PII operation produces an audit row.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Iterable, Optional
from uuid import uuid4

from ..audit.logger import AuditAction, AuditLogger, InMemoryAuditSink
from .schemas import (
    InterpreterOutput,
    PartialHousehold,
    TurnLLMTelemetry,
)


class StoredTurn:
    """One persisted record per conversation turn.

    Plain Python class — Pydantic isn't needed at the repository
    boundary, and avoiding Pydantic here makes the in-memory store
    much faster for the eval harness's hundreds of scripted turns.
    """

    __slots__ = (
        "turn_id",
        "session_id",
        "turn_index",
        "role",
        "content",
        "pipeline_stage",
        "telemetry",
        "interpreter_output",
        "created_at",
    )

    def __init__(
        self,
        *,
        turn_id: str,
        session_id: str,
        turn_index: int,
        role: str,
        content: str,
        pipeline_stage: str | None = None,
        telemetry: TurnLLMTelemetry | None = None,
        interpreter_output: InterpreterOutput | None = None,
        created_at: datetime | None = None,
    ) -> None:
        self.turn_id = turn_id
        self.session_id = session_id
        self.turn_index = turn_index
        self.role = role
        self.content = content
        self.pipeline_stage = pipeline_stage
        self.telemetry = telemetry
        self.interpreter_output = interpreter_output
        self.created_at = created_at or datetime.now(timezone.utc)


class SnapPipelineRepository(ABC):
    """Persistence boundary the orchestrator sees.

    This interface is intentionally narrow — only what the pipeline
    needs. The full SNAP repository (with documents, eligibility
    results, etc.) is a wider interface defined in Phase D.
    """

    @abstractmethod
    def create_session(self, *, state: str, language: str = "en") -> str:
        """Returns the new session_id."""

    @abstractmethod
    def get_session_state(self, session_id: str) -> PartialHousehold:
        """Latest accumulated PartialHousehold for the session, or an
        empty one if no extracted state has been written yet."""

    @abstractmethod
    def save_session_state(self, session_id: str, state: PartialHousehold) -> None:
        """Persist the running PartialHousehold."""

    @abstractmethod
    def append_turn(self, turn: StoredTurn) -> None:
        """Add a turn (user or assistant) to the session transcript."""

    @abstractmethod
    def list_turns(self, session_id: str) -> list[StoredTurn]:
        """Full transcript in turn_index order."""

    @abstractmethod
    def next_turn_index(self, session_id: str) -> int:
        """Monotonic index for the next turn to append."""

    def session_language(self, session_id: str) -> str:
        """Default sync helper subclasses can override; concrete impls
        track this on the session row."""
        return "en"


# ---------------------------------------------------------------------------
# In-memory implementation (tests + eval harness)
# ---------------------------------------------------------------------------


class InMemorySnapPipelineRepository(SnapPipelineRepository):
    """Test/eval-harness implementation. Optionally writes audit
    entries through a provided AuditLogger so the audit-coverage CI
    test can verify the contract is honored end-to-end.

    Pass `audit_logger=None` (the default) for tests that don't care
    about audit semantics; pass an AuditLogger backed by
    InMemoryAuditSink to inspect what got recorded."""

    def __init__(self, *, audit_logger: Optional[AuditLogger] = None) -> None:
        self._sessions: dict[str, dict] = {}
        self._states: dict[str, PartialHousehold] = {}
        self._turns: dict[str, list[StoredTurn]] = {}
        self._audit = audit_logger

    @property
    def audit_logger(self) -> Optional[AuditLogger]:
        return self._audit

    def create_session(self, *, state: str, language: str = "en") -> str:
        session_id = str(uuid4())
        self._sessions[session_id] = {
            "state": state,
            "language": language,
            "created_at": datetime.now(timezone.utc),
        }
        self._states[session_id] = PartialHousehold(state=state)
        self._turns[session_id] = []
        if self._audit is not None:
            self._audit.log(
                session_id=session_id,
                action=AuditAction.SESSION_CREATED,
                actor_kind="anonymous_session",
                actor_id=session_id,
                reason="InMemorySnapPipelineRepository.create_session",
                column_or_resource="snap_sessions",
            )
        return session_id

    def get_session_state(self, session_id: str) -> PartialHousehold:
        if session_id not in self._states:
            raise KeyError(f"Unknown session_id={session_id!r}")
        if self._audit is not None:
            self._audit.log(
                session_id=session_id,
                action=AuditAction.PII_FIELD_DECRYPTED,
                actor_kind="background_job",
                actor_id="orchestrator",
                reason="get_session_state",
                column_or_resource="snap_extracted_state.snapshot_ciphertext",
            )
        return self._states[session_id]

    def save_session_state(self, session_id: str, state: PartialHousehold) -> None:
        if session_id not in self._states:
            raise KeyError(f"Unknown session_id={session_id!r}")
        self._states[session_id] = state
        if self._audit is not None:
            self._audit.log(
                session_id=session_id,
                action=AuditAction.EXTRACTED_STATE_WRITTEN,
                actor_kind="background_job",
                actor_id="orchestrator",
                reason="save_session_state",
                column_or_resource="snap_extracted_state.snapshot_ciphertext",
            )

    def append_turn(self, turn: StoredTurn) -> None:
        if turn.session_id not in self._turns:
            raise KeyError(f"Unknown session_id={turn.session_id!r}")
        self._turns[turn.session_id].append(turn)
        if self._audit is not None:
            self._audit.log(
                session_id=turn.session_id,
                action=AuditAction.CONVERSATION_TURN_WRITTEN,
                actor_kind="background_job",
                actor_id="orchestrator",
                reason=f"role={turn.role!r} turn_index={turn.turn_index}",
                column_or_resource="snap_conversation_turns.content_ciphertext",
            )

    def list_turns(self, session_id: str) -> list[StoredTurn]:
        turns = list(self._turns.get(session_id, []))
        if turns and self._audit is not None:
            self._audit.log(
                session_id=session_id,
                action=AuditAction.PII_FIELD_DECRYPTED,
                actor_kind="background_job",
                actor_id="orchestrator",
                reason=f"list_turns count={len(turns)}",
                column_or_resource="snap_conversation_turns.content_ciphertext",
            )
        return turns

    def next_turn_index(self, session_id: str) -> int:
        return len(self._turns.get(session_id, []))

    def session_language(self, session_id: str) -> str:
        meta = self._sessions.get(session_id)
        return meta["language"] if meta else "en"
