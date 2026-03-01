from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from abc import ABC, abstractmethod
from collections import defaultdict
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any

from .models import CallBrief, CallLogRecord, CallOutcome, HistoryGroup, RepContext


class CivicRepository(ABC):
    @abstractmethod
    def list_rep_context(self, user_id: str) -> list[RepContext]:
        raise NotImplementedError

    @abstractmethod
    def upsert_issue_catalog(self, issue_row: dict[str, Any]) -> None:
        raise NotImplementedError

    @abstractmethod
    def upsert_rep_issue_signal(self, signal_row: dict[str, Any]) -> None:
        raise NotImplementedError

    @abstractmethod
    def insert_call_briefs(self, user_id: str, issue_id: str, briefs: list[CallBrief]) -> None:
        raise NotImplementedError

    @abstractmethod
    def insert_call_log(self, record: CallLogRecord) -> None:
        raise NotImplementedError

    @abstractmethod
    def load_history(self, user_id: str) -> list[HistoryGroup]:
        raise NotImplementedError


class InMemoryCivicRepository(CivicRepository):
    def __init__(self) -> None:
        self._rep_context_by_user: dict[str, list[RepContext]] = defaultdict(list)
        self._issues: dict[str, dict[str, Any]] = {}
        self._signals: list[dict[str, Any]] = []
        self._briefs_by_user_issue: dict[tuple[str, str], list[CallBrief]] = defaultdict(list)
        self._logs_by_user: dict[str, list[CallLogRecord]] = defaultdict(list)

    def seed_reps(self, user_id: str, reps: list[RepContext]) -> None:
        self._rep_context_by_user[user_id] = reps

    def list_rep_context(self, user_id: str) -> list[RepContext]:
        return list(self._rep_context_by_user.get(user_id, []))

    def upsert_issue_catalog(self, issue_row: dict[str, Any]) -> None:
        issue_id = str(issue_row["issue_id"])
        self._issues[issue_id] = dict(issue_row)

    def upsert_rep_issue_signal(self, signal_row: dict[str, Any]) -> None:
        self._signals.append(dict(signal_row))

    def insert_call_briefs(self, user_id: str, issue_id: str, briefs: list[CallBrief]) -> None:
        self._briefs_by_user_issue[(user_id, issue_id)] = list(briefs)

    def insert_call_log(self, record: CallLogRecord) -> None:
        self._logs_by_user[record.user_id].insert(0, record)

    def load_history(self, user_id: str) -> list[HistoryGroup]:
        groups: dict[str, HistoryGroup] = {}
        for log in self._logs_by_user.get(user_id, []):
            issue_id = log.issue_id
            issue_row = self._issues.get(issue_id, {})
            briefs = self._briefs_by_user_issue.get((user_id, issue_id), [])

            if issue_id not in groups:
                groups[issue_id] = HistoryGroup(
                    id=f"{user_id}:{issue_id}",
                    issue_id=issue_id,
                    issue_title=str(issue_row.get("issue_title", log.issue_title)),
                    issue_summary=str(issue_row.get("issue_summary", "")),
                    date=log.created_at,
                    briefs=list(briefs),
                    logs=[log],
                )
            else:
                group = groups[issue_id]
                group.logs.append(log)
                if log.created_at > group.date:
                    group.date = log.created_at

        return sorted(groups.values(), key=lambda group: group.date, reverse=True)


