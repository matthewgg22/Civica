"""Provider-abstracted LLM client used by the SNAP conversational pipeline.

Default provider is Anthropic (Claude Haiku for cheap routing stages,
Claude Sonnet for quality stages). OpenAI is wired as a fallback for
provider availability incidents only.
"""

from .client import LLMClient, LLMCallTelemetry, ProviderUnavailable

__all__ = ["LLMClient", "LLMCallTelemetry", "ProviderUnavailable"]
