"""Audit-log query helpers for compliance pulls + incident response.

Use cases:
  - "Show me everything that touched session X." (User support / FOIA)
  - "Show me every decryption event in the last 30 days." (Compliance)
  - "Show me every PDF generated in the last 24 hours." (Operations)
  - "How often is the Anthropic LLM client failing over to OpenAI?"
    (Reliability — out of scope here, lives in LLMCallTelemetry.)

These helpers are PostgREST-only so they can run from any environment
with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or the read-only
auditor role's key, in production). They never decrypt PII columns —
the audit log is metadata-only, by design.

CLI integration: bin/snap_audit lives at the operations layer and
wraps these functions for terminal use; this module is the library
behind it.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Iterable, Optional


def list_entries_for_session(
    session_id: str,
    *,
    base_url: Optional[str] = None,
    auth_token: Optional[str] = None,
) -> list[dict]:
    """Every audit row for a session, ordered by occurred_at ascending."""
    params = urllib.parse.urlencode(
        {
            "session_id": f"eq.{session_id}",
            "order": "occurred_at.asc",
        }
    )
    return _request("GET", f"/rest/v1/snap_audit_log?{params}", base_url=base_url, auth_token=auth_token)


def list_decryption_events(
    *,
    since: datetime,
    until: Optional[datetime] = None,
    base_url: Optional[str] = None,
    auth_token: Optional[str] = None,
) -> list[dict]:
    """Every PII_FIELD_DECRYPTED entry in [since, until). Used by the
    monthly compliance report to detect anomalous decryption rates."""
    until = until or datetime.now(timezone.utc)
    params = urllib.parse.urlencode(
        {
            "action": "eq.pii_field_decrypted",
            "occurred_at": f"gte.{since.isoformat()}",
            "and": f"(occurred_at.lt.{until.isoformat()})",
            "order": "occurred_at.desc",
        }
    )
    return _request("GET", f"/rest/v1/snap_audit_log?{params}", base_url=base_url, auth_token=auth_token)


def list_pdf_generations(
    *,
    since: datetime,
    base_url: Optional[str] = None,
    auth_token: Optional[str] = None,
) -> list[dict]:
    """Every PDF generation event since `since`. Useful for monitoring
    how many users are completing the application flow end-to-end."""
    params = urllib.parse.urlencode(
        {
            "action": "eq.pdf_generated",
            "occurred_at": f"gte.{since.isoformat()}",
            "order": "occurred_at.desc",
        }
    )
    return _request("GET", f"/rest/v1/snap_audit_log?{params}", base_url=base_url, auth_token=auth_token)


def count_entries_by_action(
    *,
    since: datetime,
    base_url: Optional[str] = None,
    auth_token: Optional[str] = None,
) -> dict[str, int]:
    """Histogram of audit actions in [since, now). Cheap dashboard
    feed; if any action's count drops to zero unexpectedly that's an
    early signal that some flow has broken silently."""
    params = urllib.parse.urlencode(
        {
            "occurred_at": f"gte.{since.isoformat()}",
            "select": "action",
        }
    )
    rows = _request("GET", f"/rest/v1/snap_audit_log?{params}", base_url=base_url, auth_token=auth_token)
    counts: dict[str, int] = {}
    for row in rows:
        counts[row["action"]] = counts.get(row["action"], 0) + 1
    return counts


def _request(
    method: str,
    path: str,
    *,
    base_url: Optional[str] = None,
    auth_token: Optional[str] = None,
) -> list[dict]:
    url_base = (base_url or os.environ.get("SUPABASE_URL", "")).rstrip("/")
    if not url_base:
        raise RuntimeError(
            "SUPABASE_URL is not set; cannot query audit log without a base URL."
        )
    token = auth_token or os.environ.get("SUPABASE_AUDIT_READ_KEY") or os.environ.get(
        "SUPABASE_SERVICE_ROLE_KEY", ""
    )
    if not token:
        raise RuntimeError(
            "Audit log queries require SUPABASE_AUDIT_READ_KEY (preferred) or "
            "SUPABASE_SERVICE_ROLE_KEY for authentication."
        )
    request = urllib.request.Request(
        f"{url_base}{path}",
        method=method,
        headers={
            "apikey": token,
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=10.0) as response:
        data = response.read()
        if not data:
            return []
        return json.loads(data.decode("utf-8"))