class SupabaseCivicRepository(CivicRepository):
    """PostgREST-backed repository with retry/timeout handling.

    Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from environment.
    """

    def __init__(self, timeout_s: float = 8.0, max_retries: int = 3) -> None:
        self.base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        self.timeout_s = timeout_s
        self.max_retries = max_retries

        if not self.base_url or not self.service_key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    def list_rep_context(self, user_id: str) -> list[RepContext]:
        params = urllib.parse.urlencode({"user_id": f"eq.{user_id}"})
        payload = self._request_json("GET", f"/rest/v1/user_federal_reps?{params}")
        reps: list[RepContext] = []
        for row in payload:
            reps.append(
                RepContext(
                    rep_id=str(row["rep_id"]),
                    rep_name=str(row.get("rep_name", "")),
                    office_type=str(row.get("office_type", "")),
                    chamber=str(row.get("chamber", "")),
                    district=row.get("district"),
                    state=row.get("state"),
                    primary_phone_number=str(row.get("primary_phone_number", "")),
                    local_office_phone_number=row.get("local_office_phone_number"),
                )
            )
        return reps

    def upsert_issue_catalog(self, issue_row: dict[str, Any]) -> None:
        self._request_json("POST", "/rest/v1/issue_catalog", body=[issue_row], prefer="resolution=merge-duplicates")

    def upsert_rep_issue_signal(self, signal_row: dict[str, Any]) -> None:
        self._request_json("POST", "/rest/v1/rep_issue_signals", body=[signal_row], prefer="resolution=merge-duplicates")

    def insert_call_briefs(self, user_id: str, issue_id: str, briefs: list[CallBrief]) -> None:
        rows = []
        for brief in briefs:
            row = asdict(brief)
            row["user_id"] = user_id
            row["issue_id"] = issue_id
            rows.append(row)
        self._request_json("POST", "/rest/v1/call_briefs", body=rows)

    def insert_call_log(self, record: CallLogRecord) -> None:
        row = asdict(record)
        row["created_at"] = record.created_at.astimezone(timezone.utc).isoformat()
        row["outcome"] = record.outcome.value if isinstance(record.outcome, CallOutcome) else str(record.outcome)
        self._request_json("POST", "/rest/v1/call_logs", body=[row])

    def load_history(self, user_id: str) -> list[HistoryGroup]:
        logs_params = urllib.parse.urlencode({"user_id": f"eq.{user_id}", "order": "created_at.desc"})
        logs = self._request_json("GET", f"/rest/v1/call_logs?{logs_params}")

        issue_ids = {str(row.get("issue_id")) for row in logs if row.get("issue_id")}
        if not issue_ids:
            return []

        issue_filter = ",".join(issue_ids)
        issue_params = urllib.parse.urlencode({"issue_id": f"in.({issue_filter})"})
        issues = self._request_json("GET", f"/rest/v1/issue_catalog?{issue_params}")
        issues_by_id = {str(row["issue_id"]): row for row in issues}

        brief_params = urllib.parse.urlencode({"user_id": f"eq.{user_id}", "issue_id": f"in.({issue_filter})"})
        brief_rows = self._request_json("GET", f"/rest/v1/call_briefs?{brief_params}")

        briefs_by_issue: dict[str, list[CallBrief]] = defaultdict(list)
        for row in brief_rows:
            briefs_by_issue[str(row.get("issue_id"))].append(
                CallBrief(
                    brief_id=str(row.get("brief_id", "")),
                    rep_id=str(row.get("rep_id", "")),
                    rep_name=str(row.get("rep_name", "")),
                    office_type=str(row.get("office_type", "")),
                    primary_phone_number=str(row.get("primary_phone_number", "")),
                    local_office_phone_number=row.get("local_office_phone_number"),
                    relevance_badges=list(row.get("relevance_badges", [])),
                    related_bills=list(row.get("related_bills", [])),
                    related_committees=list(row.get("related_committees", [])),
                    live_script=str(row.get("live_script", "")),
                    voicemail_script=str(row.get("voicemail_script", "")),
                    talking_points=list(row.get("talking_points", [])),
                    issue_id=str(row.get("issue_id", "")),
                    rep_slot=row.get("rep_slot"),
                )
            )

        groups: dict[str, HistoryGroup] = {}
        for row in logs:
            issue_id = str(row.get("issue_id", ""))
            if not issue_id:
                continue
            created_at_raw = str(row.get("created_at", ""))
            created_at = _parse_ts(created_at_raw)

            record = CallLogRecord(
                log_id=str(row.get("log_id", "")),
                user_id=user_id,
                rep_id=str(row.get("rep_id", "")),
                rep_name=str(row.get("rep_name", "")),
                issue_id=issue_id,
                issue_title=str(issues_by_id.get(issue_id, {}).get("issue_title", "")),
                brief_id=str(row.get("brief_id", "")),
                outcome=CallOutcome(str(row.get("outcome", "other"))),
                staffer_position=row.get("staffer_position"),
                notes=str(row.get("notes", "")),
                created_at=created_at,
            )

            if issue_id not in groups:
                issue = issues_by_id.get(issue_id, {})
                groups[issue_id] = HistoryGroup(
                    id=f"{user_id}:{issue_id}",
                    issue_id=issue_id,
                    issue_title=str(issue.get("issue_title", record.issue_title)),
                    issue_summary=str(issue.get("issue_summary", "")),
                    date=created_at,
                    briefs=briefs_by_issue.get(issue_id, []),
                    logs=[record],
                )
            else:
                groups[issue_id].logs.append(record)

        return sorted(groups.values(), key=lambda value: value.date, reverse=True)

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


def _parse_ts(value: str) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)
