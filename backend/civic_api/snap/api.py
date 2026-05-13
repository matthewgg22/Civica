"""FastAPI router for the SNAP conversational pipeline.

Endpoints expose the SnapPipelineOrchestrator over HTTPS for the iOS
client (and, eventually, the partner dashboard). Every route is sync
on the inside — FastAPI runs the handlers in a thread pool so they
don't block the event loop, which is the right tradeoff for a
workload dominated by LLM calls and PostgREST round-trips.

Design notes:
  - The orchestrator is built once at startup via factory.build_default_orchestrator
    and injected into each request through a closure. We don't use
    FastAPI's Depends() because the factory has its own configuration
    surface (env vars) and we want a single, traceable construction
    site.
  - User text on the wire is plaintext (HTTPS protects in transit; the
    Fernet layer protects at rest). The handler does not decrypt or
    encrypt — that's the repository's job.
  - Rate limiting and authentication are NOT in scope for this module.
    They belong in middleware in api.py before the request reaches us.
"""
import logging
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel, ConfigDict, Field

from .application.pdf import generate_application_pdf
from .audit.logger import AuditAction, AuditLogger
from .documents.pipeline import process_document
from .documents.schemas import DocumentType, ExtractionResult, Paystub
from .documents.store import DocumentStore, InMemoryDocumentStore
from .llm.client import LLMClient
from .pipeline.orchestrator import SnapPipelineOrchestrator
from .pipeline.schemas import TurnResult
from .rules.federal import FederalSNAPRules
from .rules.states.california import CaliforniaSNAPRules
from .rules.states.massachusetts import MassachusettsSNAPRules

logger = logging.getLogger(__name__)


# ===========================================================================
# Request bodies
# ===========================================================================


class StartSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    state: str = Field(min_length=2, max_length=2)
    language: str = Field(default="en", pattern=r"^[a-z]{2}(-[A-Z]{2})?$")


class StartSessionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str
    opening_turn: TurnResult


class SendTurnRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_text: str = Field(min_length=1, max_length=4000)


class RecoverSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=8, max_length=512)


class DocumentUploadResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str
    processing_status: str = Field(
        description="One of 'processing', 'awaiting_confirmation', 'rejected'."
    )


class DocumentStatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str
    session_id: str
    document_type: DocumentType
    on_device_quality_passed: bool
    user_confirmed: bool
    extraction: Optional[ExtractionResult] = None


class DocumentConfirmationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    corrections: Optional[dict] = Field(
        default=None,
        description=(
            "Optional Paystub-shaped diff. Keys must match Paystub field names. "
            "Phase E: corrections are stored verbatim; the rules engine input "
            "layer applies them when computing eligibility. Phase E+1: validate "
            "the shape and re-run validator against the merged result."
        ),
    )


# ===========================================================================
# Router factory
# ===========================================================================


