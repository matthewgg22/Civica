"""Interpreter stage — LLM call that turns one user utterance into an InterpreterOutput.

Cheap model (Anthropic Haiku) because this runs every turn. The
structured-output discipline in LLMClient guarantees we get a valid
InterpreterOutput or a raised exception; nothing in between.
"""
from __future__ import annotations

import json
from typing import Any

from ..llm.client import LLMCallTelemetry, LLMClient
from .prompts import INTERPRETER_PROMPT
from .schemas import (
    InterpreterOutput,
    PartialHousehold,
    QuestionTopic,
    serialize_partial_household_for_prompt,
)


DEFAULT_INTERPRETER_MODEL = "claude-haiku-4-5"


def run_interpreter(
    *,
    client: LLMClient,
    user_utterance: str,
    accumulated_state: PartialHousehold,
    pending_topic: QuestionTopic,
    language: str = "en",
    model: str = DEFAULT_INTERPRETER_MODEL,
) -> tuple[InterpreterOutput, LLMCallTelemetry]:
    """Run the Interpreter stage.

    Returns the parsed Pydantic output plus per-call telemetry for cost
    tracking. The orchestrator persists both.
    """
    user_message = _build_user_message(
        utterance=user_utterance,
        accumulated_state=accumulated_state,
        pending_topic=pending_topic,
    )
    return client.call_with_schema(
        model=model,
        schema=InterpreterOutput,
        system=INTERPRETER_PROMPT,
        messages=[{"role": "user", "content": user_message}],
        language=language,
    )


def _build_user_message(
    *,
    utterance: str,
    accumulated_state: PartialHousehold,
    pending_topic: QuestionTopic,
) -> str:
    payload: dict[str, Any] = {
        "raw_user_utterance": utterance,
        "pending_topic": pending_topic.value,
        "accumulated_context": serialize_partial_household_for_prompt(accumulated_state),
    }
    return json.dumps(payload, ensure_ascii=False, default=str)
