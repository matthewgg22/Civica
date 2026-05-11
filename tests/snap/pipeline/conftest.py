"""Shared fixtures for the SNAP conversational-pipeline tests.

The LLMClient is mocked via a `ScriptedLLMClient` that returns canned
responses based on the schema and an optional script of expected
outputs. This lets every pipeline test run deterministically without
network calls or API keys.
"""
from __future__ import annotations

from collections import deque
from datetime import date
from decimal import Decimal
from typing import Any

import pytest

from backend.civic_api.snap.llm.client import LLMCallTelemetry, LLMClient
from backend.civic_api.snap.pipeline.orchestrator import SnapPipelineOrchestrator
from backend.civic_api.snap.pipeline.repository import InMemorySnapPipelineRepository
from backend.civic_api.snap.pipeline.schemas import (
    ExpectedInputType,
    InterpreterOutput,
    ScriptWriterOutput,
)


class ScriptedLLMClient(LLMClient):
    """Deterministic LLMClient stand-in for tests.

    Each test pushes a script of (schema, payload) tuples; calls return
    them in order. A test that consumes the script unexpectedly raises
    so we never silently fall through to a real LLM.
    """

    def __init__(self) -> None:
        # Skip super().__init__() to avoid the API-key requirement.
        self._script: deque[Any] = deque()
        self.calls: list[dict] = []

    def push(self, payload: Any) -> None:
        """Add one canned response. Order matches call order."""
        self._script.append(payload)

    def push_interpreter(self, **kwargs: Any) -> None:
        defaults = {
            "confidence": 0.95,
            "needs_clarification": False,
        }
        defaults.update(kwargs)
        self.push(InterpreterOutput(**defaults))

    def push_script_writer(self, question_text: str = "Test question?", **kwargs: Any) -> None:
        defaults = {
            "question_text": question_text,
            "expected_input_type": ExpectedInputType.FREE_TEXT,
        }
        defaults.update(kwargs)
        self.push(ScriptWriterOutput(**defaults))

    def call_with_schema(
        self,
        *,
        model: str,
        schema: type,
        system: str,
        messages: list[dict[str, Any]],
        language: str = "en",
    ):
        if not self._script:
            raise AssertionError(
                f"ScriptedLLMClient called with no scripted payload. "
                f"model={model!r} schema={schema.__name__!r}. "
                f"Push expected outputs before calling the orchestrator."
            )
        payload = self._script.popleft()
        if not isinstance(payload, schema):
            raise AssertionError(
                f"Scripted payload type mismatch: expected {schema.__name__!r}, "
                f"got {type(payload).__name__!r}."
            )
        self.calls.append({"model": model, "schema": schema.__name__, "language": language})
        telemetry = LLMCallTelemetry(
            model_used=model,
            provider_used="scripted",
            input_tokens=100,
            output_tokens=50,
            latency_ms=10,
            cost_usd=Decimal("0.0001"),
        )
        return payload, telemetry


@pytest.fixture
def scripted_llm() -> ScriptedLLMClient:
    return ScriptedLLMClient()


@pytest.fixture
def repo() -> InMemorySnapPipelineRepository:
    return InMemorySnapPipelineRepository()


@pytest.fixture
def orchestrator(scripted_llm, repo) -> SnapPipelineOrchestrator:
    return SnapPipelineOrchestrator(
        llm_client=scripted_llm,
        repository=repo,
        effective_date=date(2025, 5, 10),
    )