def build_snap_router(
    orchestrator: SnapPipelineOrchestrator,
    *,
    document_store: Optional[DocumentStore] = None,
    llm_client: Optional[LLMClient] = None,
    audit_logger: Optional[AuditLogger] = None,
):
    """Construct an APIRouter bound to the supplied orchestrator.

    Returning a router (not registering on a passed-in app) lets the
    test suite mount this on a throwaway FastAPI app while production
    mounts it on the long-lived Civica API instance.

    `document_store` and `llm_client` default to in-memory + a fresh
    LLMClient — production overrides both with Supabase + a shared
    LLM client tied to the orchestrator.

    `audit_logger` is required for endpoint-level audit entries (PDF
    generation, document upload/confirm). When None, those endpoints
    skip audit writes — acceptable for tests but a misconfiguration
    in production. The audit-coverage CI test in tests/snap/compliance/
    drives every endpoint with a real logger to verify the contract.
    """
    document_store = document_store or InMemoryDocumentStore()
    llm_client = llm_client or orchestrator.llm_client

    router = APIRouter(prefix="/snap", tags=["snap"])

    @router.post("/sessions", response_model=StartSessionResponse)
    def post_session(payload: StartSessionRequest) -> StartSessionResponse:
        try:
            session_id, opening = orchestrator.start_session(
                state=payload.state.upper(),
                language=payload.language,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("start_session failed: %r", exc)
            raise HTTPException(status_code=500, detail="snap_start_session_failed") from exc
        return StartSessionResponse(session_id=session_id, opening_turn=opening)

    @router.post("/sessions/{session_id}/turns", response_model=TurnResult)
    def post_turn(session_id: str, payload: SendTurnRequest) -> TurnResult:
        try:
            return orchestrator.handle_user_turn(
                session_id=session_id,
                user_text=payload.user_text,
            )
        except KeyError:
            raise HTTPException(status_code=404, detail="snap_session_not_found")
        except Exception as exc:  # noqa: BLE001
            logger.exception("handle_user_turn failed for session=%s: %r", session_id, exc)
            raise HTTPException(status_code=500, detail="snap_turn_failed") from exc

    @router.post("/sessions/recover", response_model=StartSessionResponse)
    def post_recover(payload: RecoverSessionRequest) -> StartSessionResponse:
        # Phase D scope: stub. Real implementation lives alongside the
        # magic-link issuance flow (Twilio / email + signed token).
        # Returning 501 makes the contract explicit for callers.
        raise HTTPException(
            status_code=501,
            detail="snap_session_recovery_not_yet_implemented",
        )

    @router.get("/sessions/{session_id}/transcript", response_model=dict)
    def get_transcript(session_id: str) -> dict[str, Any]:
        try:
            turns = orchestrator.repository.list_turns(session_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="snap_session_not_found")
        return {
            "session_id": session_id,
            "turns": [
                {
                    "turn_id": t.turn_id,
                    "turn_index": t.turn_index,
                    "role": t.role,
                    "content": t.content,
                    "pipeline_stage": t.pipeline_stage,
                    "created_at": t.created_at.isoformat(),
                }
                for t in turns
            ],
        }

    # ---- documents -----------------------------------------------------

    @router.post(
        "/sessions/{session_id}/documents",
        response_model=DocumentUploadResponse,
    )
    def post_document(
        session_id: str,
        background_tasks: BackgroundTasks,
        file: UploadFile = File(...),
        on_device_quality_passed: bool = Form(default=True),
    ) -> DocumentUploadResponse:
        # 404 early if the session doesn't exist.
        try:
            orchestrator.repository.get_session_state(session_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="snap_session_not_found")

        image_bytes = file.file.read()
        media_type = file.content_type or "image/jpeg"
        document_id = document_store.create(
            session_id=session_id,
            image_bytes=image_bytes,
            media_type=media_type,
            on_device_quality_passed=on_device_quality_passed,
        )
        if audit_logger is not None:
            audit_logger.log(
                session_id=session_id,
                action=AuditAction.DOCUMENT_UPLOADED,
                actor_kind="anonymous_session",
                actor_id=session_id,
                reason=f"on_device_quality_passed={on_device_quality_passed}",
                column_or_resource=f"snap_documents/{document_id}",
            )

        if not on_device_quality_passed:
            return DocumentUploadResponse(
                document_id=document_id,
                processing_status="rejected",
            )

        background_tasks.add_task(
            _run_document_pipeline,
            document_store=document_store,
            llm_client=llm_client,
            document_id=document_id,
            session_id=session_id,
            image_bytes=image_bytes,
            media_type=media_type,
        )
        return DocumentUploadResponse(
            document_id=document_id,
            processing_status="processing",
        )

    @router.get("/documents/{document_id}", response_model=DocumentStatusResponse)
    def get_document_status(document_id: str) -> DocumentStatusResponse:
        try:
            doc = document_store.get(document_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="snap_document_not_found")
        return DocumentStatusResponse(
            document_id=doc.document_id,
            session_id=doc.session_id,
            document_type=doc.document_type,
            on_device_quality_passed=doc.on_device_quality_passed,
            user_confirmed=doc.user_confirmed,
            extraction=doc.extraction,
        )

    @router.post(
        "/documents/{document_id}/confirm",
        response_model=DocumentStatusResponse,
    )
    def post_document_confirmation(
        document_id: str, payload: DocumentConfirmationRequest
    ) -> DocumentStatusResponse:
        try:
            doc = document_store.confirm(
                document_id, corrections=payload.corrections
            )
        except KeyError:
            raise HTTPException(status_code=404, detail="snap_document_not_found")
        if audit_logger is not None:
            audit_logger.log(
                session_id=doc.session_id,
                action=AuditAction.DOCUMENT_CONFIRMED,
                actor_kind="anonymous_session",
                actor_id=doc.session_id,
                reason=(
                    "user confirmed"
                    + (" with corrections" if payload.corrections else "")
                ),
                column_or_resource=f"snap_documents/{doc.document_id}",
            )
        return DocumentStatusResponse(
            document_id=doc.document_id,
            session_id=doc.session_id,
            document_type=doc.document_type,
            on_device_quality_passed=doc.on_device_quality_passed,
            user_confirmed=doc.user_confirmed,
            extraction=doc.extraction,
        )

    # ---- application PDF -----------------------------------------------

    @router.post("/sessions/{session_id}/application/pdf")
    def post_application_pdf(session_id: str) -> Response:
        try:
            partial = orchestrator.repository.get_session_state(session_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="snap_session_not_found")

        # Compute eligibility on demand. If the partial state isn't yet
        # finalizable, the PDF still renders — it just shows
        # 'insufficient_information' with whatever facts have been
        # collected so far. Useful for users who want a partial-progress
        # printout to bring to a benefits navigator.
        eligibility = None
        if partial.is_finalizable():
            household = partial.to_household()
            rules_class: type
            normalized_state = (partial.state or "").upper()
            if normalized_state == "CA":
                rules_class = CaliforniaSNAPRules
            elif normalized_state == "MA":
                rules_class = MassachusettsSNAPRules
            else:
                rules_class = FederalSNAPRules
            rules = rules_class(effective_date=orchestrator.effective_date)
            eligibility = rules.determine_eligibility(household)

        # Collect confirmed paystubs from the document store so they
        # appear in the income section of the PDF.
        confirmed_paystubs = [
            d.extraction.extracted_paystub
            for d in document_store.list_session_documents(session_id)
            if d.user_confirmed
            and d.extraction is not None
            and d.extraction.extracted_paystub is not None
        ]

        try:
            generated = generate_application_pdf(
                session_id=session_id,
                state=partial.state or "MA",
                language=orchestrator.repository.session_language(session_id),
                partial_household=partial,
                eligibility=eligibility,
                confirmed_paystubs=confirmed_paystubs,
                audit_logger=audit_logger,
                audit_actor_kind="anonymous_session",
                audit_actor_id=session_id,
            )
        except Exception:
            logger.exception("PDF generation failed for session=%s", session_id)
            raise HTTPException(status_code=500, detail="snap_pdf_generation_failed")

        filename = f"civica-snap-summary-{session_id[:8]}.pdf"
        return Response(
            content=generated.pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-SNAP-Rendering-Path": generated.rendering_path,
            },
        )

    @router.get("/healthz")
    def healthz() -> dict[str, str]:
        return {"status": "ok", "vertical": "snap"}

    return router


def _run_document_pipeline(
    *,
    document_store: DocumentStore,
    llm_client: LLMClient,
    document_id: str,
    session_id: str,
    image_bytes: bytes,
    media_type: str,
) -> None:
    """Background task body. Errors are logged but never propagate —
    iOS sees the document stay in 'processing' state if the pipeline
    fails, then retries on the user's next action."""
    try:
        prior = [
            d.extraction.extracted_paystub
            for d in document_store.list_session_documents(session_id)
            if d.user_confirmed
            and d.extraction is not None
            and d.extraction.extracted_paystub is not None
            and d.document_id != document_id
        ]
        result, _telemetry = process_document(
            client=llm_client,
            image_bytes=image_bytes,
            media_type=media_type,
            prior_paystubs=prior,
        )
        document_store.update_extraction(
            document_id,
            document_type=result.classification.document_type,
            extraction=result,
        )
    except Exception:  # noqa: BLE001
        logger.exception(
            "SNAP document pipeline failed for document_id=%s", document_id
        )
