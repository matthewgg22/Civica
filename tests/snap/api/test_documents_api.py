"""Document FastAPI endpoint tests."""
from __future__ import annotations

import io
from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.civic_api.snap.api import build_snap_router
from backend.civic_api.snap.documents.schemas import (
    DocumentClassification,
    DocumentClassificationConfidence,
    DocumentType,
)
from backend.civic_api.snap.documents.store import InMemoryDocumentStore
from backend.civic_api.snap.pipeline.orchestrator import SnapPipelineOrchestrator
from backend.civic_api.snap.pipeline.repository import InMemorySnapPipelineRepository
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


def _classification(
    *,
    document_type: DocumentType = DocumentType.PAYSTUB,
    confidence: float = 0.95,
    band: DocumentClassificationConfidence = DocumentClassificationConfidence.HIGH,
) -> DocumentClassification:
    return DocumentClassification(
        document_type=document_type,
        confidence=confidence,
        confidence_band=band,
        rationale="Visible header.",
    )


def _start_session(client, scripted_llm) -> str:
    scripted_llm.push_script_writer(question_text="Hi.")
    response = client.post("/snap/sessions", json={"state": "MA"})
    return response.json()["session_id"]


class TestDocumentUpload:
    def test_uploads_paystub_and_runs_pipeline(
        self, client, scripted_llm, store, make_paystub
    ):
        session_id = _start_session(client, scripted_llm)
        # Pre-load the responses the BackgroundTask will consume.
        scripted_llm.push(_classification())
        scripted_llm.push(make_paystub())

        files = {"file": ("paystub.jpg", io.BytesIO(b"\xFF\xD8\xFF\xE0fake"), "image/jpeg")}
        response = client.post(
            f"/snap/sessions/{session_id}/documents",
            files=files,
            data={"on_device_quality_passed": "true"},
        )
        assert response.status_code == 200
        body = response.json()
        document_id = body["document_id"]
        assert body["processing_status"] == "processing"

        # BackgroundTasks runs synchronously under TestClient before the
        # response unblocks; the doc should already have an extraction.
        status = client.get(f"/snap/documents/{document_id}").json()
        assert status["document_type"] == "paystub"
        assert status["extraction"] is not None
        assert status["extraction"]["extracted_paystub"]["employer_name"] == "Acme Retail"

    def test_low_quality_upload_rejected_no_pipeline_run(
        self, client, scripted_llm, store
    ):
        session_id = _start_session(client, scripted_llm)
        # Snapshot the call count after session setup (which itself runs
        # one Script-Writer call) so we can detect any pipeline calls
        # caused by the upload.
        baseline_call_count = len(scripted_llm.calls)

        files = {"file": ("blurry.jpg", io.BytesIO(b"\xFF\xD8\xFF\xE0blur"), "image/jpeg")}
        response = client.post(
            f"/snap/sessions/{session_id}/documents",
            files=files,
            data={"on_device_quality_passed": "false"},
        )
        body = response.json()
        assert body["processing_status"] == "rejected"

        # No classifier/extractor calls should have happened.
        assert len(scripted_llm.calls) == baseline_call_count

    def test_unknown_session_returns_404(self, client):
        files = {"file": ("paystub.jpg", io.BytesIO(b"\xFF"), "image/jpeg")}
        response = client.post(
            "/snap/sessions/does-not-exist/documents",
            files=files,
            data={"on_device_quality_passed": "true"},
        )
        assert response.status_code == 404


class TestDocumentStatus:
    def test_returns_404_for_unknown_document(self, client):
        response = client.get("/snap/documents/does-not-exist")
        assert response.status_code == 404


class TestDocumentConfirmation:
    def test_confirms_document(self, client, scripted_llm, make_paystub):
        session_id = _start_session(client, scripted_llm)
        scripted_llm.push(_classification())
        scripted_llm.push(make_paystub())

        files = {"file": ("paystub.jpg", io.BytesIO(b"\xFF"), "image/jpeg")}
        upload = client.post(
            f"/snap/sessions/{session_id}/documents",
            files=files,
            data={"on_device_quality_passed": "true"},
        )
        document_id = upload.json()["document_id"]

        response = client.post(
            f"/snap/documents/{document_id}/confirm",
            json={"corrections": None},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["user_confirmed"] is True

    def test_confirms_with_corrections_payload(
        self, client, scripted_llm, make_paystub
    ):
        session_id = _start_session(client, scripted_llm)
        scripted_llm.push(_classification())
        scripted_llm.push(make_paystub())

        files = {"file": ("paystub.jpg", io.BytesIO(b"\xFF"), "image/jpeg")}
        upload = client.post(
            f"/snap/sessions/{session_id}/documents",
            files=files,
            data={"on_device_quality_passed": "true"},
        )
        document_id = upload.json()["document_id"]

        response = client.post(
            f"/snap/documents/{document_id}/confirm",
            json={"corrections": {"employer_name": "Acme Retail Corp"}},
        )
        assert response.status_code == 200
        # Phase E persists corrections verbatim; Phase E+1 will validate
        # and re-run the validator.
        assert response.json()["user_confirmed"] is True

    def test_unknown_document_returns_404(self, client):
        response = client.post(
            "/snap/documents/does-not-exist/confirm",
            json={"corrections": None},
        )
        assert response.status_code == 404
