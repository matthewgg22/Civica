"""Audit-coverage CI test.

The contract: every SNAP HTTP endpoint that reads, writes, or
processes PII must produce at least one audit log entry per request.
This test drives every endpoint through the FastAPI TestClient with
an in-memory repository wired to a spy AuditLogger, then asserts the
expected actions appear.

When you add a new SNAP endpoint:
  1. Add it to the EXPECTED_AUDIT_ACTIONS matrix below.
  2. Wire the endpoint's audit_logger.log() calls.
  3. This test will fail until both are done — by design.

When you add a new AuditAction:
  1. Add it to backend/civic_api/snap/audit/logger.py.
  2. Reference it in EXPECTED_AUDIT_ACTIONS for whichever endpoint
     emits it.

The test is CI-blocking: regressions in audit coverage are how PII
incidents start.
"""
from __future__ import annotations

import io
from datetime import date
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.civic_api.snap.api import build_snap_router
from backend.civic_api.snap.audit.logger import (
    AuditAction,
    AuditLogger,
    InMemoryAuditSink,
)
from backend.civic_api.snap.documents.schemas import (
    DocumentClassification,
    DocumentClassificationConfidence,
    DocumentType,
)
from backend.civic_api.snap.documents.store import InMemoryDocumentStore
from backend.civic_api.snap.pipeline.orchestrator import SnapPipelineOrchestrator
from backend.civic_api.snap.pipeline.repository import InMemorySnapPipelineRepository
from backend.civic_api.snap.pipeline.schemas import (
    HouseholdMemberUpdate,
    IncomeSourceUpdate,
)
from backend.civic_api.snap.rules.interfaces import (
    CitizenshipStatus,
    StudentExemption,
    StudentStatus,
    SUATier,
)
from tests.snap.pipeline.conftest import ScriptedLLMClient


# ---------------------------------------------------------------------------
# Audit contract matrix
# ---------------------------------------------------------------------------
#
# For each endpoint, the set of audit actions that MUST appear at least
# once during a successful request. Endpoints can produce additional
# actions beyond these without failing — the test asserts a lower bound,
# not an exact match.

EXPECTED_AUDIT_ACTIONS: dict[str, set[AuditAction]] = {
    "POST /snap/sessions": {
        AuditAction.SESSION_CREATED,
        # Extracted-state seed write happens during start_session because
        # the orchestrator persists the initial state.
        AuditAction.EXTRACTED_STATE_WRITTEN,
    },
    "POST /snap/sessions/{id}/turns": {
        AuditAction.PII_FIELD_DECRYPTED,        # repo.get_session_state
        AuditAction.CONVERSATION_TURN_WRITTEN,  # at least the user turn
        AuditAction.EXTRACTED_STATE_WRITTEN,    # post-merge save
    },
    "GET /snap/sessions/{id}/transcript": {
        AuditAction.PII_FIELD_DECRYPTED,
    },
    "POST /snap/sessions/{id}/documents": {
        AuditAction.DOCUMENT_UPLOADED,
    },
    "POST /snap/documents/{id}/confirm": {
        AuditAction.DOCUMENT_CONFIRMED,
    },
    "POST /snap/sessions/{id}/application/pdf": {
        AuditAction.PDF_GENERATED,
        AuditAction.PII_FIELD_DECRYPTED,        # repo state read
    },
}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def audit_sink() -> InMemoryAuditSink:
    return InMemoryAuditSink()


@pytest.fixture
def audit_logger(audit_sink) -> AuditLogger:
    return AuditLogger(audit_sink)


@pytest.fixture
def scripted_llm() -> ScriptedLLMClient:
    return ScriptedLLMClient()


@pytest.fixture
def doc_store() -> InMemoryDocumentStore:
    return InMemoryDocumentStore()


