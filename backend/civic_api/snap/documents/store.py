"""DocumentStore — persistence boundary for the document pipeline.

Two implementations:
  - InMemoryDocumentStore for tests + local dev. Holds blobs in-process.
  - The Supabase-backed implementation (Storage for the encrypted blob,
    Postgres snap_documents row for metadata) lives in
    repository_supabase.py once Phase E+1 wires it up.

The store is intentionally narrow: it doesn't know about the pipeline
or the LLM. It knows where the bytes go and what metadata stays
attached. Pipeline orchestration lives in pipeline.py and the FastAPI
handlers; persistence lives here.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from .schemas import DocumentType, ExtractionResult


@dataclass
class StoredDocument:
    document_id: str
    session_id: str
    media_type: str
    on_device_quality_passed: bool
    document_type: DocumentType = DocumentType.UNKNOWN
    extraction: ExtractionResult | None = None
    user_confirmed: bool = False
    user_corrections: dict | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class DocumentStore(ABC):
    @abstractmethod
    def create(
        self,
        *,
        session_id: str,
        image_bytes: bytes,
        media_type: str,
        on_device_quality_passed: bool,
    ) -> str: ...

    @abstractmethod
    def get_image(self, document_id: str) -> tuple[bytes, str]: ...

    @abstractmethod
    def get(self, document_id: str) -> StoredDocument: ...

    @abstractmethod
    def update_extraction(
        self,
        document_id: str,
        *,
        document_type: DocumentType,
        extraction: ExtractionResult,
    ) -> None: ...

    @abstractmethod
    def confirm(
        self,
        document_id: str,
        *,
        corrections: Optional[dict] = None,
    ) -> StoredDocument: ...

    @abstractmethod
    def list_session_documents(self, session_id: str) -> list[StoredDocument]: ...


class InMemoryDocumentStore(DocumentStore):
    def __init__(self) -> None:
        self._docs: dict[str, StoredDocument] = {}
        self._blobs: dict[str, tuple[bytes, str]] = {}

    def create(
        self,
        *,
        session_id: str,
        image_bytes: bytes,
        media_type: str,
        on_device_quality_passed: bool,
    ) -> str:
        document_id = str(uuid4())
        self._blobs[document_id] = (image_bytes, media_type)
        self._docs[document_id] = StoredDocument(
            document_id=document_id,
            session_id=session_id,
            media_type=media_type,
            on_device_quality_passed=on_device_quality_passed,
        )
        return document_id

    def get_image(self, document_id: str) -> tuple[bytes, str]:
        if document_id not in self._blobs:
            raise KeyError(f"Unknown document_id={document_id!r}")
        return self._blobs[document_id]

    def get(self, document_id: str) -> StoredDocument:
        if document_id not in self._docs:
            raise KeyError(f"Unknown document_id={document_id!r}")
        return self._docs[document_id]

    def update_extraction(
        self,
        document_id: str,
        *,
        document_type: DocumentType,
        extraction: ExtractionResult,
    ) -> None:
        doc = self.get(document_id)
        doc.document_type = document_type
        doc.extraction = extraction
        doc.updated_at = datetime.now(timezone.utc)

    def confirm(
        self,
        document_id: str,
        *,
        corrections: Optional[dict] = None,
    ) -> StoredDocument:
        doc = self.get(document_id)
        doc.user_confirmed = True
        doc.user_corrections = corrections
        doc.updated_at = datetime.now(timezone.utc)
        return doc

    def list_session_documents(self, session_id: str) -> list[StoredDocument]:
        return [d for d in self._docs.values() if d.session_id == session_id]
