from __future__ import annotations

import json
import logging
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

from .models import (
    CallBrief,
    CallEvent,
    CallLaunchEvent,
    CallLogRecord,
    CallOutcome,
    IssueEvidenceItem,
    CallScoreSnapshot,
    HistoryGroup,
    LeaderboardCallRollup,
    LeaderboardPeriodType,
    RepContext,
    VerificationMethod,
)

logger = logging.getLogger(__name__)


class CivicRepository(ABC):
    @abstractmethod
    def list_rep_context(self, user_id: str) -> list[RepContext]:
        raise NotImplementedError

    @abstractmethod
    def list_example_templates(self) -> list[dict[str, Any]]:
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
    def insert_call_launch_event(self, event: CallLaunchEvent) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_call_launch_event(self, user_id: str, launch_event_id: str) -> CallLaunchEvent | None:
        raise NotImplementedError

    @abstractmethod
    def insert_call_event(self, event: CallEvent) -> None:
        raise NotImplementedError

    @abstractmethod
    def find_recent_scoring_eligible_call(
        self,
        user_id: str,
        office_id: str,
        issue_id: str | None,
        since: datetime,
    ) -> CallEvent | None:
        raise NotImplementedError

    @abstractmethod
    def list_call_events(
        self,
        user_id: str,
        since: datetime | None = None,
        eligible_only: bool = False,
    ) -> list[CallEvent]:
        raise NotImplementedError

    @abstractmethod
    def upsert_call_score_snapshot(self, snapshot: CallScoreSnapshot) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_call_score_snapshot(self, user_id: str) -> CallScoreSnapshot | None:
        raise NotImplementedError

    @abstractmethod
    def upsert_leaderboard_rollups(self, rollups: list[LeaderboardCallRollup]) -> None:
        raise NotImplementedError

    @abstractmethod
    def list_leaderboard_rollups(
        self,
        period_type: LeaderboardPeriodType,
        period_start: datetime,
    ) -> list[LeaderboardCallRollup]:
        raise NotImplementedError

    @abstractmethod
    def get_user_leaderboard_rollup(
        self,
        user_id: str,
        period_type: LeaderboardPeriodType,
        period_start: datetime,
    ) -> LeaderboardCallRollup | None:
        raise NotImplementedError

    @abstractmethod
    def load_history(self, user_id: str) -> list[HistoryGroup]:
        raise NotImplementedError

    def upsert_issue_core(self, issue_row: dict[str, Any]) -> None:
        raise NotImplementedError

    def list_issue_core(self) -> list[dict[str, Any]]:
        raise NotImplementedError

    def upsert_issue_evidence_item(self, evidence_row: dict[str, Any]) -> None:
        raise NotImplementedError

    def list_issue_evidence_items(self, canonical_issue: str) -> list[IssueEvidenceItem]:
        raise NotImplementedError

    def insert_issue_snapshot(self, snapshot_row: dict[str, Any]) -> None:
        raise NotImplementedError

    def insert_brief_request(self, request_row: dict[str, Any]) -> None:
        raise NotImplementedError

    def insert_brief_response(self, response_row: dict[str, Any]) -> None:
        raise NotImplementedError

    def insert_policy_event(self, policy_row: dict[str, Any]) -> None:
        raise NotImplementedError

    def insert_script_generation_event(self, event_row: dict[str, Any]) -> None:
        raise NotImplementedError

    def insert_script_chat_turn(self, turn_row: dict[str, Any]) -> None:
        raise NotImplementedError


