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


class VerificationMethod(str, Enum):
    APP_INITIATED_SELF_CONFIRMED = "app_initiated_self_confirmed"


class LeaderboardPeriodType(str, Enum):
    DAILY = "daily"
    MONTHLY = "monthly"
    ANNUAL = "annual"


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
    slug: str
    title: str
    category: str
    target_chambers: list[str]
    primary_ask: str
    summary: str
    related_bills: list[str]
    rep_relevance: list[str]
    template_asks: list[Ask]
    live_script: str
    voicemail_script: str
    supporter_variant: str | None = None
    undecided_variant: str | None = None
    staffer_variant: str | None = None
    voicemail_footer: str | None = None
    placeholders: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)


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
            primary_ask = item.get("primary_ask")
            if isinstance(primary_ask, Enum):
                item["primary_ask"] = primary_ask.value
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
class CallLaunchRequest:
    user_id: str
    office_id: str
    issue_id: str | None
    source_screen: str
    session_id: str | None = None


@dataclass
class CallCompletionRequest:
    user_id: str
    launch_event_id: str
    completed: bool


@dataclass
class CallLaunchEvent:
    id: str
    user_id: str
    office_id: str
    issue_id: str | None
    launched_at: datetime
    source_screen: str
    session_id: str | None


@dataclass
class CallEvent:
    id: str
    user_id: str
    office_id: str
    issue_id: str | None
    launch_event_id: str
    completed_confirmed_at: datetime
    verification_method: VerificationMethod
    scoring_eligible_boolean: bool
    scoring_ineligibility_reason: str | None = None


@dataclass
class CallScoreSnapshot:
    user_id: str
    call_score: int
    activation_points: int
    recency_points: int
    consistency_points: int
    breadth_points: int
    momentum_points: int
    tier_name: str
    updated_at: datetime

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["updated_at"] = self.updated_at.astimezone(timezone.utc).isoformat()
        return payload


@dataclass
class LeaderboardCallRollup:
    user_id: str
    period_type: LeaderboardPeriodType
    period_start: datetime
    eligible_verified_call_count: int
    unique_office_count: int
    updated_at: datetime


@dataclass
class CallScoreHistoryItem:
    call_event_id: str
    office_id: str
    issue_id: str | None
    completed_confirmed_at: datetime
    scoring_eligible_boolean: bool
    scoring_ineligibility_reason: str | None


@dataclass
class CallScoreHistoryResponse:
    history: list[CallScoreHistoryItem]

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        for item in payload.get("history", []):
            if isinstance(item.get("completed_confirmed_at"), datetime):
                item["completed_confirmed_at"] = item["completed_confirmed_at"].astimezone(timezone.utc).isoformat()
        return payload


@dataclass
class LeaderboardEntry:
    user_id: str
    eligible_verified_call_count: int
    unique_office_count: int
    rank: int


@dataclass
class LeaderboardResponse:
    period_type: LeaderboardPeriodType
    period_start: datetime
    entries: list[LeaderboardEntry]

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        period_type = payload.get("period_type")
        if isinstance(period_type, Enum):
            payload["period_type"] = period_type.value
        if isinstance(self.period_start, datetime):
            payload["period_start"] = self.period_start.astimezone(timezone.utc).isoformat()
        return payload


@dataclass
class LeaderboardUserSummary:
    period_type: LeaderboardPeriodType
    period_start: datetime
    user_id: str
    eligible_verified_call_count: int
    unique_office_count: int
    rank: int | None

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        period_type = payload.get("period_type")
        if isinstance(period_type, Enum):
            payload["period_type"] = period_type.value
        payload["period_start"] = self.period_start.astimezone(timezone.utc).isoformat()
        return payload


@dataclass
class CallCompletionResponse:
    ok: bool
    launch_event_id: str
    call_logged: bool
    call_event_id: str | None
    scoring_eligible_boolean: bool | None
    scoring_ineligibility_reason: str | None
    call_score_snapshot: CallScoreSnapshot | None
    changed_components: list[str]
    baseline_crossed: bool
    tier_changed: bool

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "ok": self.ok,
            "launch_event_id": self.launch_event_id,
            "call_logged": self.call_logged,
            "call_event_id": self.call_event_id,
            "scoring_eligible_boolean": self.scoring_eligible_boolean,
            "scoring_ineligibility_reason": self.scoring_ineligibility_reason,
            "changed_components": self.changed_components,
            "baseline_crossed": self.baseline_crossed,
            "tier_changed": self.tier_changed,
        }
        if self.call_score_snapshot is not None:
            payload["call_score_snapshot"] = self.call_score_snapshot.to_dict()
        else:
            payload["call_score_snapshot"] = None
        return payload


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


@dataclass
class CommitteeAssignment:
    committee_name: str
    subcommittee_name: str | None
    role: str
    congress: int | None
    chamber: str = "senate"
    member_name: str | None = None


@dataclass
class MemberProfile:
    bioguide_id: str
    name: str
    party: str | None
    state: str | None
    district: str | None
    chamber: str
    phone: str | None
    office_address: str | None
    website: str | None
    contact_form: str | None
    leadership_roles: list[str] = field(default_factory=list)
    sponsored_legislation_ref: str | None = None
    cosponsored_legislation_ref: str | None = None
    committees_ref: str | None = None
    committee_assignments: list[CommitteeAssignment] = field(default_factory=list)
    terms: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class BillContext:
    congress: int
    bill_type: str
    bill_number: int
    title: str | None
    introduced_date: str | None
    origin_chamber: str | None
    policy_area: str | None
    summary: str | None
    latest_action_date: str | None
    latest_action_text: str | None
    summaries_ref: str | None
    committees_ref: str | None
    actions_ref: str | None
    cosponsors_ref: str | None


@dataclass
class BillAction:
    action_date: str | None
    text: str | None
    action_code: str | None = None
    chamber: str | None = None


@dataclass
class BillCosponsor:
    bioguide_id: str | None
    name: str | None
    party: str | None
    state: str | None
    sponsorship_date: str | None
    is_original_cosponsor: bool = False


@dataclass
class BillCommitteeActivity:
    committee_name: str
    chamber: str | None
    activity_name: str | None
    activity_date: str | None
    subcommittee_name: str | None = None


@dataclass
class PoliticalEvent:
    event_type: str
    title: str
    date: str | None
    status: str | None
    committees: list[str] = field(default_factory=list)
    related_bills: list[str] = field(default_factory=list)
    ref_url: str | None = None


@dataclass
class ScriptContext:
    member_profile: MemberProfile | None
    bill_context: BillContext | None
    bill_actions: list[BillAction] = field(default_factory=list)
    bill_cosponsors: list[BillCosponsor] = field(default_factory=list)
    bill_committee_activity: list[BillCommitteeActivity] = field(default_factory=list)
    committee_assignments: list[CommitteeAssignment] = field(default_factory=list)
    political_events: list[PoliticalEvent] = field(default_factory=list)
