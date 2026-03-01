from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any


class CongressGovClient:
    """Client for Congress.gov v3 API with retries, timeout, and response normalization."""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = "https://api.congress.gov/v3",
        timeout_s: float = 8.0,
        max_retries: int = 3,
    ) -> None:
        self.api_key = api_key or os.environ.get("CONGRESS_GOV_API_KEY", "")
        self.base_url = base_url.rstrip("/")
        self.timeout_s = timeout_s
        self.max_retries = max_retries
        self._cache: dict[str, Any] = {}

    def get_active_members(self, state: str, district: str | None = None) -> list[dict[str, Any]]:
        query = {"currentMember": "true", "state": state.upper()}
        if district is not None:
            query["district"] = district
        raw = self._request_json("/member", query)
        members = raw.get("members", [])
        normalized: list[dict[str, Any]] = []
        for member in members:
            normalized.append(
                {
                    "bioguide_id": member.get("bioguideId") or member.get("memberId"),
                    "name": member.get("name"),
                    "state": member.get("state"),
                    "district": member.get("district"),
                    "party": member.get("partyName") or member.get("party"),
                    "chamber": _normalize_chamber(member.get("terms", {}).get("item", [])),
                }
            )
        return normalized

    def get_member_sponsored_bills(self, bioguide_id: str, congress: int | None = None) -> list[dict[str, Any]]:
        query: dict[str, Any] = {}
        if congress:
            query["congress"] = str(congress)
        raw = self._request_json(f"/member/{bioguide_id}/sponsored-legislation", query)
        return [self._normalize_bill_reference(row) for row in raw.get("sponsoredLegislation", [])]

    def get_member_cosponsored_bills(self, bioguide_id: str, congress: int | None = None) -> list[dict[str, Any]]:
        query: dict[str, Any] = {}
        if congress:
            query["congress"] = str(congress)
        raw = self._request_json(f"/member/{bioguide_id}/cosponsored-legislation", query)
        return [self._normalize_bill_reference(row) for row in raw.get("cosponsoredLegislation", [])]

    def get_member_committees(self, bioguide_id: str) -> list[dict[str, Any]]:
        raw = self._request_json(f"/member/{bioguide_id}", None)
        committee_rows = raw.get("member", {}).get("committees", [])
        return [
            {
                "committee_name": row.get("name"),
                "committee_code": row.get("systemCode"),
                "subcommittee_name": row.get("subcommittee", {}).get("name"),
                "role": row.get("position") or "member",
            }
            for row in committee_rows
        ]

    def get_bill_latest_action(self, congress: int, bill_type: str, bill_number: int) -> dict[str, Any]:
        raw = self._request_json(f"/bill/{congress}/{bill_type}/{bill_number}", None)
        latest = raw.get("bill", {}).get("latestAction", {})
        return {
            "action_date": latest.get("actionDate"),
            "action_text": latest.get("text"),
        }

    def get_bill_policy_area(self, congress: int, bill_type: str, bill_number: int) -> str | None:
        raw = self._request_json(f"/bill/{congress}/{bill_type}/{bill_number}", None)
        return raw.get("bill", {}).get("policyArea", {}).get("name")

    def get_bill_summary(self, congress: int, bill_type: str, bill_number: int) -> str | None:
        raw = self._request_json(f"/bill/{congress}/{bill_type}/{bill_number}/summaries", None)
        summaries = raw.get("summaries", [])
        if not summaries:
            return None
        return summaries[0].get("text")

    def get_house_rollcall_member_vote(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        # Phase 2 enrichment path.
        return {
            "supported": False,
            "source": "not_implemented",
            "details": "House roll-call member vote ingestion is a phase-2 capability.",
        }

    def _request_json(self, path: str, query: dict[str, Any] | None) -> dict[str, Any]:
        params = dict(query or {})
        if self.api_key:
            params["api_key"] = self.api_key

        encoded = urllib.parse.urlencode(params)
        cache_key = f"{path}?{encoded}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        url = f"{self.base_url}{path}"
        if encoded:
            url = f"{url}?{encoded}"

        last_error: Exception | None = None
        for attempt in range(1, self.max_retries + 1):
            request = urllib.request.Request(url, method="GET", headers={"Accept": "application/json"})
            try:
                with urllib.request.urlopen(request, timeout=self.timeout_s) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                    self._cache[cache_key] = payload
                    return payload
            except urllib.error.HTTPError as exc:
                last_error = exc
                if exc.code in {429, 500, 502, 503, 504} and attempt < self.max_retries:
                    time.sleep(0.5 * (2 ** (attempt - 1)))
                    continue
                break
            except urllib.error.URLError as exc:
                last_error = exc
                if attempt < self.max_retries:
                    time.sleep(0.5 * (2 ** (attempt - 1)))
                    continue
                break

        raise RuntimeError(f"Congress.gov request failed for {path}: {last_error}")

    def _normalize_bill_reference(self, row: dict[str, Any]) -> dict[str, Any]:
        congress = row.get("congress")
        bill_type = (row.get("type") or "").lower()
        number = row.get("number")
        latest_action = row.get("latestAction", {})
        return {
            "bill_id": f"{bill_type.upper()}.{number}",
            "congress": congress,
            "bill_type": bill_type,
            "bill_number": number,
            "title": row.get("title"),
            "latest_action_date": latest_action.get("actionDate"),
            "latest_action_text": latest_action.get("text"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }


def _normalize_chamber(term_rows: list[dict[str, Any]]) -> str:
    if not term_rows:
        return "unknown"
    latest = term_rows[-1]
    chamber = str(latest.get("chamber", "")).lower()
    if "senate" in chamber:
        return "senate"
    if "house" in chamber:
        return "house"
    return chamber or "unknown"
