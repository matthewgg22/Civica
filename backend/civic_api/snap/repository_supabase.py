"""Supabase-backed SnapPipelineRepository.

PostgREST is the wire protocol; the existing CivicService SupabaseCivicRepository
in backend/civic_api/repository.py uses the same pattern and is the reference
for retry/timeout/error handling.

Encryption boundary: this class is the *only* place that encrypts on
write and decrypts on read. The orchestrator and FastAPI handlers see
plaintext PartialHousehold / TurnResult instances; the database stores
Fernet ciphertext for any column marked PII in
20260510_add_snap_initial_schema.sql.

Audit boundary: every method that reads or writes a PII column writes
one row to snap_audit_log via the bundled AuditLogger. The trigger on
the audit table blocks UPDATE/DELETE so the trail is durable.
"""
from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from .audit.logger import AuditAction, AuditLogger, AuditSink, AuditEntry
from .pipeline.repository import SnapPipelineRepository, StoredTurn
from .pipeline.schemas import InterpreterOutput, PartialHousehold, TurnLLMTelemetry
from .storage.encryption import PIIEncryptor

logger = logging.getLogger(__name__)


class _SupabaseAuditSink(AuditSink):
    """AuditSink backed by snap_audit_log via PostgREST. Insert-only by
    schema (the trigger blocks UPDATE/DELETE)."""

    def __init__(self, repo: "SupabaseSnapPipelineRepository") -> None:
        self._repo = repo

    def append(self, entry: AuditEntry) -> None:
        row = {
            "audit_id": entry.audit_id,
            "session_id": entry.session_id,
            "action": entry.action.value,
            "actor_kind": entry.actor_kind,
            "actor_id": entry.actor_id,
            "reason": entry.reason,
            "request_id": entry.request_id,
            "column_or_resource": entry.column_or_resource,
            "occurred_at": entry.occurred_at.astimezone(timezone.utc).isoformat(),
        }
        self._repo._request_json("POST", "/rest/v1/snap_audit_log", body=[row])


