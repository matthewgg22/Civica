"""Repository layer for Find Help locations.

Mirrors the abstract-base / in-memory / Supabase split used by
backend.civic_api.repository. Kept separate because the Find Help domain
has no overlap with CivicRepository's call/issue methods.
"""

from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

from .models import FindHelpLocation, Source

logger = logging.getLogger(__name__)


class FindHelpRepository(ABC):
    @abstractmethod
    def upsert_location(self, location: FindHelpLocation) -> None:
        raise NotImplementedError

    @abstractmethod
    def mark_source_locations_inactive(self, source: Source, seen_external_ids: set[str]) -> int:
        """Soft-delete rows for `source` whose external_id is not in `seen_external_ids`.

        Returns the count of rows deactivated.
        """
        raise NotImplementedError

    @abstractmethod
    def record_source_run(
        self,
        source: Source,
        ok: bool,
        error: str | None = None,
        ran_at: datetime | None = None,
    ) -> None:
        raise NotImplementedError


def _serialize_location(location: FindHelpLocation) -> dict[str, Any]:
    return {
        "external_id": location.external_id,
        "source": location.source.value,
        "name": location.name,
        "state": location.state,
        "service_types": [st.value for st in location.service_types],
        "address_line_1": location.address_line_1,
        "address_line_2": location.address_line_2,
        "city": location.city,
        "zip": location.zip,
        "latitude": location.latitude,
        "longitude": location.longitude,
        "phone": location.phone,
        "email": location.email,
        "website_url": location.website_url,
        "hours_json": location.hours_json,
        "languages_json": location.languages_json,
        "notes": location.notes,
        "source_last_updated_at": (
            location.source_last_updated_at.astimezone(timezone.utc).isoformat()
            if location.source_last_updated_at
            else None
        ),
        "civica_last_synced_at": datetime.now(timezone.utc).isoformat(),
        "active": True,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


class InMemoryFindHelpRepository(FindHelpRepository):
    def __init__(self) -> None:
        # Keyed by (source, external_id).
        self._locations: dict[tuple[str, str], dict[str, Any]] = {}
        self._source_runs: list[dict[str, Any]] = []

    def upsert_location(self, location: FindHelpLocation) -> None:
        key = (location.source.value, location.external_id)
        self._locations[key] = _serialize_location(location)

    def mark_source_locations_inactive(self, source: Source, seen_external_ids: set[str]) -> int:
        deactivated = 0
        for (loc_source, external_id), row in self._locations.items():
            if loc_source != source.value:
                continue
            if external_id in seen_external_ids:
                continue
            if row.get("active"):
                row["active"] = False
                deactivated += 1
        return deactivated

    def record_source_run(
        self,
        source: Source,
        ok: bool,
        error: str | None = None,
        ran_at: datetime | None = None,
    ) -> None:
        self._source_runs.append(
            {
                "source": source.value,
                "ok": ok,
                "error": error,
                "ran_at": (ran_at or datetime.now(timezone.utc)).isoformat(),
            }
        )

    # Test helpers (not part of the abstract contract).
    def list_active(self, source: Source | None = None) -> list[dict[str, Any]]:
        rows = [r for r in self._locations.values() if r.get("active")]
        if source is not None:
            rows = [r for r in rows if r["source"] == source.value]
        return rows

    def list_all(self) -> list[dict[str, Any]]:
        return list(self._locations.values())

    @property
    def source_runs(self) -> list[dict[str, Any]]:
        return list(self._source_runs)


class SupabaseFindHelpRepository(FindHelpRepository):
    """PostgREST-backed Find Help repository.

    Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment;
    the service role bypasses RLS so the sync job can mark rows inactive.
    """

    def __init__(self, timeout_s: float = 8.0, max_retries: int = 3) -> None:
        self.base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        self.timeout_s = timeout_s
        self.max_retries = max_retries

        if not self.base_url or not self.service_key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    def upsert_location(self, location: FindHelpLocation) -> None:
        row = _serialize_location(location)
        self._request_json(
            "POST",
            "/rest/v1/find_help_locations?on_conflict=source,external_id",
            body=[row],
            prefer="resolution=merge-duplicates,return=minimal",
        )

    def mark_source_locations_inactive(self, source: Source, seen_external_ids: set[str]) -> int:
        if not seen_external_ids:
            # Defensive: refuse to deactivate everything on an empty seen-set.
            # A fetcher that returned zero rows likely failed; let record_source_run
            # capture that and leave existing rows alone.
            logger.warning("mark_source_locations_inactive skipped: empty seen-set for %s", source.value)
            return 0
        params = {
            "source": f"eq.{source.value}",
            "active": "eq.true",
            "external_id": f"not.in.({','.join(_quote_ids(seen_external_ids))})",
        }
        body = {"active": False, "updated_at": datetime.now(timezone.utc).isoformat()}
        self._request_json(
            "PATCH",
            f"/rest/v1/find_help_locations?{urllib.parse.urlencode(params)}",
            body=body,
            prefer="return=minimal",
        )
        # PostgREST does not return affected count without return=representation; treat as fire-and-forget.
        return 0

    def record_source_run(
        self,
        source: Source,
        ok: bool,
        error: str | None = None,
        ran_at: datetime | None = None,
    ) -> None:
        now_iso = (ran_at or datetime.now(timezone.utc)).astimezone(timezone.utc).isoformat()
        row: dict[str, Any] = {
            "source": source.value,
            "last_synced_at": now_iso,
            "last_error": error,
            "updated_at": now_iso,
        }
        if ok:
            row["last_succeeded_at"] = now_iso
        self._request_json(
            "POST",
            "/rest/v1/find_help_sources?on_conflict=source",
            body=[row],
            prefer="resolution=merge-duplicates,return=minimal",
        )

    def _request_json(
        self,
        method: str,
        path: str,
        body: Any | None = None,
        prefer: str | None = None,
    ) -> Any:
        if not path.startswith("/"):
            path = f"/{path}"
        url = f"{self.base_url}{path}"
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Accept": "application/json",
        }
        payload = None
        if body is not None:
            payload = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if prefer:
            headers["Prefer"] = prefer

        for attempt in range(1, self.max_retries + 1):
            request = urllib.request.Request(url, data=payload, method=method, headers=headers)
            try:
                with urllib.request.urlopen(request, timeout=self.timeout_s) as response:
                    data = response.read()
                    if not data:
                        return []
                    return json.loads(data.decode("utf-8"))
            except urllib.error.HTTPError as exc:
                status = exc.code
                if status in {429, 500, 502, 503, 504} and attempt < self.max_retries:
                    time.sleep(0.5 * (2 ** (attempt - 1)))
                    continue
                raise
            except urllib.error.URLError:
                if attempt < self.max_retries:
                    time.sleep(0.5 * (2 ** (attempt - 1)))
                    continue
                raise

        raise RuntimeError("unreachable retry loop")


def _quote_ids(ids: set[str]) -> list[str]:
    # PostgREST `not.in.(...)` accepts unquoted tokens unless they contain commas/parens.
    # External IDs are controlled by our fetchers; reject any with separators to avoid query injection.
    safe: list[str] = []
    for raw in ids:
        token = str(raw)
        if any(ch in token for ch in (",", "(", ")")):
            logger.warning("Refusing to include external_id with separator in PostgREST filter: %r", token)
            continue
        safe.append(f'"{token}"')
    return safe
