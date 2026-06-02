"""Minimal schema-aware PostgREST client for the shadow eligibility sweep.

Mirrors the urllib + retry/backoff pattern in repository_supabase.py, adding the
PostgREST profile header so the sweep can read/write the `snap_enrollment`
schema (PostgREST selects one schema per request via Accept-Profile on reads /
Content-Profile on writes). Authenticates with the service-role key, so it
bypasses RLS — appropriate for a server-side batch job and matched by the
service_role-only grants on the determination tables.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


class PostgrestError(RuntimeError):
    pass


class PostgrestClient:
    def __init__(self, *, timeout_s: float = 10.0, max_retries: int = 3) -> None:
        self.base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not self.base_url or not self.service_key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to run the shadow sweep."
            )
        self.timeout_s = timeout_s
        self.max_retries = max_retries

    def get(
        self, table: str, *, schema: str, params: dict[str, str]
    ) -> list[dict[str, Any]]:
        query = urllib.parse.urlencode(params)
        return self._request("GET", f"/rest/v1/{table}?{query}", schema=schema)

    def insert(
        self, table: str, rows: list[dict[str, Any]], *, schema: str
    ) -> list[dict[str, Any]]:
        if not rows:
            return []
        return self._request(
            "POST",
            f"/rest/v1/{table}",
            schema=schema,
            body=rows,
            prefer="return=representation",
        )

    # ------------------------------------------------------------------

    def _request(
        self,
        method: str,
        path: str,
        *,
        schema: str,
        body: Any | None = None,
        prefer: str | None = None,
    ) -> Any:
        url = f"{self.base_url}{path}"
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Accept": "application/json",
        }
        # PostgREST picks the schema per-request via the profile header.
        if method == "GET":
            headers["Accept-Profile"] = schema
        else:
            headers["Content-Profile"] = schema
        payload = None
        if body is not None:
            payload = json.dumps(body, default=str).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if prefer:
            headers["Prefer"] = prefer

        for attempt in range(1, self.max_retries + 1):
            request = urllib.request.Request(
                url, data=payload, method=method, headers=headers
            )
            try:
                with urllib.request.urlopen(request, timeout=self.timeout_s) as response:
                    data = response.read()
                    return json.loads(data.decode("utf-8")) if data else []
            except urllib.error.HTTPError as exc:
                if exc.code in {429, 500, 502, 503, 504} and attempt < self.max_retries:
                    time.sleep(0.5 * (2 ** (attempt - 1)))
                    continue
                detail = ""
                try:
                    detail = exc.read().decode("utf-8", "replace")
                except Exception:  # noqa: BLE001 - best-effort error detail
                    pass
                raise PostgrestError(f"{method} {path} -> HTTP {exc.code}: {detail}") from exc
            except urllib.error.URLError:
                if attempt < self.max_retries:
                    time.sleep(0.5 * (2 ** (attempt - 1)))
                    continue
                raise

        raise PostgrestError("unreachable retry loop")