class InMemoryCivicRepository(CivicRepository):
    def __init__(self) -> None:
        self._rep_context_by_user: dict[str, list[RepContext]] = defaultdict(list)
        self._example_templates: list[dict[str, Any]] = []
        self._issues: dict[str, dict[str, Any]] = {}
        self._signals: list[dict[str, Any]] = []
        self._briefs_by_user_issue: dict[tuple[str, str], list[CallBrief]] = defaultdict(list)
        self._logs_by_user: dict[str, list[CallLogRecord]] = defaultdict(list)
        self._launches_by_id: dict[str, CallLaunchEvent] = {}
        self._events_by_user: dict[str, list[CallEvent]] = defaultdict(list)
        self._score_snapshot_by_user: dict[str, CallScoreSnapshot] = {}
        self._leaderboard_rollups: dict[tuple[str, str, str], LeaderboardCallRollup] = {}
        self._issue_core_by_key: dict[str, dict[str, Any]] = {}
        self._issue_evidence_by_issue: dict[str, list[IssueEvidenceItem]] = defaultdict(list)
        self._issue_snapshots: list[dict[str, Any]] = []
        self._brief_requests: list[dict[str, Any]] = []
        self._brief_responses: list[dict[str, Any]] = []
        self._policy_events: list[dict[str, Any]] = []
        self._script_generation_events: list[dict[str, Any]] = []
        self._script_chat_turns: list[dict[str, Any]] = []

    def seed_reps(self, user_id: str, reps: list[RepContext]) -> None:
        self._rep_context_by_user[user_id] = reps

    def list_rep_context(self, user_id: str) -> list[RepContext]:
        return list(self._rep_context_by_user.get(user_id, []))

    def seed_example_templates(self, rows: list[dict[str, Any]]) -> None:
        self._example_templates = [dict(row) for row in rows]

    def list_example_templates(self) -> list[dict[str, Any]]:
        return [dict(row) for row in self._example_templates]

    def upsert_issue_catalog(self, issue_row: dict[str, Any]) -> None:
        issue_id = str(issue_row["issue_id"])
        self._issues[issue_id] = dict(issue_row)

    def upsert_rep_issue_signal(self, signal_row: dict[str, Any]) -> None:
        self._signals.append(dict(signal_row))

    def insert_call_briefs(self, user_id: str, issue_id: str, briefs: list[CallBrief]) -> None:
        self._briefs_by_user_issue[(user_id, issue_id)] = list(briefs)

    def insert_call_log(self, record: CallLogRecord) -> None:
        self._logs_by_user[record.user_id].insert(0, record)

    def insert_call_launch_event(self, event: CallLaunchEvent) -> None:
        self._launches_by_id[event.id] = event

    def get_call_launch_event(self, user_id: str, launch_event_id: str) -> CallLaunchEvent | None:
        event = self._launches_by_id.get(launch_event_id)
        if event is None:
            return None
        if event.user_id != user_id:
            return None
        return event

    def insert_call_event(self, event: CallEvent) -> None:
        self._events_by_user[event.user_id].insert(0, event)

    def find_recent_scoring_eligible_call(
        self,
        user_id: str,
        office_id: str,
        issue_id: str | None,
        since: datetime,
    ) -> CallEvent | None:
        for event in self._events_by_user.get(user_id, []):
            if not event.scoring_eligible_boolean:
                continue
            if event.office_id != office_id:
                continue
            if event.completed_confirmed_at < since:
                continue
            if issue_id is None:
                if event.issue_id is None:
                    return event
            else:
                if event.issue_id == issue_id:
                    return event
        return None

    def list_call_events(
        self,
        user_id: str,
        since: datetime | None = None,
        eligible_only: bool = False,
    ) -> list[CallEvent]:
        events = list(self._events_by_user.get(user_id, []))
        if since is not None:
            events = [event for event in events if event.completed_confirmed_at >= since]
        if eligible_only:
            events = [event for event in events if event.scoring_eligible_boolean]
        return sorted(events, key=lambda event: event.completed_confirmed_at, reverse=True)

    def upsert_call_score_snapshot(self, snapshot: CallScoreSnapshot) -> None:
        self._score_snapshot_by_user[snapshot.user_id] = snapshot

    def get_call_score_snapshot(self, user_id: str) -> CallScoreSnapshot | None:
        return self._score_snapshot_by_user.get(user_id)

    def upsert_leaderboard_rollups(self, rollups: list[LeaderboardCallRollup]) -> None:
        for rollup in rollups:
            key = (
                rollup.user_id,
                rollup.period_type.value,
                rollup.period_start.astimezone(timezone.utc).isoformat(),
            )
            self._leaderboard_rollups[key] = rollup

    def list_leaderboard_rollups(
        self,
        period_type: LeaderboardPeriodType,
        period_start: datetime,
    ) -> list[LeaderboardCallRollup]:
        period_iso = period_start.astimezone(timezone.utc).isoformat()
        return [
            rollup
            for (_, stored_period_type, stored_period_start), rollup in self._leaderboard_rollups.items()
            if stored_period_type == period_type.value and stored_period_start == period_iso
        ]

    def get_user_leaderboard_rollup(
        self,
        user_id: str,
        period_type: LeaderboardPeriodType,
        period_start: datetime,
    ) -> LeaderboardCallRollup | None:
        key = (user_id, period_type.value, period_start.astimezone(timezone.utc).isoformat())
        return self._leaderboard_rollups.get(key)

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

    def upsert_issue_core(self, issue_row: dict[str, Any]) -> None:
        key = str(issue_row.get("canonical_issue", "")).strip()
        if not key:
            return
        self._issue_core_by_key[key] = dict(issue_row)

    def list_issue_core(self) -> list[dict[str, Any]]:
        return list(self._issue_core_by_key.values())

    def upsert_issue_evidence_item(self, evidence_row: dict[str, Any]) -> None:
        canonical_issue = str(evidence_row.get("canonical_issue", "")).strip()
        evidence_id = str(evidence_row.get("evidence_id", "")).strip()
        claim = str(evidence_row.get("claim", "")).strip()
        source_name = str(evidence_row.get("source_name", "")).strip()
        if not canonical_issue or not evidence_id or not claim or not source_name:
            return
        item = IssueEvidenceItem(
            evidence_id=evidence_id,
            canonical_issue=canonical_issue,
            source_name=source_name,
            source_url=evidence_row.get("source_url"),
            published_at=_parse_ts(str(evidence_row.get("published_at", ""))) if evidence_row.get("published_at") else None,
            retrieved_at=_parse_ts(str(evidence_row.get("retrieved_at", datetime.now(timezone.utc).isoformat()))),
            claim=claim,
            evidence_type=str(evidence_row.get("evidence_type", "official")),
            supports_view=evidence_row.get("supports_view"),
        )
        rows = [row for row in self._issue_evidence_by_issue[canonical_issue] if row.evidence_id != item.evidence_id]
        rows.append(item)
        self._issue_evidence_by_issue[canonical_issue] = rows

    def list_issue_evidence_items(self, canonical_issue: str) -> list[IssueEvidenceItem]:
        return list(self._issue_evidence_by_issue.get(canonical_issue, []))

    def insert_issue_snapshot(self, snapshot_row: dict[str, Any]) -> None:
        self._issue_snapshots.append(dict(snapshot_row))

    def insert_brief_request(self, request_row: dict[str, Any]) -> None:
        self._brief_requests.append(dict(request_row))

    def insert_brief_response(self, response_row: dict[str, Any]) -> None:
        self._brief_responses.append(dict(response_row))

    def insert_policy_event(self, policy_row: dict[str, Any]) -> None:
        self._policy_events.append(dict(policy_row))

    def insert_script_generation_event(self, event_row: dict[str, Any]) -> None:
        self._script_generation_events.append(dict(event_row))

    def insert_script_chat_turn(self, turn_row: dict[str, Any]) -> None:
        self._script_chat_turns.append(dict(turn_row))


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
        try:
            payload = self._request_json("GET", f"/rest/v1/user_federal_reps?{params}")
        except urllib.error.HTTPError as exc:
            # Invalid UUID filters or rollout races should not block civic flows.
            if exc.code in {400, 404}:
                return []
            raise
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

    def list_example_templates(self) -> list[dict[str, Any]]:
        params = urllib.parse.urlencode({"order": "display_order.asc,updated_at.desc"})
        try:
            return self._request_json("GET", f"/rest/v1/civic_example_templates?{params}")
        except urllib.error.HTTPError as exc:
            # Allow zero-downtime rollout while the new table migration propagates.
            if exc.code in {400, 404}:
                return []
            raise

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
        try:
            self._request_json("POST", "/rest/v1/call_logs", body=[row])
        except urllib.error.HTTPError as exc:
            # Allow rollout when call log table is not yet migrated.
            if exc.code in {400, 404}:
                return
            raise

    def insert_call_launch_event(self, event: CallLaunchEvent) -> None:
        row = asdict(event)
        row["launched_at"] = event.launched_at.astimezone(timezone.utc).isoformat()
        try:
            self._request_json("POST", "/rest/v1/call_launch_events", body=[row])
        except urllib.error.HTTPError as exc:
            # Allow zero-downtime rollout while call launch tables migrate.
            if exc.code in {400, 404}:
                logger.warning("Skipping call_launch_events insert during rollout (status=%s).", exc.code)
                return
            raise

    def get_call_launch_event(self, user_id: str, launch_event_id: str) -> CallLaunchEvent | None:
        params = urllib.parse.urlencode(
            {
                "id": f"eq.{launch_event_id}",
                "user_id": f"eq.{user_id}",
                "limit": "1",
            }
        )
        try:
            rows = self._request_json("GET", f"/rest/v1/call_launch_events?{params}")
        except urllib.error.HTTPError as exc:
            if exc.code in {400, 404}:
                logger.warning("call_launch_events unavailable during lookup (status=%s).", exc.code)
                return None
            raise
        if not rows:
            return None
        row = rows[0]
        return CallLaunchEvent(
            id=str(row.get("id", "")),
            user_id=str(row.get("user_id", "")),
            office_id=str(row.get("office_id", "")),
            issue_id=row.get("issue_id"),
            launched_at=_parse_ts(str(row.get("launched_at", ""))),
            source_screen=str(row.get("source_screen", "")),
            session_id=row.get("session_id"),
        )

    def insert_call_event(self, event: CallEvent) -> None:
        row = asdict(event)
        row["completed_confirmed_at"] = event.completed_confirmed_at.astimezone(timezone.utc).isoformat()
        verification = row.get("verification_method")
        if isinstance(verification, VerificationMethod):
            row["verification_method"] = verification.value
        try:
            self._request_json("POST", "/rest/v1/call_events", body=[row])
        except urllib.error.HTTPError as exc:
            if exc.code in {400, 404}:
                logger.warning("Skipping call_events insert during rollout (status=%s).", exc.code)
                return
            raise

    def find_recent_scoring_eligible_call(
        self,
        user_id: str,
        office_id: str,
        issue_id: str | None,
        since: datetime,
    ) -> CallEvent | None:
        params: dict[str, str] = {
            "user_id": f"eq.{user_id}",
            "office_id": f"eq.{office_id}",
            "scoring_eligible_boolean": "eq.true",
            "completed_confirmed_at": f"gte.{since.astimezone(timezone.utc).isoformat()}",
            "order": "completed_confirmed_at.desc",
            "limit": "1",
        }
        if issue_id is None:
            params["issue_id"] = "is.null"
        else:
            params["issue_id"] = f"eq.{issue_id}"
        try:
            rows = self._request_json("GET", f"/rest/v1/call_events?{urllib.parse.urlencode(params)}")
        except urllib.error.HTTPError as exc:
            if exc.code in {400, 404}:
                return None
            raise
        if not rows:
            return None
        return _row_to_call_event(rows[0])

    def list_call_events(
        self,
        user_id: str,
        since: datetime | None = None,
        eligible_only: bool = False,
    ) -> list[CallEvent]:
        params: dict[str, str] = {
            "user_id": f"eq.{user_id}",
            "order": "completed_confirmed_at.desc",
        }
        if since is not None:
            params["completed_confirmed_at"] = f"gte.{since.astimezone(timezone.utc).isoformat()}"
        if eligible_only:
            params["scoring_eligible_boolean"] = "eq.true"

        try:
            rows = self._request_json("GET", f"/rest/v1/call_events?{urllib.parse.urlencode(params)}")
        except urllib.error.HTTPError as exc:
            if exc.code in {400, 404}:
                return []
            raise
        return [_row_to_call_event(row) for row in rows]

    def upsert_call_score_snapshot(self, snapshot: CallScoreSnapshot) -> None:
        row = asdict(snapshot)
        row["updated_at"] = snapshot.updated_at.astimezone(timezone.utc).isoformat()
        try:
            self._request_json("POST", "/rest/v1/call_score_snapshots", body=[row], prefer="resolution=merge-duplicates")
        except urllib.error.HTTPError as exc:
            # Allow rollout when score tables are not yet migrated.
            if exc.code in {400, 404}:
                return
            raise

    def get_call_score_snapshot(self, user_id: str) -> CallScoreSnapshot | None:
        params = urllib.parse.urlencode({"user_id": f"eq.{user_id}", "limit": "1"})
        try:
            rows = self._request_json("GET", f"/rest/v1/call_score_snapshots?{params}")
        except urllib.error.HTTPError as exc:
            if exc.code in {400, 404}:
                return None
            raise
        if not rows:
            return None
        row = rows[0]
        return CallScoreSnapshot(
            user_id=str(row.get("user_id", user_id)),
            call_score=int(row.get("call_score", 0)),
            activation_points=int(row.get("activation_points", 0)),
            recency_points=int(row.get("recency_points", 0)),
            consistency_points=int(row.get("consistency_points", 0)),
            breadth_points=int(row.get("breadth_points", 0)),
            momentum_points=int(row.get("momentum_points", 0)),
            tier_name=str(row.get("tier_name", "Not Active Yet")),
            updated_at=_parse_ts(str(row.get("updated_at", ""))),
        )

    def upsert_leaderboard_rollups(self, rollups: list[LeaderboardCallRollup]) -> None:
        if not rollups:
            return
        rows: list[dict[str, Any]] = []
        for rollup in rollups:
            rows.append(
                {
                    "user_id": rollup.user_id,
                    "period_type": rollup.period_type.value,
                    "period_start": rollup.period_start.astimezone(timezone.utc).isoformat(),
                    "eligible_verified_call_count": rollup.eligible_verified_call_count,
                    "unique_office_count": rollup.unique_office_count,
                    "updated_at": rollup.updated_at.astimezone(timezone.utc).isoformat(),
                }
            )
        try:
            self._request_json(
                "POST",
                "/rest/v1/leaderboard_call_rollups",
                body=rows,
                prefer="resolution=merge-duplicates",
            )
        except urllib.error.HTTPError as exc:
            if exc.code in {400, 404}:
                return
            raise


    def list_leaderboard_rollups(
        self,
        period_type: LeaderboardPeriodType,
        period_start: datetime,
    ) -> list[LeaderboardCallRollup]:
        params = urllib.parse.urlencode(
            {
                "period_type": f"eq.{period_type.value}",
                "period_start": f"eq.{period_start.astimezone(timezone.utc).isoformat()}",
            }
        )
        try:
            rows = self._request_json("GET", f"/rest/v1/leaderboard_call_rollups?{params}")
        except urllib.error.HTTPError as exc:
            if exc.code in {400, 404}:
                return []
            raise
        return [_row_to_leaderboard_rollup(row) for row in rows]

    def get_user_leaderboard_rollup(
        self,
        user_id: str,
        period_type: LeaderboardPeriodType,
        period_start: datetime,
    ) -> LeaderboardCallRollup | None:
        params = urllib.parse.urlencode(
            {
                "user_id": f"eq.{user_id}",
                "period_type": f"eq.{period_type.value}",
                "period_start": f"eq.{period_start.astimezone(timezone.utc).isoformat()}",
                "limit": "1",
            }
        )
        try:
            rows = self._request_json("GET", f"/rest/v1/leaderboard_call_rollups?{params}")
        except urllib.error.HTTPError as exc:
            if exc.code in {400, 404}:
                return None
            raise
        if not rows:
            return None
        return _row_to_leaderboard_rollup(rows[0])

    def load_history(self, user_id: str) -> list[HistoryGroup]:
        logs_params = urllib.parse.urlencode({"user_id": f"eq.{user_id}", "order": "created_at.desc"})
        try:
            logs = self._request_json("GET", f"/rest/v1/call_logs?{logs_params}")
        except urllib.error.HTTPError as exc:
            if exc.code in {400, 404}:
                return []
            raise

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

    def upsert_issue_core(self, issue_row: dict[str, Any]) -> None:
        self._request_json("POST", "/rest/v1/issue_core", body=[issue_row], prefer="resolution=merge-duplicates")

    def list_issue_core(self) -> list[dict[str, Any]]:
        return self._request_json("GET", "/rest/v1/issue_core")

    def upsert_issue_evidence_item(self, evidence_row: dict[str, Any]) -> None:
        self._request_json(
            "POST",
            "/rest/v1/issue_evidence_item",
            body=[evidence_row],
            prefer="resolution=merge-duplicates",
        )

    def list_issue_evidence_items(self, canonical_issue: str) -> list[IssueEvidenceItem]:
        params = urllib.parse.urlencode(
            {
                "canonical_issue": f"eq.{canonical_issue}",
                "order": "published_at.desc.nullslast,retrieved_at.desc",
            }
        )
        rows = self._request_json("GET", f"/rest/v1/issue_evidence_item?{params}")
        items: list[IssueEvidenceItem] = []
        for row in rows:
            items.append(
                IssueEvidenceItem(
                    evidence_id=str(row.get("evidence_id", "")),
                    canonical_issue=str(row.get("canonical_issue", "")),
                    source_name=str(row.get("source_name", "")),
                    source_url=row.get("source_url"),
                    published_at=_parse_ts(str(row.get("published_at", ""))) if row.get("published_at") else None,
                    retrieved_at=_parse_ts(str(row.get("retrieved_at", ""))),
                    claim=str(row.get("claim", "")),
                    evidence_type=str(row.get("evidence_type", "official")),
                    supports_view=row.get("supports_view"),
                )
            )
        return items

    def insert_issue_snapshot(self, snapshot_row: dict[str, Any]) -> None:
        self._request_json("POST", "/rest/v1/issue_snapshot", body=[snapshot_row])

    def insert_brief_request(self, request_row: dict[str, Any]) -> None:
        self._request_json("POST", "/rest/v1/brief_request", body=[request_row])

    def insert_brief_response(self, response_row: dict[str, Any]) -> None:
        self._request_json("POST", "/rest/v1/brief_response", body=[response_row])

    def insert_policy_event(self, policy_row: dict[str, Any]) -> None:
        self._request_json("POST", "/rest/v1/policy_event", body=[policy_row])

    def insert_script_generation_event(self, event_row: dict[str, Any]) -> None:
        try:
            self._request_json("POST", "/rest/v1/mapc_script_generation_events", body=[event_row])
        except urllib.error.HTTPError as exc:
            if exc.code in {400, 404}:
                logger.warning("Skipping mapc_script_generation_events insert during rollout (status=%s).", exc.code)
                return
            raise

    def insert_script_chat_turn(self, turn_row: dict[str, Any]) -> None:
        try:
            self._request_json("POST", "/rest/v1/mapc_script_chat_turns", body=[turn_row])
        except urllib.error.HTTPError as exc:
            if exc.code in {400, 404}:
                logger.warning("Skipping mapc_script_chat_turns insert during rollout (status=%s).", exc.code)
                return
            raise

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


