"""Provider-abstracted LLM client for the SNAP conversational pipeline.

Why an abstraction layer: when (not if) Anthropic has an outage, the
pipeline must keep working. This client tries Anthropic first, retries
on transient errors, and falls back to OpenAI's equivalent model on the
final failure. ~150 lines of code that pay for themselves the first
time a provider has an incident.

What this client does NOT do:
  - Free-text generation. Every call requires a Pydantic schema and
    returns a validated instance. If the model output doesn't fit the
    schema, the call is retried; persistent failure raises.
  - Stateful conversation. The pipeline orchestrator passes whatever
    accumulated context it wants on each call.

Per-call telemetry (tokens, cost, latency, retries) is returned alongside
the parsed result so the orchestrator can persist it for cost tracking
and the eval harness can assert cost ceilings.
"""
from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class ProviderUnavailable(RuntimeError):
    """Both providers exhausted retries. The orchestrator surfaces this
    to the caller as a 503; the iOS client retries with backoff."""


# Pricing per million tokens (input / output), USD. Update with each provider price change.
# Used only for telemetry; no business logic depends on these numbers.
_PRICING = {
    "claude-haiku-4-5": (Decimal("1.00"), Decimal("5.00")),
    "claude-sonnet-4-6": (Decimal("3.00"), Decimal("15.00")),
    "gpt-4o-mini": (Decimal("0.15"), Decimal("0.60")),
    "gpt-4o": (Decimal("2.50"), Decimal("10.00")),
}

# Anthropic <-> OpenAI fallback equivalence. Picked to match cost tier and
# instruction-following quality, not raw model size.
_FALLBACK_MODEL = {
    "claude-haiku-4-5": "gpt-4o-mini",
    "claude-sonnet-4-6": "gpt-4o",
}


@dataclass
class LLMCallTelemetry:
    model_used: str
    provider_used: str
    input_tokens: int = 0
    output_tokens: int = 0
    cache_creation_input_tokens: int = 0
    cache_read_input_tokens: int = 0
    latency_ms: int = 0
    retries: int = 0
    fell_back_from_anthropic: bool = False
    cost_usd: Decimal = field(default_factory=lambda: Decimal("0"))


