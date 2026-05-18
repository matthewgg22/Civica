"""Sentry beforeSend PII scrubber for the civica-snap-engine FastAPI service.

Mirrors the Node services' scrubEvent + PII_KEYS pattern:
  - apps/api/src/lib/sentry.ts
  - apps/enrollment-api/src/lib/sentry.ts

Per the launch-readiness runbook and OBBBA §10108 noncitizen
disclosure obligations, no PII may leave the service in a Sentry
error event. `send_default_pii=False` in sentry_sdk.init prevents
auto-captured IP/cookies, but if any code path stuffs a payload
dict into Sentry context (via sentry_sdk.set_context, sentry_sdk.
capture_message with extras, or breadcrumb data), the dict values
go to Sentry unredacted unless before_send rewrites them.

This scrubber walks event request/extra/contexts/breadcrumbs and
replaces any dict key in PII_KEYS with the literal "[Redacted]"
string. Lists and nested dicts are descended up to MAX_DEPTH.

Symmetry with Node side is intentional: the same key blocks the
same data on either service.
"""

from __future__ import annotations

from typing import Any


# Keys whose values are always redacted before a Sentry event leaves
# the process. Must stay in sync with PII_KEYS in
# apps/enrollment-api/src/lib/logger.ts.
PII_KEYS: frozenset[str] = frozenset(
    {
        # Auth
        "authorization", "cookie", "password", "token",
        # Names / contact
        "applicant_name", "full_name", "first_name", "last_name", "name",
        "email", "phone", "phone_number",
        # Identity
        "applicant_id",
        "dob", "ssn", "ssn_last4",
        # DB columns marked COMMENT 'PII' in supabase migrations
        "body_ciphertext",
        "ip_address",
        "original_filename",
        "raw_ocr_ciphertext",
        "applicant_answer",
        "original_ocr_value",
        "old_values",
        "new_values",
        # Fernet ciphertext columns — should never appear in events
        "content_ciphertext",
        "snapshot_ciphertext",
        "extracted_payload_ciphertext",
        "user_corrections_ciphertext",
        "household_snapshot_ciphertext",
        "result_ciphertext",
        "full_name_ciphertext",
    }
)

REDACTED = "[Redacted]"
MAX_DEPTH = 8


def _redact(value: Any, depth: int = 0) -> Any:
    if depth > MAX_DEPTH:
        return value
    if isinstance(value, dict):
        return {
            k: REDACTED if k in PII_KEYS else _redact(v, depth + 1)
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [_redact(item, depth + 1) for item in value]
    if isinstance(value, tuple):
        return tuple(_redact(item, depth + 1) for item in value)
    return value


def scrub_event(event: dict[str, Any], hint: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """Sentry SDK `before_send` callback.

    Recursively redacts PII_KEYS values across the event payload.
    Returns the event so Sentry continues to ship it; returning None
    would drop the event entirely.

    The `hint` arg is part of the Sentry SDK signature; we ignore it
    here because the redaction rule does not depend on the original
    exception object.
    """
    del hint  # unused — present to match SDK signature
    if not isinstance(event, dict):
        return event

    # request: { url, method, headers, cookies, env, data, query_string }
    if "request" in event and isinstance(event["request"], dict):
        event["request"] = _redact(event["request"])

    # contexts / extra: arbitrary key/value bags developers populate
    for top_key in ("contexts", "extra", "tags", "user"):
        if top_key in event and isinstance(event[top_key], dict):
            event[top_key] = _redact(event[top_key])

    # breadcrumbs: list of { type, category, message, data, ... }
    breadcrumbs = event.get("breadcrumbs")
    if isinstance(breadcrumbs, dict):
        values = breadcrumbs.get("values")
        if isinstance(values, list):
            breadcrumbs["values"] = [_redact(item) for item in values]

    return event
