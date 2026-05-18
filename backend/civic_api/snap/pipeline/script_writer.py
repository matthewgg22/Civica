"""Script-Writer stage — LLM call that turns a question topic into the
actual user-facing question text.

Higher-quality model (Anthropic Sonnet) because tone, language quality,
and reading-level calibration matter most here. The user reads exactly
what this stage generates.
"""
from __future__ import annotations

import json

from ..llm.client import LLMCallTelemetry, LLMClient
from .prompts import SCRIPT_WRITER_PROMPT
from .schemas import (
    AskSelectorOutput,
    PartialHousehold,
    ScriptWriterOutput,
    serialize_partial_household_for_prompt,
)


DEFAULT_SCRIPT_WRITER_MODEL = "claude-sonnet-4-6"


def run_script_writer(
    *,
    client: LLMClient,
    ask_decision: AskSelectorOutput,
    state: PartialHousehold,
    language: str = "en",
    model: str = DEFAULT_SCRIPT_WRITER_MODEL,
) -> tuple[ScriptWriterOutput, LLMCallTelemetry]:
    user_message = json.dumps(
        {
            "next_topic": ask_decision.next_topic.value,
            "justification": ask_decision.justification,
            "is_clarification": ask_decision.is_clarification,
            "clarification_text": ask_decision.clarification_text,
            "session_state": serialize_partial_household_for_prompt(state),
        },
        ensure_ascii=False,
        default=str,
    )
    return client.call_with_schema(
        model=model,
        schema=ScriptWriterOutput,
        system=SCRIPT_WRITER_PROMPT,
        messages=[{"role": "user", "content": user_message}],
        language=language,
        max_tokens=512,
    )