class LLMClient:
    """Thin wrapper. The Anthropic and OpenAI SDKs are imported lazily so
    a missing optional dependency (e.g. in CI without OpenAI key) doesn't
    block import of the rules engine."""

    def __init__(
        self,
        *,
        anthropic_api_key: str | None = None,
        openai_api_key: str | None = None,
        max_retries: int = 2,
        timeout_seconds: float = 30.0,
    ) -> None:
        self._anthropic_api_key = anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY", "").strip() or None
        self._openai_api_key = openai_api_key or os.environ.get("OPENAI_API_KEY", "").strip() or None
        self._max_retries = max_retries
        self._timeout_seconds = timeout_seconds
        self._anthropic = None
        self._openai = None

    # ---- public API --------------------------------------------------

    def call_with_schema(
        self,
        *,
        model: str,
        schema: type[T],
        system: str,
        messages: list[dict[str, Any]],
        language: str = "en",
    ) -> tuple[T, LLMCallTelemetry]:
        """Run the LLM with structured output. Returns the parsed Pydantic
        instance plus per-call telemetry.

        The `language` parameter is appended to the system prompt as a
        directive ("Respond only in <language>."). Every stage of the
        pipeline threads it through unmodified."""
        system_localized = (
            f"{system}\n\nRespond ONLY in {language}. All user-facing text must be in {language}."
        )

        anthropic_error: Exception | None = None
        if self._anthropic_api_key:
            try:
                return self._call_anthropic(
                    model=model,
                    schema=schema,
                    system=system_localized,
                    messages=messages,
                )
            except Exception as exc:  # noqa: BLE001 — fallback intent
                anthropic_error = exc
                logger.warning(
                    "Anthropic call failed for model=%s; attempting OpenAI fallback. error=%r",
                    model,
                    exc,
                )

        fallback_model = _FALLBACK_MODEL.get(model)
        if not fallback_model or not self._openai_api_key:
            raise ProviderUnavailable(
                f"Anthropic call failed and no OpenAI fallback configured "
                f"(model={model}, anthropic_key={bool(self._anthropic_api_key)}, "
                f"openai_key={bool(self._openai_api_key)})."
            ) from anthropic_error

        result, telemetry = self._call_openai(
            model=fallback_model,
            schema=schema,
            system=system_localized,
            messages=messages,
        )
        telemetry.fell_back_from_anthropic = True
        return result, telemetry

    # ---- providers ---------------------------------------------------

    def _call_anthropic(
        self,
        *,
        model: str,
        schema: type[T],
        system: str,
        messages: list[dict[str, Any]],
    ) -> tuple[T, LLMCallTelemetry]:
        if self._anthropic is None:
            import anthropic  # type: ignore[import-not-found]

            self._anthropic = anthropic.Anthropic(api_key=self._anthropic_api_key, timeout=self._timeout_seconds)

        # Cache the static system prompt so repeated turns in the same
        # conversation pay 10% of input price instead of full price for
        # the prompt tokens.
        cached_system = [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]

        retries = 0
        last_validation_error: ValidationError | None = None
        while retries <= self._max_retries:
            t0 = time.monotonic()
            response = self._anthropic.messages.create(
                model=model,
                max_tokens=2048,
                system=cached_system,
                messages=messages,
                tools=[
                    {
                        "name": "respond",
                        "description": f"Return a {schema.__name__} object.",
                        "input_schema": schema.model_json_schema(),
                    }
                ],
                tool_choice={"type": "tool", "name": "respond"},
            )
            latency_ms = int((time.monotonic() - t0) * 1000)

            tool_use = next(
                (block for block in response.content if getattr(block, "type", None) == "tool_use"),
                None,
            )
            if tool_use is None:
                retries += 1
                continue

            try:
                parsed = schema.model_validate(tool_use.input)
            except ValidationError as ve:
                last_validation_error = ve
                retries += 1
                continue

            input_tokens = getattr(response.usage, "input_tokens", 0)
            output_tokens = getattr(response.usage, "output_tokens", 0)
            cache_creation = getattr(response.usage, "cache_creation_input_tokens", 0) or 0
            cache_read = getattr(response.usage, "cache_read_input_tokens", 0) or 0
            telemetry = LLMCallTelemetry(
                model_used=model,
                provider_used="anthropic",
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cache_creation_input_tokens=cache_creation,
                cache_read_input_tokens=cache_read,
                latency_ms=latency_ms,
                retries=retries,
                cost_usd=_compute_cost(model, input_tokens, output_tokens, cache_creation, cache_read),
            )
            return parsed, telemetry

        raise RuntimeError(
            f"Anthropic returned invalid output {self._max_retries + 1} times for {schema.__name__}: "
            f"{last_validation_error!r}"
        )

    def _call_openai(
        self,
        *,
        model: str,
        schema: type[T],
        system: str,
        messages: list[dict[str, Any]],
    ) -> tuple[T, LLMCallTelemetry]:
        if self._openai is None:
            import openai  # type: ignore[import-not-found]

            self._openai = openai.OpenAI(api_key=self._openai_api_key, timeout=self._timeout_seconds)

        retries = 0
        last_validation_error: ValidationError | None = None
        while retries <= self._max_retries:
            t0 = time.monotonic()
            response = self._openai.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": system}, *messages],
                response_format={"type": "json_schema", "json_schema": {
                    "name": schema.__name__,
                    "schema": schema.model_json_schema(),
                    "strict": True,
                }},
            )
            latency_ms = int((time.monotonic() - t0) * 1000)
            content = response.choices[0].message.content or ""

            try:
                parsed = schema.model_validate_json(content)
            except ValidationError as ve:
                last_validation_error = ve
                retries += 1
                continue

            usage = response.usage
            input_tokens = getattr(usage, "prompt_tokens", 0)
            output_tokens = getattr(usage, "completion_tokens", 0)
            telemetry = LLMCallTelemetry(
                model_used=model,
                provider_used="openai",
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                latency_ms=latency_ms,
                retries=retries,
                cost_usd=_compute_cost(model, input_tokens, output_tokens),
            )
            return parsed, telemetry

        raise RuntimeError(
            f"OpenAI returned invalid output {self._max_retries + 1} times for {schema.__name__}: "
            f"{last_validation_error!r}"
        )


def _compute_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
    cache_creation_tokens: int = 0,
    cache_read_tokens: int = 0,
) -> Decimal:
    pricing = _PRICING.get(model)
    if pricing is None:
        return Decimal("0")
    in_rate, out_rate = pricing
    # Cache reads are billed at 10% of the regular input rate.
    # Cache creation is billed at the regular input rate.
    return (
        Decimal(input_tokens) * in_rate / Decimal(1_000_000)
        + Decimal(output_tokens) * out_rate / Decimal(1_000_000)
        + Decimal(cache_creation_tokens) * in_rate / Decimal(1_000_000)
        + Decimal(cache_read_tokens) * in_rate / Decimal(10_000_000)
    )
