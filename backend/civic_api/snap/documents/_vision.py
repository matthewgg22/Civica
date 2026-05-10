"""Helpers for constructing vision messages for the LLM client.

The provider-abstracted LLMClient.call_with_schema already accepts
arbitrary message dicts. Both Anthropic and OpenAI happen to use the
same content-block shape for images (a list of `{"type": "image",
"source": {...}}` and `{"type": "text", "text": ...}` items), so we
build a single message that works for both. The provider-side
adaptation is the SDK's job, not ours.
"""
from __future__ import annotations

import base64
from typing import Any


def build_vision_message(
    *,
    image_bytes: bytes,
    media_type: str = "image/jpeg",
    instruction: str,
) -> list[dict[str, Any]]:
    """Build a single-user-message payload with one image and a text instruction.

    Anthropic accepts media types: image/jpeg, image/png, image/gif, image/webp.
    OpenAI accepts the same set. Larger images are downsampled by the
    provider; the caller does not need to resize.
    """
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return [
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": encoded,
                    },
                },
                {"type": "text", "text": instruction},
            ],
        }
    ]
