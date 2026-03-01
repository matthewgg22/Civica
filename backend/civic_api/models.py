from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class Ask(str, Enum):
    SUPPORT = "support"
    OPPOSE = "oppose"
    COSPONSOR = "cosponsor"
    VOTE_YES = "vote_yes"
    VOTE_NO = "vote_no"
    SEEK_OVERSIGHT = "seek_oversight"
    ASK_PUBLIC_STATEMENT = "ask_public_statement"
    ASK_AMENDMENT = "ask_amendment"


class RepTarget(str, Enum):
    HOUSE = "house"
    SENATE_1 = "senate_1"
    SENATE_2 = "senate_2"


class CallOutcome(str, Enum):
    UNAVAILABLE = "unavailable"
    VOICEMAIL = "voicemail"
    STAFFER_REACHED = "staffer_reached"
    SUPPORTIVE = "supportive"
    OPPOSED = "opposed"
    UNDECIDED = "undecided"
    FOLLOW_UP_REQUESTED = "follow_up_requested"
    OTHER = "other"


@dataclass
class AssistantResolveRequest:
    user_id: str
    concern_text: str
    selected_ask: Ask
    target_reps: list[RepTarget]
    optional_bill_ref: str | None = None


@dataclass
class ResolvedEntities:
    bills: list[str] = field(default_factory=list)
    committees: list[str] = field(default_factory=list)
    agencies: list[str] = field(default_factory=list)


@dataclass
class CallBrief:
    brief_id: str
    rep_id: str
    rep_name: str
    office_type: str
    primary_phone_number: str
    local_office_phone_number: str | None
    relevance_badges: list[str]
    related_bills: list[str]
    related_committees: list[str]
    live_script: str
    voicemail_script: str
    talking_points: list[str]
    issue_id: str
    rep_slot: RepTarget


@dataclass
class AssistantResolveResponse:
    issue_id: str
    issue_title: str
    issue_summary: str
    resolved_entities: ResolvedEntities
    call_briefs: list[CallBrief]

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        for brief in payload.get("call_briefs", []):
            rep_slot = brief.get("rep_slot")
            if isinstance(rep_slot, Enum):
                brief["rep_slot"] = rep_slot.value
        return payload


@dataclass
class ExampleIssueCard:
    issue_id: str
    title: str
    summary: str
    related_bills: list[str]
    rep_relevance: list[str]
    template_asks: list[Ask]
    live_script: str
    voicemail_script: str


@dataclass
class ExamplesResponse:
    examples: list[ExampleIssueCard]

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        for item in payload.get("examples", []):
            normalized: list[str] = []
            for value in item.get("template_asks", []):
                if isinstance(value, Enum):
                    normalized.append(value.value)
                else:
                    normalized.append(str(value))
            item["template_asks"] = normalized
        return payload


@dataclass
class CallLogRequest:
    user_id: str
    rep_id: str
    issue_id: str
    brief_id: str
    outcome: CallOutcome
    staffer_position: str | None
    notes: str


@dataclass
class CallLogRecord:
    log_id: str
    user_id: str
    rep_id: str
    rep_name: str
    issue_id: str
    issue_title: str
    brief_id: str
    outcome: CallOutcome
    staffer_position: str | None
    notes: str
    created_at: datetime


@dataclass
class HistoryGroup:
    id: str
    issue_id: str
    issue_title: str
    issue_summary: str
    date: datetime
    briefs: list[CallBrief]
    logs: list[CallLogRecord]


@dataclass
class HistoryResponse:
    history: list[HistoryGroup]

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        for group in payload.get("history", []):
            if isinstance(group.get("date"), str):
                continue
            if isinstance(group.get("date"), datetime):
                group["date"] = group["date"].astimezone(timezone.utc).isoformat()
            for log in group.get("logs", []):
                created_at = log.get("created_at")
                if isinstance(created_at, datetime):
                    log["created_at"] = created_at.astimezone(timezone.utc).isoformat()
                outcome = log.get("outcome")
                if isinstance(outcome, Enum):
                    log["outcome"] = outcome.value
            for brief in group.get("briefs", []):
                rep_slot = brief.get("rep_slot")
                if isinstance(rep_slot, Enum):
                    brief["rep_slot"] = rep_slot.value
        return payload


@dataclass
class RepContext:
    rep_id: str
    rep_name: str
    office_type: str
    chamber: str
    district: str | None
    state: str | None
    primary_phone_number: str
    local_office_phone_number: str | None = None


@dataclass
class RepIssueSignals:
    is_sponsor: bool = False
    is_cosponsor: bool = False
    committee_relevance: bool = False
    chamber_match: bool = False
    house_vote_signal: bool = False
    public_statement_signal: bool = False
    latest_action_date: str | None = None
    latest_action_text: str | None = None
    summary: str | None = None


@dataclass
class RepIssueScored:
    rep: RepContext
    signals: RepIssueSignals
    reason_badges: list[str]
