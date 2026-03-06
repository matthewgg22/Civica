from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from .congress_client import CongressGovClient
from .issue_catalog import baseline_issue_variants
from .models import (
    Ask,
    AssistantResolveRequest,
    AssistantResolveResponse,
    CallBrief,
    CallCompletionRequest,
    CallCompletionResponse,
    CallEvent,
    CallLaunchEvent,
    CallLaunchRequest,
    CallLogRecord,
    CallLogRequest,
    CallScoreHistoryItem,
    CallScoreHistoryResponse,
    CallScoreSnapshot,
    ExamplesResponse,
    ExampleIssueCard,
    HistoryResponse,
    LeaderboardCallRollup,
    LeaderboardEntry,
    LeaderboardPeriodType,
    LeaderboardResponse,
    LeaderboardUserSummary,
    RepContext,
    RepTarget,
    ResolvedEntities,
    VerificationMethod,
)
from .relevance import enrich_house_vote_signal, score_rep_issue, serialize_signals
from .repository import CivicRepository, InMemoryCivicRepository
from .script_composer import compose_call_scripts


class CivicService:
    def __init__(
        self,
        repository: CivicRepository | None = None,
        congress_client: CongressGovClient | None = None,
    ) -> None:
        self.repository = repository or InMemoryCivicRepository()
        self.congress = congress_client or CongressGovClient()
        self.call_score_enabled = _env_flag("VOTENOW_ENABLE_CALL_SCORE_V1", default=True)

    def get_examples(self, user_id: str) -> ExamplesResponse:
        reps = self._load_user_reps(user_id)
        if not reps:
            return ExamplesResponse(examples=[])

        available_chambers = {rep.chamber for rep in reps}
        cards: list[ExampleIssueCard] = []
        for variant in baseline_issue_variants():
            if not available_chambers.intersection(set(variant.target_chambers)):
                continue

            cards.append(
                ExampleIssueCard(
                    issue_id=variant.slug,
                    slug=variant.slug,
                    title=variant.title,
                    category=variant.category,
                    target_chambers=list(variant.target_chambers),
                    primary_ask=variant.primary_ask.value,
                    summary=variant.overview,
                    related_bills=list(variant.related_bills),
                    rep_relevance=self._build_rep_relevance(
                        target_chambers=variant.target_chambers,
                        reps=reps,
                    ),
                    template_asks=list(variant.template_asks) or [
                        variant.primary_ask,
                        Ask.ASK_PUBLIC_STATEMENT,
                        Ask.SEEK_OVERSIGHT,
                    ],
                    live_script=variant.live_script,
                    voicemail_script=variant.voicemail_script,
                    supporter_variant=variant.supporter_variant,
                    undecided_variant=variant.undecided_variant,
                    staffer_variant=variant.staffer_variant,
                    voicemail_footer=variant.voicemail_footer,
                    placeholders=list(variant.placeholders),
                    tags=list(variant.tags),
                )
            )

        return ExamplesResponse(examples=cards)

    def resolve_assistant(self, request: AssistantResolveRequest) -> AssistantResolveResponse:
        issue_id = str(uuid.uuid4())
        issue_title = self._resolve_issue_title(request.concern_text)
        issue_summary = request.concern_text.strip()

        reps = self._select_target_reps(request.user_id, request.target_reps)

        bills = [request.optional_bill_ref] if request.optional_bill_ref else []
        committees: list[str] = []
        agencies: list[str] = []

        call_briefs: list[CallBrief] = []
        for rep_target, rep in reps:
            scored = self._score_rep(
                rep=rep,
                issue_title=issue_title,
                bill_ref=request.optional_bill_ref,
            )
            committees = list(dict.fromkeys(committees + [badge for badge in scored.reason_badges if "Committee" in badge]))

            live_script, voicemail_script, talking_points = compose_call_scripts(
                rep=rep,
                ask=request.selected_ask,
                issue_title=issue_title,
                issue_summary=issue_summary,
                selected_bill=request.optional_bill_ref,
                user_location=rep.state or "your area",
                reason_badges=scored.reason_badges,
            )

            brief = CallBrief(
                brief_id=str(uuid.uuid4()),
                rep_id=rep.rep_id,
                rep_name=rep.rep_name,
                office_type=rep.office_type,
                primary_phone_number=rep.primary_phone_number,
                local_office_phone_number=rep.local_office_phone_number,
                relevance_badges=scored.reason_badges,
                related_bills=bills,
                related_committees=committees,
                live_script=live_script,
                voicemail_script=voicemail_script,
                talking_points=talking_points,
                issue_id=issue_id,
                rep_slot=rep_target,
            )
            call_briefs.append(brief)

            signal_row = serialize_signals(scored)
            signal_row.update({"issue_id": issue_id, "rep_slot": rep_target.value})
            self.repository.upsert_rep_issue_signal(signal_row)

        issue_row = {
            "issue_id": issue_id,
            "user_id": request.user_id,
            "issue_title": issue_title,
            "issue_summary": issue_summary,
            "selected_ask": request.selected_ask.value,
            "optional_bill_ref": request.optional_bill_ref,
            "resolved_bills": bills,
            "resolved_committees": committees,
            "resolved_agencies": agencies,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        self.repository.upsert_issue_catalog(issue_row)
        self.repository.insert_call_briefs(request.user_id, issue_id, call_briefs)

        return AssistantResolveResponse(
            issue_id=issue_id,
            issue_title=issue_title,
            issue_summary=issue_summary,
            resolved_entities=ResolvedEntities(
                bills=bills,
                committees=committees,
                agencies=agencies,
            ),
            call_briefs=call_briefs,
        )

    def log_call(self, request: CallLogRequest) -> dict[str, Any]:
        history = self.history(request.user_id).history
        issue_title = "Constituent issue"
        rep_name = request.rep_id

        for group in history:
            if group.issue_id != request.issue_id:
                continue
            issue_title = group.issue_title
            for brief in group.briefs:
                if brief.brief_id == request.brief_id:
                    rep_name = brief.rep_name
                    break
            break

        log = CallLogRecord(
            log_id=str(uuid.uuid4()),
            user_id=request.user_id,
            rep_id=request.rep_id,
            rep_name=rep_name,
            issue_id=request.issue_id,
            issue_title=issue_title,
            brief_id=request.brief_id,
            outcome=request.outcome,
            staffer_position=request.staffer_position,
            notes=request.notes,
            created_at=datetime.now(timezone.utc),
        )
        self.repository.insert_call_log(log)
        return {"ok": True, "log_id": log.log_id}

    def log_call_launch(self, request: CallLaunchRequest) -> dict[str, Any]:
        event = CallLaunchEvent(
            id=str(uuid.uuid4()),
            user_id=request.user_id,
            office_id=request.office_id,
            issue_id=request.issue_id,
            launched_at=datetime.now(timezone.utc),
            source_screen=request.source_screen,
            session_id=request.session_id,
        )
        self.repository.insert_call_launch_event(event)
        self._track(
            "call_launch_started",
            user_id=request.user_id,
            office_id=request.office_id,
            issue_id=request.issue_id,
            source_screen=request.source_screen,
        )
        return {
            "ok": True,
            "launch_event_id": event.id,
            "launched_at": event.launched_at.isoformat(),
            "call_score_enabled": self.call_score_enabled,
        }

    def confirm_call_completion(self, request: CallCompletionRequest) -> CallCompletionResponse:
        launch = self.repository.get_call_launch_event(request.user_id, request.launch_event_id)
        if launch is None:
            raise ValueError("Unknown launch_event_id for this user.")

        if not request.completed:
            return CallCompletionResponse(
                ok=True,
                launch_event_id=launch.id,
                call_logged=False,
                call_event_id=None,
                scoring_eligible_boolean=None,
                scoring_ineligibility_reason=None,
                call_score_snapshot=self.repository.get_call_score_snapshot(request.user_id),
                changed_components=[],
                baseline_crossed=False,
                tier_changed=False,
            )

        now = datetime.now(timezone.utc)
        duplicate_reason: str | None = None
        if not self.call_score_enabled:
            duplicate_reason = "Call score rollout is disabled."
        else:
            duplicate_reason = self._duplicate_reason(
                user_id=request.user_id,
                office_id=launch.office_id,
                issue_id=launch.issue_id,
                now=now,
            )
        scoring_eligible = duplicate_reason is None

        call_event = CallEvent(
            id=str(uuid.uuid4()),
            user_id=request.user_id,
            office_id=launch.office_id,
            issue_id=launch.issue_id,
            launch_event_id=launch.id,
            completed_confirmed_at=now,
            verification_method=VerificationMethod.APP_INITIATED_SELF_CONFIRMED,
            scoring_eligible_boolean=scoring_eligible,
            scoring_ineligibility_reason=duplicate_reason,
        )
        self.repository.insert_call_event(call_event)
        self._track(
            "call_completion_confirmed",
            user_id=request.user_id,
            office_id=launch.office_id,
            issue_id=launch.issue_id,
            scoring_eligible_boolean=scoring_eligible,
        )

        if not scoring_eligible:
            self._track(
                "call_marked_duplicate",
                user_id=request.user_id,
                office_id=launch.office_id,
                issue_id=launch.issue_id,
                reason=duplicate_reason,
            )

        snapshot, changed_components, baseline_crossed, tier_changed = self.recompute_call_score(request.user_id)
        if baseline_crossed:
            self._track("baseline_crossed", user_id=request.user_id, call_score=snapshot.call_score)
        if tier_changed:
            self._track("call_score_tier_changed", user_id=request.user_id, tier_name=snapshot.tier_name)

        return CallCompletionResponse(
            ok=True,
            launch_event_id=launch.id,
            call_logged=True,
            call_event_id=call_event.id,
            scoring_eligible_boolean=scoring_eligible,
            scoring_ineligibility_reason=duplicate_reason,
            call_score_snapshot=snapshot,
            changed_components=changed_components,
            baseline_crossed=baseline_crossed,
            tier_changed=tier_changed,
        )

    def recompute_call_score(self, user_id: str) -> tuple[CallScoreSnapshot, list[str], bool, bool]:
        previous = self.repository.get_call_score_snapshot(user_id)
        now = datetime.now(timezone.utc)
        if not self.call_score_enabled:
            snapshot = CallScoreSnapshot(
                user_id=user_id,
                call_score=0,
                activation_points=0,
                recency_points=0,
                consistency_points=0,
                breadth_points=0,
                momentum_points=0,
                tier_name=_tier_for_score(0),
                updated_at=now,
            )
            self.repository.upsert_call_score_snapshot(snapshot)
            return snapshot, _changed_score_components(previous, snapshot), False, previous is not None and previous.tier_name != snapshot.tier_name

        trailing_365 = now - timedelta(days=365)
        eligible_calls = self.repository.list_call_events(user_id, since=trailing_365, eligible_only=True)
        snapshot = self._build_call_score_snapshot(user_id=user_id, now=now, eligible_calls=eligible_calls)

        changed_components = _changed_score_components(previous, snapshot)
        baseline_crossed = bool(previous) and previous.activation_points == 0 and snapshot.activation_points == 30
        if previous is None and snapshot.activation_points == 30:
            baseline_crossed = True
        tier_changed = previous is not None and previous.tier_name != snapshot.tier_name

        self.repository.upsert_call_score_snapshot(snapshot)
        self.repository.upsert_leaderboard_rollups(self._build_rollups_for_user(user_id, now=now))
        self._track(
            "call_score_updated",
            user_id=user_id,
            call_score=snapshot.call_score,
            tier_name=snapshot.tier_name,
            changed_components=",".join(changed_components),
        )
        return snapshot, changed_components, baseline_crossed, tier_changed

    def get_call_score_summary(self, user_id: str) -> dict[str, Any]:
        if not self.call_score_enabled:
            return {
                "call_score": 0,
                "tier_name": _tier_for_score(0),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "explanation": "Call score rollout is currently disabled.",
                "enabled": False,
            }
        snapshot = self.repository.get_call_score_snapshot(user_id)
        if snapshot is None:
            snapshot, _, _, _ = self.recompute_call_score(user_id)

        return {
            "call_score": snapshot.call_score,
            "tier_name": snapshot.tier_name,
            "updated_at": snapshot.updated_at.isoformat(),
            "explanation": "Call score reflects verified, non-duplicate calls over recent time windows.",
            "enabled": True,
        }

    def get_call_score_breakdown(self, user_id: str) -> dict[str, Any]:
        if not self.call_score_enabled:
            return {
                "call_score": 0,
                "tier_name": _tier_for_score(0),
                "components": {
                    "activation_points": 0,
                    "recency_points": 0,
                    "consistency_points": 0,
                    "breadth_points": 0,
                    "momentum_points": 0,
                },
                "maxima": {
                    "activation_points": 30,
                    "recency_points": 10,
                    "consistency_points": 25,
                    "breadth_points": 20,
                    "momentum_points": 15,
                },
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "enabled": False,
            }
        snapshot = self.repository.get_call_score_snapshot(user_id)
        if snapshot is None:
            snapshot, _, _, _ = self.recompute_call_score(user_id)

        self._track("call_score_breakdown_viewed", user_id=user_id)
        return {
            "call_score": snapshot.call_score,
            "tier_name": snapshot.tier_name,
            "components": {
                "activation_points": snapshot.activation_points,
                "recency_points": snapshot.recency_points,
                "consistency_points": snapshot.consistency_points,
                "breadth_points": snapshot.breadth_points,
                "momentum_points": snapshot.momentum_points,
            },
            "maxima": {
                "activation_points": 30,
                "recency_points": 10,
                "consistency_points": 25,
                "breadth_points": 20,
                "momentum_points": 15,
            },
            "updated_at": snapshot.updated_at.isoformat(),
            "enabled": True,
        }

    def get_recent_scoring_history(self, user_id: str, limit: int = 20) -> CallScoreHistoryResponse:
        events = self.repository.list_call_events(user_id)[: max(1, limit)]
        items = [
            CallScoreHistoryItem(
                call_event_id=event.id,
                office_id=event.office_id,
                issue_id=event.issue_id,
                completed_confirmed_at=event.completed_confirmed_at,
                scoring_eligible_boolean=event.scoring_eligible_boolean,
                scoring_ineligibility_reason=event.scoring_ineligibility_reason,
            )
            for event in events
        ]
        return CallScoreHistoryResponse(history=items)

    def get_leaderboard(
        self,
        period_type: LeaderboardPeriodType,
        period_start: datetime | None = None,
        limit: int = 100,
    ) -> LeaderboardResponse:
        resolved_period_start = _normalize_period_start(
            period_type,
            period_start or datetime.now(timezone.utc),
        )
        rows = self.repository.list_leaderboard_rollups(period_type, resolved_period_start)
        sorted_rows = sorted(
            rows,
            key=lambda row: (
                -row.eligible_verified_call_count,
                -row.unique_office_count,
                row.user_id,
            ),
        )
        entries: list[LeaderboardEntry] = []
        for index, row in enumerate(sorted_rows[: max(1, limit)], start=1):
            entries.append(
                LeaderboardEntry(
                    user_id=row.user_id,
                    eligible_verified_call_count=row.eligible_verified_call_count,
                    unique_office_count=row.unique_office_count,
                    rank=index,
                )
            )

        self._track(
            "leaderboard_viewed",
            period_type=period_type.value,
            period_start=resolved_period_start.isoformat(),
        )
        return LeaderboardResponse(
            period_type=period_type,
            period_start=resolved_period_start,
            entries=entries,
        )

    def get_user_leaderboard_summary(
        self,
        user_id: str,
        period_type: LeaderboardPeriodType,
        period_start: datetime | None = None,
    ) -> LeaderboardUserSummary:
        resolved_period_start = _normalize_period_start(
            period_type,
            period_start or datetime.now(timezone.utc),
        )
        board = self.get_leaderboard(period_type=period_type, period_start=resolved_period_start, limit=500)
        rank: int | None = None
        count = 0
        unique_offices = 0
        for entry in board.entries:
            if entry.user_id == user_id:
                rank = entry.rank
                count = entry.eligible_verified_call_count
                unique_offices = entry.unique_office_count
                break

        if rank is None:
            rollup = self.repository.get_user_leaderboard_rollup(user_id, period_type, resolved_period_start)
            if rollup is not None:
                count = rollup.eligible_verified_call_count
                unique_offices = rollup.unique_office_count

        self._track(
            "leaderboard_period_changed",
            user_id=user_id,
            period_type=period_type.value,
            period_start=resolved_period_start.isoformat(),
        )
        return LeaderboardUserSummary(
            period_type=period_type,
            period_start=resolved_period_start,
            user_id=user_id,
            eligible_verified_call_count=count,
            unique_office_count=unique_offices,
            rank=rank,
        )

    def history(self, user_id: str) -> HistoryResponse:
        return HistoryResponse(history=self.repository.load_history(user_id))

    def _build_call_score_snapshot(
        self,
        user_id: str,
        now: datetime,
        eligible_calls: list[CallEvent],
    ) -> CallScoreSnapshot:
        now = now.astimezone(timezone.utc)
        activation_points = 30 if eligible_calls else 0

        recency_points = 0
        if eligible_calls:
            most_recent = max(event.completed_confirmed_at for event in eligible_calls)
            days_since = max(0, int((now - most_recent).total_seconds() // 86400))
            if 0 <= days_since <= 7:
                recency_points = 10
            elif 8 <= days_since <= 30:
                recency_points = 8
            elif 31 <= days_since <= 90:
                recency_points = 5
            elif 91 <= days_since <= 365:
                recency_points = 2
            else:
                recency_points = 0

        trailing_30 = now - timedelta(days=30)
        unique_days = {
            event.completed_confirmed_at.astimezone(timezone.utc).date()
            for event in eligible_calls
            if event.completed_confirmed_at >= trailing_30
        }
        if len(unique_days) >= 4:
            consistency_points = 25
        elif len(unique_days) == 3:
            consistency_points = 18
        elif len(unique_days) == 2:
            consistency_points = 12
        elif len(unique_days) == 1:
            consistency_points = 6
        else:
            consistency_points = 0

        trailing_90 = now - timedelta(days=90)
        unique_offices = {
            event.office_id
            for event in eligible_calls
            if event.completed_confirmed_at >= trailing_90
        }
        if len(unique_offices) >= 4:
            breadth_points = 20
        elif len(unique_offices) == 3:
            breadth_points = 15
        elif len(unique_offices) == 2:
            breadth_points = 10
        elif len(unique_offices) == 1:
            breadth_points = 5
        else:
            breadth_points = 0

        trailing_8w = now - timedelta(weeks=8)
        unique_weeks = {
            event.completed_confirmed_at.astimezone(timezone.utc).isocalendar()[:2]
            for event in eligible_calls
            if event.completed_confirmed_at >= trailing_8w
        }
        if len(unique_weeks) >= 3:
            momentum_points = 15
        elif len(unique_weeks) == 2:
            momentum_points = 10
        elif len(unique_weeks) == 1:
            momentum_points = 5
        else:
            momentum_points = 0

        call_score = activation_points + recency_points + consistency_points + breadth_points + momentum_points
        tier_name = _tier_for_score(call_score)

        return CallScoreSnapshot(
            user_id=user_id,
            call_score=max(0, min(100, int(call_score))),
            activation_points=activation_points,
            recency_points=recency_points,
            consistency_points=consistency_points,
            breadth_points=breadth_points,
            momentum_points=momentum_points,
            tier_name=tier_name,
            updated_at=now,
        )

    def _duplicate_reason(
        self,
        user_id: str,
        office_id: str,
        issue_id: str | None,
        now: datetime,
    ) -> str | None:
        since = now - timedelta(days=7)
        recent_events = self.repository.list_call_events(user_id=user_id, since=since, eligible_only=True)
        for event in recent_events:
            if event.office_id != office_id:
                continue
            if issue_id is None:
                return "Recent call to this office already counted in the past 7 days."
            if event.issue_id == issue_id:
                return "Recent call on this issue to this office already counted in the past 7 days."
        return None

    def _build_rollups_for_user(self, user_id: str, now: datetime) -> list[LeaderboardCallRollup]:
        events = self.repository.list_call_events(user_id=user_id, eligible_only=True)
        daily_buckets: dict[datetime, list[CallEvent]] = {}
        monthly_buckets: dict[datetime, list[CallEvent]] = {}
        annual_buckets: dict[datetime, list[CallEvent]] = {}

        for event in events:
            event_time = event.completed_confirmed_at.astimezone(timezone.utc)
            day_start = datetime(event_time.year, event_time.month, event_time.day, tzinfo=timezone.utc)
            month_start = datetime(event_time.year, event_time.month, 1, tzinfo=timezone.utc)
            year_start = datetime(event_time.year, 1, 1, tzinfo=timezone.utc)

            daily_buckets.setdefault(day_start, []).append(event)
            monthly_buckets.setdefault(month_start, []).append(event)
            annual_buckets.setdefault(year_start, []).append(event)

        rollups: list[LeaderboardCallRollup] = []
        for period_type, buckets in (
            (LeaderboardPeriodType.DAILY, daily_buckets),
            (LeaderboardPeriodType.MONTHLY, monthly_buckets),
            (LeaderboardPeriodType.ANNUAL, annual_buckets),
        ):
            for period_start, period_events in buckets.items():
                rollups.append(
                    LeaderboardCallRollup(
                        user_id=user_id,
                        period_type=period_type,
                        period_start=period_start,
                        eligible_verified_call_count=len(period_events),
                        unique_office_count=len({event.office_id for event in period_events}),
                        updated_at=now,
                    )
                )
        return rollups

    def _track(self, event_name: str, **payload: Any) -> None:
        print(f"[analytics] {event_name} {payload}")

    def _load_user_reps(self, user_id: str) -> list[RepContext]:
        reps = self.repository.list_rep_context(user_id)
        if reps:
            return reps

        # Safe fallback for local/dev mode.
        return [
            RepContext(
                rep_id="house-local",
                rep_name="House Office",
                office_type="U.S. Representative",
                chamber="house",
                district="unknown",
                state="US",
                primary_phone_number="(202) 225-3121",
            ),
            RepContext(
                rep_id="senate-local-1",
                rep_name="Senate Office 1",
                office_type="U.S. Senator",
                chamber="senate",
                district=None,
                state="US",
                primary_phone_number="(202) 224-3121",
            ),
            RepContext(
                rep_id="senate-local-2",
                rep_name="Senate Office 2",
                office_type="U.S. Senator",
                chamber="senate",
                district=None,
                state="US",
                primary_phone_number="(202) 224-3121",
            ),
        ]

    def _select_target_reps(self, user_id: str, targets: list[RepTarget]) -> list[tuple[RepTarget, RepContext]]:
        reps = self._load_user_reps(user_id)
        by_chamber = {
            "house": [rep for rep in reps if rep.chamber == "house"],
            "senate": [rep for rep in reps if rep.chamber == "senate"],
        }

        result: list[tuple[RepTarget, RepContext]] = []
        for target in targets:
            if target is RepTarget.HOUSE:
                if by_chamber["house"]:
                    result.append((target, by_chamber["house"][0]))
            elif target is RepTarget.SENATE_1:
                if by_chamber["senate"]:
                    result.append((target, by_chamber["senate"][0]))
            elif target is RepTarget.SENATE_2:
                if len(by_chamber["senate"]) >= 2:
                    result.append((target, by_chamber["senate"][1]))
                elif by_chamber["senate"]:
                    result.append((target, by_chamber["senate"][0]))

        if not result:
            for index, rep in enumerate(reps[:3]):
                target = [RepTarget.HOUSE, RepTarget.SENATE_1, RepTarget.SENATE_2][index]
                result.append((target, rep))
        return result

    def _score_rep(self, rep: RepContext, issue_title: str, bill_ref: str | None):
        sponsored: list[dict[str, Any]] = []
        cosponsored: list[dict[str, Any]] = []
        committees: list[dict[str, Any]] = []
        latest_date = None
        latest_text = None
        summary = None
        house_vote_signal = False

        if bill_ref:
            parsed = _parse_bill_ref(bill_ref)
            if parsed:
                congress, bill_type, bill_num = parsed
                try:
                    latest = self.congress.get_bill_latest_action(congress, bill_type, bill_num)
                    latest_date = latest.get("action_date")
                    latest_text = latest.get("action_text")
                    summary = self.congress.get_bill_summary(congress, bill_type, bill_num)
                except Exception:
                    latest_date = None
                    latest_text = None
                    summary = None

        house_vote_signal = enrich_house_vote_signal(
            rep=rep,
            rollcall_votes=[{"rep_id": rep.rep_id}] if rep.chamber == "house" and bill_ref else [],
        )

        return score_rep_issue(
            rep=rep,
            issue_title=issue_title,
            bill_ref=bill_ref,
            sponsored_bills=sponsored,
            cosponsored_bills=cosponsored,
            committees=committees,
            latest_action_date=latest_date,
            latest_action_text=latest_text,
            summary=summary,
            house_vote_signal=house_vote_signal,
            public_statement_signal=False,
        )

    def _resolve_issue_title(self, concern_text: str) -> str:
        concern = concern_text.strip()
        if not concern:
            return "Constituent issue"

        first_sentence = re.split(r"[.!?\n]", concern, maxsplit=1)[0].strip()
        if first_sentence:
            return _trim_words(first_sentence, 9)
        return _trim_words(concern, 9)

    def _build_rep_relevance(
        self,
        target_chambers: tuple[str, ...],
        reps: list[RepContext],
    ) -> list[str]:
        relevant_reps = [rep for rep in reps if rep.chamber in target_chambers]
        rep_lines = [f"{rep.rep_name} serves in {rep.office_type}." for rep in relevant_reps[:3]]

        if target_chambers == ("senate",):
            return [
                "This issue is currently targeted to the Senate.",
                *rep_lines,
            ]

        if target_chambers == ("house",):
            return [
                "This issue is currently targeted to the House.",
                *rep_lines,
            ]

        return [
            "This issue can be raised with both House and Senate offices.",
            *rep_lines,
        ]


def _parse_bill_ref(bill_ref: str) -> tuple[int, str, int] | None:
    normalized = bill_ref.strip().lower().replace(" ", "")
    match = re.match(r"([hs]\.r?|s\.?)?(\d+)", normalized)
    if not match:
        return None

    bill_prefix = match.group(1) or "h.r"
    bill_num = int(match.group(2))
    bill_type = "hr" if bill_prefix.startswith("h") else "s"
    current_congress = 119
    return current_congress, bill_type, bill_num


def _trim_words(text: str, max_words: int) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words])


def _tier_for_score(score: int) -> str:
    if score <= 29:
        return "Not Active Yet"
    if score <= 49:
        return "Crossed Baseline"
    if score <= 69:
        return "Active Advocate"
    if score <= 84:
        return "Consistent Caller"
    return "Civic Catalyst"


def _normalize_period_start(period_type: LeaderboardPeriodType, value: datetime) -> datetime:
    utc_value = value.astimezone(timezone.utc)
    if period_type is LeaderboardPeriodType.DAILY:
        return datetime(utc_value.year, utc_value.month, utc_value.day, tzinfo=timezone.utc)
    if period_type is LeaderboardPeriodType.MONTHLY:
        return datetime(utc_value.year, utc_value.month, 1, tzinfo=timezone.utc)
    return datetime(utc_value.year, 1, 1, tzinfo=timezone.utc)


def _env_flag(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def _changed_score_components(previous: CallScoreSnapshot | None, current: CallScoreSnapshot) -> list[str]:
    if previous is None:
        return [
            "activation_points",
            "recency_points",
            "consistency_points",
            "breadth_points",
            "momentum_points",
        ]
    changes: list[str] = []
    for key in (
        "activation_points",
        "recency_points",
        "consistency_points",
        "breadth_points",
        "momentum_points",
    ):
        if getattr(previous, key) != getattr(current, key):
            changes.append(key)
    return changes