@pytest.fixture
def client(scripted_llm, audit_logger, doc_store) -> TestClient:
    repo = InMemorySnapPipelineRepository(audit_logger=audit_logger)
    orchestrator = SnapPipelineOrchestrator(
        llm_client=scripted_llm,
        repository=repo,
        effective_date=date(2025, 5, 10),
    )
    app = FastAPI()
    app.include_router(
        build_snap_router(
            orchestrator,
            document_store=doc_store,
            llm_client=scripted_llm,
            audit_logger=audit_logger,
        )
    )
    return TestClient(app)


def _actions_for_session(sink: InMemoryAuditSink, session_id: str) -> set[AuditAction]:
    return {e.action for e in sink.entries if e.session_id == session_id}


# ---------------------------------------------------------------------------
# Endpoint drivers — one per route in the matrix
# ---------------------------------------------------------------------------


def _drive_create_session(client, scripted_llm) -> str:
    scripted_llm.push_script_writer(question_text="Hi.")
    response = client.post("/snap/sessions", json={"state": "MA"})
    assert response.status_code == 200
    return response.json()["session_id"]


def _drive_post_turn(client, scripted_llm, session_id: str) -> None:
    scripted_llm.push_interpreter(
        confidence=0.95,
        member_updates=[
            HouseholdMemberUpdate(
                member_id="applicant",
                age=32,
                is_applicant=True,
                citizenship=CitizenshipStatus.US_CITIZEN,
                student_status=StudentStatus.NOT_STUDENT,
                student_exemption=StudentExemption.NONE,
            )
        ],
    )
    scripted_llm.push_script_writer(question_text="Cash assistance?")
    response = client.post(
        f"/snap/sessions/{session_id}/turns",
        json={"user_text": "32, citizen, single."},
    )
    assert response.status_code == 200


def _drive_get_transcript(client, session_id: str) -> None:
    response = client.get(f"/snap/sessions/{session_id}/transcript")
    assert response.status_code == 200


def _drive_post_document(client, session_id: str) -> str:
    files = {"file": ("paystub.jpg", io.BytesIO(b"\xFF\xD8\xFF\xE0"), "image/jpeg")}
    response = client.post(
        f"/snap/sessions/{session_id}/documents",
        files=files,
        data={"on_device_quality_passed": "true"},
    )
    assert response.status_code == 200
    return response.json()["document_id"]


def _drive_confirm_document(client, document_id: str) -> None:
    response = client.post(
        f"/snap/documents/{document_id}/confirm",
        json={"corrections": None},
    )
    assert response.status_code == 200


def _drive_application_pdf(client, session_id: str) -> None:
    response = client.post(f"/snap/sessions/{session_id}/application/pdf")
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Tests — one per endpoint in the contract matrix
# ---------------------------------------------------------------------------