def _row_to_call_event(row: dict[str, Any]) -> CallEvent:
    verification_raw = str(row.get("verification_method", VerificationMethod.APP_INITIATED_SELF_CONFIRMED.value))
    try:
        verification = VerificationMethod(verification_raw)
    except ValueError:
        verification = VerificationMethod.APP_INITIATED_SELF_CONFIRMED

    scored_raw = row.get("scoring_eligible_boolean", False)
    if isinstance(scored_raw, bool):
        scored_eligible = scored_raw
    elif isinstance(scored_raw, str):
        scored_eligible = scored_raw.strip().lower() in {"true", "t", "1", "yes"}
    else:
        scored_eligible = bool(scored_raw)

    return CallEvent(
        id=str(row.get("id", "")),
        user_id=str(row.get("user_id", "")),
        office_id=str(row.get("office_id", "")),
        issue_id=row.get("issue_id"),
        launch_event_id=str(row.get("launch_event_id", "")),
        completed_confirmed_at=_parse_ts(str(row.get("completed_confirmed_at", ""))),
        verification_method=verification,
        scoring_eligible_boolean=scored_eligible,
        scoring_ineligibility_reason=row.get("scoring_ineligibility_reason"),
    )


def _row_to_leaderboard_rollup(row: dict[str, Any]) -> LeaderboardCallRollup:
    period_type_raw = str(row.get("period_type", LeaderboardPeriodType.DAILY.value))
    try:
        period_type = LeaderboardPeriodType(period_type_raw)
    except ValueError:
        period_type = LeaderboardPeriodType.DAILY

    return LeaderboardCallRollup(
        user_id=str(row.get("user_id", "")),
        period_type=period_type,
        period_start=_parse_ts(str(row.get("period_start", ""))),
        eligible_verified_call_count=int(row.get("eligible_verified_call_count", 0)),
        unique_office_count=int(row.get("unique_office_count", 0)),
        updated_at=_parse_ts(str(row.get("updated_at", ""))),
    )
