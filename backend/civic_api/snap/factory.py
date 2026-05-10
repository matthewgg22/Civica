"""Build the SnapPipelineOrchestrator for the running environment.

Production: SupabaseSnapPipelineRepository + LLMClient with real
Anthropic/OpenAI keys.
Tests: InMemorySnapPipelineRepository + a scripted/mock LLM client
passed in directly to the orchestrator constructor.

This factory is the single place that knows how to wire up real-world
dependencies. FastAPI handlers call build_default_orchestrator() once
at startup; everything else takes the orchestrator as a parameter.
"""
from __future__ import annotations

import logging
import os
from datetime import date, datetime, timezone

from .llm.client import LLMClient
from .pipeline.orchestrator import SnapPipelineOrchestrator
from .pipeline.repository import (
    InMemorySnapPipelineRepository,
    SnapPipelineRepository,
)

logger = logging.getLogger(__name__)


def _select_repository_backend() -> str:
    configured = os.environ.get("SNAP_REPOSITORY", "").strip().lower()
    if configured:
        return configured
    has_supabase = bool(
        os.environ.get("SUPABASE_URL", "").strip()
        and os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    )
    has_fernet = bool(os.environ.get("SNAP_FERNET_KEY", "").strip())
    if has_supabase and has_fernet:
        return "supabase"
    return "inmemory"


def build_repository() -> SnapPipelineRepository:
    backend = _select_repository_backend()
    if backend == "supabase":
        # Local import keeps the cryptography dependency optional for
        # environments running the in-memory repository (eval harness, CI).
        from .repository_supabase import SupabaseSnapPipelineRepository

        return SupabaseSnapPipelineRepository()
    if backend == "inmemory":
        env = os.environ.get("VOTENOW_ENV", "").strip().lower()
        if env in {"prod", "production"}:
            raise RuntimeError(
                "InMemorySnapPipelineRepository is not allowed in production. "
                "Set SNAP_REPOSITORY=supabase, configure SUPABASE_URL / "
                "SUPABASE_SERVICE_ROLE_KEY, and provide SNAP_FERNET_KEY."
            )
        return InMemorySnapPipelineRepository()
    raise RuntimeError(f"Unsupported SNAP_REPOSITORY={backend!r}.")


def build_default_orchestrator(
    *,
    effective_date: date | None = None,
) -> SnapPipelineOrchestrator:
    repo = build_repository()
    client = LLMClient()
    eff_date = effective_date or _today_utc()
    backend = _select_repository_backend()
    logger.info(
        "SNAP orchestrator built: repository=%s effective_date=%s",
        backend,
        eff_date.isoformat(),
    )
    return SnapPipelineOrchestrator(
        llm_client=client,
        repository=repo,
        effective_date=eff_date,
    )


def _today_utc() -> date:
    return datetime.now(timezone.utc).date()
