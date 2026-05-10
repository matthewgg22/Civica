"""End-to-end test: drive a full conversation, then hit the application
PDF endpoint and confirm a real PDF comes back."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.civic_api.snap.api import build_snap_router
from backend.civic_api.snap.documents.store import InMemoryDocumentStore
from backend.civic_api.snap.pipeline.orchestrator import SnapPipelineOrchestrator
from backend.civic_api.snap.pipeline.repository import InMemorySnapPipelineRepository
from backend.civic_api.snap.pipeline.schemas import (
    HouseholdMemberUpdate,
    InterpreterOutput,
    IncomeSourceUpdate,
)
from backend.civic_api.snap.rules.interfaces import (
    CitizenshipStatus,
    StudentExemption,
    StudentStatus,
    SUATier,
)
from tests.snap.pipeline.conftest import ScriptedLLMClient


@pytest.fixture
def scripted_llm() -> ScriptedLLMClient:
    return ScriptedLLMClient()


@pytest.fixture
def store() -> InMemoryDocumentStore:
    return InMemoryDocumentStore()


@pytest.fixture
def client(scripted_llm, store) -> TestClient:
    repo = InMemorySnapPipelineRepository()
    orchestrator = SnapPipelineOrchestrator(
        llm_client=scripted_llm,
        repository=repo,
        effective_date=date(2025, 5, 10),
    )
    app = FastAPI()
    app.include_router(
        build_snap_router(orchestrator, document_store=store, llm_client=scripted_llm)
    )
    return TestClient(app)


def _drive_canonical_demo_to_terminal(client, scripted_llm) -> str:
    """Walk the orchestrator through the canonical eligible case and
    return the resulting session_id."""
    scripted_llm.push_script_writer(question_text="Hi.")
    session = client.post("/snap/sessions", json={"state": "MA"}).json()
    session_id = session["session_id"]

    # Single rich turn that fills everything the rules engine needs.
    scripted_llm.push_interpreter(
        confidence=0.96,
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
        income_sources_added=[
            IncomeSourceUpdate(
                member_id="applicant",
                source_type="wages",
                monthly_gross=Decimal("1800"),
                is_earned=True,
            )
        ],
        rent_or_mortgage=Decimal("1400"),
        sua_tier=SUATier.HEATING_COOLING,
        receives_tanf=False,
        receives_ssi=False,
        receives_general_assistance=False,
        is_homeless=False,
    )
    client.post(
        f"/snap/sessions/{session_id}/turns",
        json={"user_text": "32, citizen, $1,800/mo from work, $1,400 rent, heat included, no benefits, stable housing"},
    )
    return session_id


class TestApplicationPDFEndpoint:
    def test_returns_pdf_for_eligible_session(self, client, scripted_llm):
        session_id = _drive_canonical_demo_to_terminal(client, scripted_llm)

        response = client.post(f"/snap/sessions/{session_id}/application/pdf")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.headers["content-disposition"].startswith("attachment;")
        assert response.headers["x-snap-rendering-path"] == "summary"
        assert response.content.startswith(b"%PDF-")
        assert len(response.content) > 3000

    def test_renders_when_eligibility_not_yet_determined(self, client, scripted_llm):
        # Start a session but don't drive it to terminal — should still
        # produce a PDF (insufficient_information).
        scripted_llm.push_script_writer(question_text="Hi.")
        session = client.post("/snap/sessions", json={"state": "MA"}).json()

        response = client.post(f"/snap/sessions/{session['session_id']}/application/pdf")
        assert response.status_code == 200
        assert response.content.startswith(b"%PDF-")

    def test_unknown_session_returns_404(self, client):
        response = client.post("/snap/sessions/does-not-exist/application/pdf")
        assert response.status_code == 404

    def test_filename_includes_session_prefix(self, client, scripted_llm):
        scripted_llm.push_script_writer(question_text="Hi.")
        session = client.post("/snap/sessions", json={"state": "MA"}).json()
        session_id = session["session_id"]

        response = client.post(f"/snap/sessions/{session_id}/application/pdf")
        assert session_id[:8] in response.headers["content-disposition"]