class SupabaseSnapPipelineRepository(SnapPipelineRepository):
    """PostgREST-backed implementation of the pipeline repository.

    Constructed once per process by snap.factory.build_orchestrator.
    Stateless across requests — all session state lives in Supabase.
    """

    def __init__(
        self,
        *,
        encryptor: PIIEncryptor | None = None,
        timeout_s: float = 8.0,
        max_retries: int = 3,
    ) -> None:
        self.base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not self.base_url or not self.service_key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for SupabaseSnapPipelineRepository."
            )
        self.timeout_s = timeout_s
        self.max_retries = max_retries
        self._encryptor = encryptor or PIIEncryptor()
        self._audit = AuditLogger(_SupabaseAuditSink(self))

    # ------------------------------------------------------------------
    # SnapPipelineRepository implementation
    # ------------------------------------------------------------------

    def create_session(self, *, state: str, language: str = "en") -> str:
        session_id = str(uuid4())
        row = {
            "session_id": session_id,
            "state": state,
            "language": language,
            "status": "active",
        }
        self._request_json("POST", "/rest/v1/snap_sessions", body=[row])
        self._audit.log(
            session_id=session_id,
            action=AuditAction.SESSION_CREATED,
            actor_kind="anonymous_session",
            actor_id=session_id,
            reason="POST /snap/sessions",
            column_or_resource="snap_sessions",
        )
        # Seed an empty extracted-state snapshot so get_session_state has
        # something deterministic to return for the first turn.
        self._save_snapshot(
            session_id=session_id,
            state=PartialHousehold(state=state),
            derived_from_turn_id=None,
            confidence=1.0,
        )
        return session_id

    def get_session_state(self, session_id: str) -> PartialHousehold:
        params = urllib.parse.urlencode(
            {
                "session_id": f"eq.{session_id}",
                "order": "created_at.desc",
                "limit": "1",
            }
        )
        rows = self._request_json("GET", f"/rest/v1/snap_extracted_state?{params}")
        if not rows:
            session_row = self._fetch_session_row(session_id)
            return PartialHousehold(state=session_row.get("state"))
        ciphertext = rows[0]["snapshot_ciphertext"]
        plaintext = self._encryptor.decrypt(ciphertext) or "{}"
        self._audit.log(
            session_id=session_id,
            action=AuditAction.PII_FIELD_DECRYPTED,
            actor_kind="background_job",
            actor_id="orchestrator",
            reason="get_session_state",
            column_or_resource="snap_extracted_state.snapshot_ciphertext",
        )
        return PartialHousehold.model_validate_json(plaintext)

    def save_session_state(self, session_id: str, state: PartialHousehold) -> None:
        # We store every snapshot rather than overwriting so the
        # conversation can be replayed turn-by-turn for audit / debugging.
        # `derived_from_turn_id` is filled by append_turn callers via
        # save_state_for_turn; the bare save method records a
        # turn-less snapshot used by start_session.
        self._save_snapshot(
            session_id=session_id,
            state=state,
            derived_from_turn_id=None,
            confidence=1.0,
        )

    def append_turn(self, turn: StoredTurn) -> None:
        encrypted = self._encryptor.encrypt(turn.content)
        row = {
            "turn_id": turn.turn_id,
            "session_id": turn.session_id,
            "turn_index": turn.turn_index,
            "role": turn.role,
            "content_ciphertext": encrypted,
            "pipeline_stage": turn.pipeline_stage,
            "model_used": turn.telemetry.model_used if turn.telemetry else None,
            "cost_usd": str(turn.telemetry.cost_usd) if turn.telemetry else None,
            "latency_ms": turn.telemetry.latency_ms if turn.telemetry else None,
            "created_at": turn.created_at.astimezone(timezone.utc).isoformat(),
        }
        self._request_json("POST", "/rest/v1/snap_conversation_turns", body=[row])
        self._audit.log(
            session_id=turn.session_id,
            action=AuditAction.CONVERSATION_TURN_WRITTEN,
            actor_kind="background_job",
            actor_id="orchestrator",
            reason=f"role={turn.role!r} turn_index={turn.turn_index}",
            column_or_resource="snap_conversation_turns.content_ciphertext",
        )
        # If the turn carried an interpreter output, persist its snapshot
        # alongside, linked back to this turn for replay.
        if turn.interpreter_output is not None:
            # The current_state is whatever's already saved; we don't
            # try to re-merge here. The orchestrator calls
            # save_session_state with the post-merge state right after
            # append_turn, and that snapshot picks up the link via
            # save_snapshot_for_turn (below).
            pass

    def save_snapshot_for_turn(
        self,
        *,
        session_id: str,
        state: PartialHousehold,
        derived_from_turn_id: str,
        confidence: float,
    ) -> None:
        """Optional convenience used by the orchestrator after a successful
        Interpreter call. Standard save_session_state stores a snapshot
        without a turn linkage."""
        self._save_snapshot(
            session_id=session_id,
            state=state,
            derived_from_turn_id=derived_from_turn_id,
            confidence=confidence,
        )

    def list_turns(self, session_id: str) -> list[StoredTurn]:
        params = urllib.parse.urlencode(
            {
                "session_id": f"eq.{session_id}",
                "order": "turn_index.asc",
            }
        )
        rows = self._request_json("GET", f"/rest/v1/snap_conversation_turns?{params}")
        turns: list[StoredTurn] = []
        for row in rows:
            decrypted = self._encryptor.decrypt(row["content_ciphertext"]) or ""
            turns.append(
                StoredTurn(
                    turn_id=str(row["turn_id"]),
                    session_id=str(row["session_id"]),
                    turn_index=int(row["turn_index"]),
                    role=str(row["role"]),
                    content=decrypted,
                    pipeline_stage=row.get("pipeline_stage"),
                    telemetry=_parse_telemetry(row),
                    interpreter_output=None,
                    created_at=_parse_ts(row.get("created_at")),
                )
            )
        if turns:
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
        params = urllib.parse.urlencode(
            {
                "session_id": f"eq.{session_id}",
                "select": "turn_index",
                "order": "turn_index.desc",
                "limit": "1",
            }
        )
        rows = self._request_json("GET", f"/rest/v1/snap_conversation_turns?{params}")
        if not rows:
            return 0
        return int(rows[0]["turn_index"]) + 1

    def session_language(self, session_id: str) -> str:
        return self._fetch_session_row(session_id).get("language", "en")

    # ------------------------------------------------------------------
    # Audit-aware reads outside the orchestrator hot path
    # ------------------------------------------------------------------

    def store_eligibility_result(
        self,
        *,
        session_id: str,
        rules_version: str,
        household_snapshot: dict[str, Any],
        result: dict[str, Any],
        status: str,
        monthly_benefit: str | None,
        effective_date: str,
    ) -> str:
        result_id = str(uuid4())
        row = {
            "result_id": result_id,
            "session_id": session_id,
            "rules_version": rules_version,
            "household_snapshot_ciphertext": self._encryptor.encrypt(
                json.dumps(household_snapshot, default=str)
            ),
            "result_ciphertext": self._encryptor.encrypt(
                json.dumps(result, default=str)
            ),
            "status": status,
            "monthly_benefit": monthly_benefit,
            "effective_date": effective_date,
        }
        self._request_json("POST", "/rest/v1/snap_eligibility_results", body=[row])
        self._audit.log(
            session_id=session_id,
            action=AuditAction.ELIGIBILITY_DETERMINED,
            actor_kind="background_job",
            actor_id="rules_engine",
            reason=f"status={status} rules_version={rules_version}",
            column_or_resource="snap_eligibility_results",
        )
        return result_id

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _save_snapshot(
        self,
        *,
        session_id: str,
        state: PartialHousehold,
        derived_from_turn_id: str | None,
        confidence: float,
    ) -> None:
        encrypted = self._encryptor.encrypt(state.model_dump_json())
        row = {
            "state_id": str(uuid4()),
            "session_id": session_id,
            "snapshot_ciphertext": encrypted,
            "confidence": confidence,
            "flags": [],
        }
        if derived_from_turn_id is not None:
            row["derived_from_turn_id"] = derived_from_turn_id
        self._request_json("POST", "/rest/v1/snap_extracted_state", body=[row])
        self._audit.log(
            session_id=session_id,
            action=AuditAction.EXTRACTED_STATE_WRITTEN,
            actor_kind="background_job",
            actor_id="orchestrator",
            reason=f"snapshot saved (linked_turn={derived_from_turn_id})",
            column_or_resource="snap_extracted_state.snapshot_ciphertext",
        )

    def _fetch_session_row(self, session_id: str) -> dict[str, Any]:
        params = urllib.parse.urlencode(
            {
                "session_id": f"eq.{session_id}",
                "select": "session_id,state,language,status",
                "limit": "1",
            }
        )
        rows = self._request_json("GET", f"/rest/v1/snap_sessions?{params}")
        if not rows:
            raise KeyError(f"Unknown session_id={session_id!r}")
        return rows[0]

    def _request_json(
        self,
        method: str,
        path: str,
        body: Any | None = None,
        prefer: str | None = None,
    ) -> Any:
        if not path.startswith("/"):
            path = f"/{path}"
        url = f"{self.base_url}{path}"
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Accept": "application/json",
        }
        payload = None
        if body is not None:
            payload = json.dumps(body, default=str).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if prefer:
            headers["Prefer"] = prefer

        for attempt in range(1, self.max_retries + 1):
            request = urllib.request.Request(url, data=payload, method=method, headers=headers)
            try:
                with urllib.request.urlopen(request, timeout=self.timeout_s) as response:
                    data = response.read()
                    if not data:
                        return []
                    return json.loads(data.decode("utf-8"))
            except urllib.error.HTTPError as exc:
                if exc.code in {429, 500, 502, 503, 504} and attempt < self.max_retries:
                    time.sleep(0.5 * (2 ** (attempt - 1)))
                    continue
                raise
            except urllib.error.URLError:
                if attempt < self.max_retries:
                    time.sleep(0.5 * (2 ** (attempt - 1)))
                    continue
                raise

        raise RuntimeError("unreachable retry loop")


def _parse_ts(value: Any) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)


def _parse_telemetry(row: dict[str, Any]) -> TurnLLMTelemetry | None:
    model_used = row.get("model_used")
    if not model_used:
        return None
    from decimal import Decimal

    return TurnLLMTelemetry(
        stage=row.get("pipeline_stage") or "unknown",
        model_used=str(model_used),
        provider_used="unknown",  # not tracked separately yet
        input_tokens=0,
        output_tokens=0,
        latency_ms=int(row.get("latency_ms") or 0),
        cost_usd=Decimal(str(row.get("cost_usd") or "0")),
    )