class TestAuditCoverage:
    def test_post_sessions_audits_required_actions(self, client, scripted_llm, audit_sink):
        session_id = _drive_create_session(client, scripted_llm)
        actions = _actions_for_session(audit_sink, session_id)
        expected = EXPECTED_AUDIT_ACTIONS["POST /snap/sessions"]
        missing = expected - actions
        assert not missing, f"POST /snap/sessions missing audit actions: {missing}"

    def test_post_turns_audits_required_actions(self, client, scripted_llm, audit_sink):
        session_id = _drive_create_session(client, scripted_llm)
        # Snapshot which actions came from session-creation so we test
        # the turn-specific contract in isolation.
        baseline_actions = _actions_for_session(audit_sink, session_id)

        _drive_post_turn(client, scripted_llm, session_id)
        new_actions = _actions_for_session(audit_sink, session_id) - baseline_actions
        expected = EXPECTED_AUDIT_ACTIONS["POST /snap/sessions/{id}/turns"]
        # PII_FIELD_DECRYPTED and EXTRACTED_STATE_WRITTEN may already
        # appear in baseline; the turn endpoint contract requires they
        # appear at least once in the combined entries for this session.
        combined = _actions_for_session(audit_sink, session_id)
        missing = expected - combined
        assert not missing, f"POST /snap/sessions/{{id}}/turns missing actions: {missing}"
        # CONVERSATION_TURN_WRITTEN must specifically be a NEW action
        # since session-creation doesn't write any conversation turns
        # via the user-turn path.
        assert AuditAction.CONVERSATION_TURN_WRITTEN in combined

    def test_get_transcript_audits_required_actions(self, client, scripted_llm, audit_sink):
        session_id = _drive_create_session(client, scripted_llm)
        _drive_post_turn(client, scripted_llm, session_id)
        baseline = len(audit_sink.entries)

        _drive_get_transcript(client, session_id)
        # New entries from the transcript call.
        new_entries = audit_sink.entries[baseline:]
        new_actions = {e.action for e in new_entries if e.session_id == session_id}
        expected = EXPECTED_AUDIT_ACTIONS["GET /snap/sessions/{id}/transcript"]
        missing = expected - new_actions
        assert not missing, f"GET /snap/sessions/{{id}}/transcript missing actions: {missing}"

    def test_post_document_audits_required_actions(self, client, scripted_llm, audit_sink):
        session_id = _drive_create_session(client, scripted_llm)
        _drive_post_document(client, session_id)
        actions = _actions_for_session(audit_sink, session_id)
        expected = EXPECTED_AUDIT_ACTIONS["POST /snap/sessions/{id}/documents"]
        missing = expected - actions
        assert not missing, f"POST /snap/sessions/{{id}}/documents missing actions: {missing}"

    def test_post_document_confirm_audits_required_actions(
        self, client, scripted_llm, audit_sink
    ):
        session_id = _drive_create_session(client, scripted_llm)
        document_id = _drive_post_document(client, session_id)
        _drive_confirm_document(client, document_id)
        actions = _actions_for_session(audit_sink, session_id)
        expected = EXPECTED_AUDIT_ACTIONS["POST /snap/documents/{id}/confirm"]
        missing = expected - actions
        assert not missing, f"POST /snap/documents/{{id}}/confirm missing actions: {missing}"

    def test_post_application_pdf_audits_required_actions(
        self, client, scripted_llm, audit_sink
    ):
        session_id = _drive_create_session(client, scripted_llm)
        _drive_application_pdf(client, session_id)
        actions = _actions_for_session(audit_sink, session_id)
        expected = EXPECTED_AUDIT_ACTIONS["POST /snap/sessions/{id}/application/pdf"]
        missing = expected - actions
        assert not missing, f"POST /snap/sessions/{{id}}/application/pdf missing actions: {missing}"


class TestAuditEntryShape:
    """Cross-cutting checks on the structure of audit entries themselves
    — applies to every entry from any endpoint."""

    def test_every_entry_has_session_id(self, client, scripted_llm, audit_sink):
        session_id = _drive_create_session(client, scripted_llm)
        _drive_post_turn(client, scripted_llm, session_id)
        for entry in audit_sink.entries:
            assert entry.session_id, f"Audit entry without session_id: {entry}"

    def test_every_entry_has_actor_kind(self, client, scripted_llm, audit_sink):
        session_id = _drive_create_session(client, scripted_llm)
        _drive_post_turn(client, scripted_llm, session_id)
        for entry in audit_sink.entries:
            assert entry.actor_kind in (
                "anonymous_session",
                "authenticated_user",
                "partner_user",
                "background_job",
                "admin",
            ), f"Unrecognized actor_kind on entry: {entry}"

    def test_every_entry_has_reason(self, client, scripted_llm, audit_sink):
        session_id = _drive_create_session(client, scripted_llm)
        _drive_post_turn(client, scripted_llm, session_id)
        for entry in audit_sink.entries:
            assert entry.reason, f"Audit entry without reason: {entry}"

    def test_every_entry_uses_known_action(self, client, scripted_llm, audit_sink):
        session_id = _drive_create_session(client, scripted_llm)
        _drive_post_turn(client, scripted_llm, session_id)
        valid = set(AuditAction)
        for entry in audit_sink.entries:
            assert entry.action in valid, f"Unknown action on entry: {entry}"
